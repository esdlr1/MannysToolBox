// Estimate comparison v2 — the deterministic engine.
// Design: docs/estimate-comparison-redesign.md.
//
// Parse both PDFs (trust gate each), match line items in deterministic tiers,
// compute every delta in code, persist documents + comparison to the corpus,
// and run Scope Check recommendations on the "mine" side. The legacy
// GPT-does-everything /compare route remains until the UI is rewired.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { existsSync } from 'fs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCents, parseEstimateFile, ParseOutcome } from '@/lib/estimate-engine'
import { buildSynonymCanon, matchDocuments, roomRollups } from '@/lib/estimate-engine/match'
import { buildRoomCanon, inferRoomPairs, pairedRoomLabels } from '@/lib/estimate-engine/room-pairs'
import { aiExtractDocument } from '@/lib/estimate-engine/ai-extract'
import { suggestPairings } from '@/lib/estimate-engine/suggest'
import { persistEstimateDocument } from '@/lib/estimate-db'
import { evaluateScopeRules } from '@/lib/scope-check/rules'
import { loadDismissals, loadScopeRules } from '@/lib/scope-check/rule-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mineFileId, carrierFileId } = await request.json()
    if (!mineFileId || !carrierFileId) {
      return NextResponse.json({ error: 'Missing mineFileId or carrierFileId' }, { status: 400 })
    }

    const [mineOutcome, mineError] = await parseSide(session.user.id, mineFileId, 'your estimate')
    if (!mineOutcome) return mineError
    const [carrierOutcome, carrierError] = await parseSide(
      session.user.id,
      carrierFileId,
      "the carrier's estimate"
    )
    if (!carrierOutcome) return carrierError

    const mineDoc = mineOutcome.document!
    const carrierDoc = carrierOutcome.document!
    const synonymCanon = await loadSynonymCanon()

    // Pass 1: match on literal rooms; use the evidence to infer room pairs
    // (renamed rooms), then re-match with confident pairs merged.
    const firstPass = matchDocuments(mineDoc, carrierDoc, { synonymCanon })
    const roomPairs = inferRoomPairs(mineDoc, carrierDoc, firstPass, await loadRoomAliases())
    const merged = roomPairs.filter((p) => p.confidence !== 'suggested')
    const roomCanon = buildRoomCanon(roomPairs)
    const result =
      merged.length > 0
        ? matchDocuments(mineDoc, carrierDoc, { synonymCanon, roomCanon })
        : firstPass
    const rollups = roomRollups(mineDoc, carrierDoc, {
      roomCanon,
      labels: pairedRoomLabels(roomPairs),
    })

    // AI proposes pairings for the leftovers; the user confirms in the UI.
    let suggestions: { mine: unknown; carrier: unknown; reason: string }[] = []
    try {
      const proposed = await suggestPairings(result.mineOnly, result.carrierOnly)
      const mineByNumber = new Map(result.mineOnly.map((item) => [item.lineNumber, item]))
      const carrierByNumber = new Map(result.carrierOnly.map((item) => [item.lineNumber, item]))
      suggestions = proposed.map((s) => ({
        mine: mineByNumber.get(s.mineLineNumber),
        carrier: carrierByNumber.get(s.carrierLineNumber),
        reason: s.reason,
      }))
    } catch (suggestError) {
      console.error('[Compare v2] Pairing suggestions unavailable:', suggestError)
    }
    const recommendations = evaluateScopeRules(
      mineDoc,
      await loadScopeRules(),
      await loadDismissals(session.user.id)
    )

    let persisted = false
    let comparisonId: string | null = null
    try {
      const [mine, carrier] = [
        await persistEstimateDocument(mineOutcome, {
          userId: session.user.id,
          fileId: mineFileId,
          side: 'mine',
        }),
        await persistEstimateDocument(carrierOutcome, {
          userId: session.user.id,
          fileId: carrierFileId,
          side: 'carrier',
        }),
      ]
      const created = await prisma.estimateComparison.create({
        data: {
          userId: session.user.id,
          mineDocumentId: mine.documentId,
          carrierDocumentId: carrier.documentId,
          clientName: mineOutcome.metadata?.clientName ?? null,
          claimNumber: mineOutcome.metadata?.claimNumber ?? null,
          mineRcvCents: result.totals.mineRcvCents,
          carrierRcvCents: result.totals.carrierRcvCents,
          deltaRcvCents: result.totals.deltaRcvCents,
          matchedCount: result.pairs.length,
          mineOnlyCount: result.mineOnly.length,
          carrierOnlyCount: result.carrierOnly.length,
          matches: {
            create: [
              ...result.pairs.map((pair) => ({
                mineLineId: mine.lineIdByNumber.get(pair.mine.lineNumber) ?? null,
                carrierLineId: carrier.lineIdByNumber.get(pair.carrier.lineNumber) ?? null,
                tier: pair.tier,
                rcvDeltaCents: pair.rcvDeltaCents,
                qtyDelta: pair.qtyDelta,
              })),
              ...result.mineOnly.map((item) => ({
                mineLineId: mine.lineIdByNumber.get(item.lineNumber) ?? null,
                tier: 'mine-only',
                rcvDeltaCents: item.rcvCents,
                qtyDelta: item.quantity,
              })),
              ...result.carrierOnly.map((item) => ({
                carrierLineId: carrier.lineIdByNumber.get(item.lineNumber) ?? null,
                tier: 'carrier-only',
                rcvDeltaCents: -item.rcvCents,
                qtyDelta: -item.quantity,
              })),
            ],
          },
        },
      })
      persisted = true
      comparisonId = created.id
    } catch (persistError) {
      console.error('[Compare v2] Persistence failed:', persistError)
    }

    return NextResponse.json({
      comparisonId,
      suggestions,
      roomPairs: merged,
      roomSuggestions: roomPairs.filter((p) => p.confidence === 'suggested'),
      summary: {
        clientName: mineOutcome.metadata?.clientName ?? carrierOutcome.metadata?.clientName ?? null,
        claimNumber:
          mineOutcome.metadata?.claimNumber ?? carrierOutcome.metadata?.claimNumber ?? null,
        mineTotal: formatCents(result.totals.mineRcvCents),
        carrierTotal: formatCents(result.totals.carrierRcvCents),
        delta: formatCents(result.totals.deltaRcvCents),
        deltaRcvCents: result.totals.deltaRcvCents,
        gates: {
          mine: mineOutcome.reconciliation!.ok,
          carrier: carrierOutcome.reconciliation!.ok,
        },
        counts: {
          matched: result.pairs.length,
          differences: result.pairs.filter((p) => p.rcvDeltaCents !== 0 || p.qtyDelta !== 0).length,
          mineOnly: result.mineOnly.length,
          carrierOnly: result.carrierOnly.length,
        },
      },
      rollups,
      pairs: result.pairs,
      mineOnly: result.mineOnly,
      carrierOnly: result.carrierOnly,
      recommendations,
      persisted,
    })
  } catch (error) {
    console.error('[Compare v2] Error:', error)
    const message = error instanceof Error ? error.message : 'Comparison failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** User-confirmed room aliases (empty on DB issues). */
async function loadRoomAliases(): Promise<{ a: string; b: string }[]> {
  try {
    return await prisma.roomAlias.findMany({ select: { a: true, b: true } })
  } catch (error) {
    console.error('[Compare v2] Room alias load failed:', error)
    return []
  }
}

/** Canonicalizer over user-confirmed synonyms (empty mapping on DB issues). */
async function loadSynonymCanon(): Promise<(desc: string) => string> {
  try {
    const pairs = await prisma.descriptionSynonym.findMany({ select: { a: true, b: true } })
    return buildSynonymCanon(pairs)
  } catch (error) {
    console.error('[Compare v2] Synonym load failed:', error)
    return (desc) => desc
  }
}

/** Load, verify, and parse one side; returns the outcome or an error response. */
async function parseSide(
  userId: string,
  fileId: string,
  label: string
): Promise<[ParseOutcome, null] | [null, NextResponse]> {
  const file = await prisma.file.findUnique({ where: { id: fileId } })
  if (!file || file.userId !== userId) {
    return [null, NextResponse.json({ error: `File for ${label} not found` }, { status: 404 })]
  }
  if (!existsSync(file.path)) {
    return [
      null,
      NextResponse.json(
        { error: `File for ${label} is no longer on the server — please upload it again.` },
        { status: 404 }
      ),
    ]
  }
  const outcome = await parseEstimateFile(file.path, { aiFallback: aiExtractDocument })
  if (!outcome.document || !outcome.reconciliation) {
    return [
      null,
      NextResponse.json(
        { error: `Could not parse ${label}: ${outcome.error}` },
        { status: 422 }
      ),
    ]
  }
  return [outcome, null]
}

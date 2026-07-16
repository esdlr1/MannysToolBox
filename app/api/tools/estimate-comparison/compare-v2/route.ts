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
import { matchDocuments, roomRollups } from '@/lib/estimate-engine/match'
import { persistEstimateDocument } from '@/lib/estimate-db'
import { SEED_RULES, evaluateScopeRules } from '@/lib/scope-check/rules'

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
    const result = matchDocuments(mineDoc, carrierDoc)
    const rollups = roomRollups(mineDoc, carrierDoc)
    const recommendations = evaluateScopeRules(mineDoc, await loadRules())

    let persisted = false
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
      await prisma.estimateComparison.create({
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
    } catch (persistError) {
      console.error('[Compare v2] Persistence failed:', persistError)
    }

    return NextResponse.json({
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
  const outcome = await parseEstimateFile(file.path)
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

async function loadRules() {
  try {
    const rows = await prisma.scopeRule.findMany({ where: { status: 'approved' } })
    if (rows.length > 0) {
      return rows.map((row) => ({
        name: row.name,
        trigger: row.trigger as unknown as (typeof SEED_RULES)[number]['trigger'],
        companions: row.companions as unknown as (typeof SEED_RULES)[number]['companions'],
        priority: row.priority as (typeof SEED_RULES)[number]['priority'],
        source: row.source as (typeof SEED_RULES)[number]['source'],
        status: row.status as (typeof SEED_RULES)[number]['status'],
        reason: row.reason,
      }))
    }
  } catch (error) {
    console.error('[Compare v2] Rule load failed, using seed set:', error)
  }
  return SEED_RULES
}

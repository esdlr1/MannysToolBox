// Scope Check — pre-flight: parse one estimate PDF, persist it to the corpus,
// and report what the approved scope rules say is missing.
// Design: docs/estimate-comparison-redesign.md (addendum).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { existsSync } from 'fs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEstimateFile, formatCents } from '@/lib/estimate-engine'
import { SEED_RULES, ScopeRuleDef, evaluateScopeRules } from '@/lib/scope-check/rules'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await request.json()
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 })
    }

    const file = await prisma.file.findUnique({ where: { id: fileId } })
    if (!file || file.userId !== session.user.id) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    if (!existsSync(file.path)) {
      return NextResponse.json(
        { error: 'File no longer on server — please upload it again.' },
        { status: 404 }
      )
    }

    const outcome = await parseEstimateFile(file.path)
    if (!outcome.document || !outcome.reconciliation) {
      return NextResponse.json(
        { error: outcome.error ?? 'Could not parse this estimate', metadata: outcome.metadata },
        { status: 422 }
      )
    }
    const { document, reconciliation, metadata } = outcome

    // Persist to the corpus even when the gate fails — gate status is stored.
    // Persistence must not block the report (e.g. before db push has run).
    let persisted = false
    try {
      await prisma.estimateDocument.create({
        data: {
          userId: session.user.id,
          fileId: file.id,
          side: 'mine',
          format: outcome.format,
          parseMethod: document.parseMethod,
          gatePassed: reconciliation.ok,
          clientName: metadata?.clientName ?? null,
          claimNumber: metadata?.claimNumber ?? null,
          estimatorName: metadata?.estimatorName ?? null,
          grandRcvCents: reconciliation.printedGrandRcvCents,
          roomCount: document.rooms.length,
          itemCount: document.lineItems.length,
          warnings: document.warnings,
          lines: {
            create: document.lineItems.map((item) => ({
              lineNumber: item.lineNumber,
              room: item.room,
              code: item.catalog?.code ?? null,
              category: item.catalog?.category ?? null,
              action: item.action ?? null,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPriceCents: item.unitPriceCents,
              taxCents: item.taxCents,
              opCents: item.opCents,
              rcvCents: item.rcvCents,
              depreciationCents: item.depreciationCents,
              acvCents: item.acvCents,
              measurementBasis: item.measurementBasis ?? null,
            })),
          },
        },
      })
      persisted = true
    } catch (persistError) {
      console.error('[Scope Check] Corpus persistence failed:', persistError)
    }

    const rules = await loadRules()
    const recommendations = evaluateScopeRules(document, rules)

    return NextResponse.json({
      metadata,
      gate: {
        passed: reconciliation.ok,
        parsedTotal: formatCents(reconciliation.computedGrandRcvCents),
        printedTotal:
          reconciliation.printedGrandRcvCents !== null
            ? formatCents(reconciliation.printedGrandRcvCents)
            : null,
        messages: reconciliation.messages,
      },
      stats: {
        rooms: document.rooms.length,
        items: document.lineItems.length,
        codesResolved: document.lineItems.filter((i) => i.catalog).length,
        rulesEvaluated: rules.filter((r) => r.status === 'approved').length,
      },
      recommendations,
      persisted,
    })
  } catch (error) {
    console.error('[Scope Check] Pre-flight error:', error)
    const message = error instanceof Error ? error.message : 'Pre-flight failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DB rules when the table is seeded; in-code seed set as fallback. */
async function loadRules(): Promise<ScopeRuleDef[]> {
  try {
    const rows = await prisma.scopeRule.findMany()
    if (rows.length > 0) {
      return rows.map((row) => ({
        name: row.name,
        trigger: row.trigger as unknown as ScopeRuleDef['trigger'],
        companions: row.companions as unknown as ScopeRuleDef['companions'],
        priority: row.priority as ScopeRuleDef['priority'],
        source: row.source as ScopeRuleDef['source'],
        status: row.status as ScopeRuleDef['status'],
        reason: row.reason,
      }))
    }
  } catch (error) {
    console.error('[Scope Check] Rule load failed, using seed set:', error)
  }
  return SEED_RULES
}

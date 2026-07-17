// Reopen a stored comparison: rebuild the report from the corpus (no
// re-upload, no re-parse) using the SAME aggregation as a fresh comparison,
// so reopened comparisons look identical to live ones. Scope Check
// recommendations and room-pair suggestions aren't stored (dimensions/AI are
// not persisted), so they're omitted on reopen.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCents, ParsedDocument, ParsedLineItem } from '@/lib/estimate-engine'
import { roomRollups } from '@/lib/estimate-engine/match'
import { aggregateComparison } from '@/lib/estimate-engine/aggregate'
import { normalizeForComparison } from '@/lib/estimate-engine/normalize'

export const dynamic = 'force-dynamic'

interface StoredLine {
  lineNumber: number
  room: string
  code: string | null
  category: string | null
  action: string | null
  description: string
  quantity: number
  unit: string
  unitPriceCents: number
  taxCents: number
  opCents: number
  rcvCents: number
  depreciationCents: number
  acvCents: number
}

/** Rebuild a minimal ParsedDocument from stored line rows for aggregation. */
function toDocument(lines: StoredLine[], printedSummary: unknown): ParsedDocument {
  const summary = (printedSummary ?? {}) as { summaryRcvCents?: number | null }
  const lineItems: ParsedLineItem[] = lines.map((line) => ({
    lineNumber: line.lineNumber,
    room: line.room,
    code: line.code,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceCents: line.unitPriceCents,
    taxCents: line.taxCents,
    opCents: line.opCents,
    rcvCents: line.rcvCents,
    depreciationCents: line.depreciationCents,
    acvCents: line.acvCents,
    catalog: line.code ? { code: line.code, category: line.category, unit: null, method: 'exact' } : null,
  }))
  const roomNames = Array.from(new Set(lines.map((l) => l.room)))
  return {
    format: 'xactimate',
    parseMethod: 'deterministic',
    rooms: roomNames.map((name) => ({ name, printedTotalRcvCents: null })),
    lineItems,
    printedTotals: {
      grandRcvCents: null,
      grandAcvCents: null,
      summaryRcvCents: summary.summaryRcvCents ?? null,
    },
    warnings: [],
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const comparison = await prisma.estimateComparison.findUnique({ where: { id: params.id } })
    if (!comparison || comparison.userId !== session.user.id) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 })
    }

    const [mineDoc, carrierDoc] = await Promise.all([
      prisma.estimateDocument.findUnique({
        where: { id: comparison.mineDocumentId },
        include: { lines: true },
      }),
      prisma.estimateDocument.findUnique({
        where: { id: comparison.carrierDocumentId },
        include: { lines: true },
      }),
    ])
    if (!mineDoc || !carrierDoc) {
      return NextResponse.json({ error: 'Underlying documents were removed' }, { status: 404 })
    }

    const rawMine = toDocument(mineDoc.lines, mineDoc.printedSummary)
    const rawCarrier = toDocument(carrierDoc.lines, carrierDoc.printedSummary)
    const { mine, carrier, info: normalization } = normalizeForComparison(rawMine, rawCarrier)
    const agg = aggregateComparison(mine, carrier)
    const rollups = roomRollups(mine, carrier)

    const lineSum = (lines: { rcvCents: number }[]): number =>
      lines.reduce((sum, line) => sum + line.rcvCents, 0)
    const estimateSummaries =
      mineDoc.printedSummary || carrierDoc.printedSummary
        ? {
            mine: {
              ...((mineDoc.printedSummary as Record<string, unknown>) ?? {}),
              lineItemCents: lineSum(mineDoc.lines),
            },
            carrier: {
              ...((carrierDoc.printedSummary as Record<string, unknown>) ?? {}),
              lineItemCents: lineSum(carrierDoc.lines),
            },
          }
        : undefined

    return NextResponse.json({
      estimateSummaries,
      normalization,
      summary: {
        clientName: comparison.clientName,
        claimNumber: comparison.claimNumber,
        mineTotal: formatCents(comparison.mineRcvCents),
        carrierTotal: formatCents(comparison.carrierRcvCents),
        delta: formatCents(comparison.deltaRcvCents),
        deltaRcvCents: comparison.deltaRcvCents,
        gates: { mine: mineDoc.gatePassed, carrier: carrierDoc.gatePassed },
        counts: {
          matched: agg.pairs.length,
          differences: agg.pairs.filter((p) => p.rcvDeltaCents !== 0 || p.qtyDelta !== 0).length,
          mineOnly: agg.mineOnly.length,
          carrierOnly: agg.carrierOnly.length,
        },
      },
      rollups,
      pairs: agg.pairs,
      mineOnly: agg.mineOnly,
      carrierOnly: agg.carrierOnly,
      actionMismatches: agg.actionMismatches,
      recommendations: [],
      persisted: true,
    })
  } catch (error) {
    console.error('[Compare v2] History reopen failed:', error)
    return NextResponse.json({ error: 'Could not load comparison' }, { status: 500 })
  }
}

// Reopen a stored comparison: rebuild the full report from the corpus —
// no re-upload, no re-parse. Scope Check recommendations are not stored
// (room dimensions aren't persisted yet), so they're omitted on reopen.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCents } from '@/lib/estimate-engine'
import { normalizeRoom } from '@/lib/estimate-engine/match'

export const dynamic = 'force-dynamic'

interface StoredLine {
  id: string
  lineNumber: number
  room: string
  code: string | null
  category: string | null
  description: string
  quantity: number
  unit: string
  unitPriceCents: number
  rcvCents: number
}

function toReportItem(line: StoredLine) {
  return {
    lineNumber: line.lineNumber,
    room: line.room,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceCents: line.unitPriceCents,
    rcvCents: line.rcvCents,
    catalog: line.code ? { code: line.code, category: line.category } : null,
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const comparison = await prisma.estimateComparison.findUnique({
      where: { id: params.id },
      include: { matches: true },
    })
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

    const mineById = new Map(mineDoc.lines.map((line) => [line.id, line]))
    const carrierById = new Map(carrierDoc.lines.map((line) => [line.id, line]))

    const pairs = []
    const mineOnly = []
    const carrierOnly = []
    for (const match of comparison.matches) {
      const mine = match.mineLineId ? mineById.get(match.mineLineId) : undefined
      const carrier = match.carrierLineId ? carrierById.get(match.carrierLineId) : undefined
      if (match.tier === 'mine-only') {
        if (mine) mineOnly.push(toReportItem(mine))
      } else if (match.tier === 'carrier-only') {
        if (carrier) carrierOnly.push(toReportItem(carrier))
      } else if (mine && carrier) {
        pairs.push({
          mine: toReportItem(mine),
          carrier: toReportItem(carrier),
          tier: match.tier,
          qtyDelta: match.qtyDelta,
          rcvDeltaCents: match.rcvDeltaCents,
          unitPriceDeltaCents: mine.unitPriceCents - carrier.unitPriceCents,
        })
      }
    }

    const rollups = new Map<string, { room: string; mineRcvCents: number; carrierRcvCents: number; deltaRcvCents: number }>()
    const addRollup = (lines: StoredLine[], side: 'mine' | 'carrier') => {
      for (const line of lines) {
        const key = normalizeRoom(line.room)
        let rollup = rollups.get(key)
        if (!rollup) {
          rollup = { room: line.room, mineRcvCents: 0, carrierRcvCents: 0, deltaRcvCents: 0 }
          rollups.set(key, rollup)
        }
        rollup[side === 'mine' ? 'mineRcvCents' : 'carrierRcvCents'] += line.rcvCents
      }
    }
    addRollup(mineDoc.lines, 'mine')
    addRollup(carrierDoc.lines, 'carrier')
    const rollupList = Array.from(rollups.values())
      .map((rollup) => ({ ...rollup, deltaRcvCents: rollup.mineRcvCents - rollup.carrierRcvCents }))
      .sort((a, b) => b.deltaRcvCents - a.deltaRcvCents)

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
      summary: {
        clientName: comparison.clientName,
        claimNumber: comparison.claimNumber,
        mineTotal: formatCents(comparison.mineRcvCents),
        carrierTotal: formatCents(comparison.carrierRcvCents),
        delta: formatCents(comparison.deltaRcvCents),
        deltaRcvCents: comparison.deltaRcvCents,
        gates: { mine: mineDoc.gatePassed, carrier: carrierDoc.gatePassed },
        counts: {
          matched: comparison.matchedCount,
          differences: pairs.filter((p) => p.rcvDeltaCents !== 0 || p.qtyDelta !== 0).length,
          mineOnly: comparison.mineOnlyCount,
          carrierOnly: comparison.carrierOnlyCount,
        },
      },
      rollups: rollupList,
      pairs,
      mineOnly,
      carrierOnly,
      recommendations: [],
      persisted: true,
    })
  } catch (error) {
    console.error('[Compare v2] History reopen failed:', error)
    return NextResponse.json({ error: 'Could not load comparison' }, { status: 500 })
  }
}

// Review queue — confirm an AI-suggested pairing. Persists the match, fixes
// the stored comparison counts, and records a description synonym so the
// deterministic matcher auto-pairs this wording in every future comparison.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDescription, splitAction } from '@/lib/estimate-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { comparisonId, mineLineNumber, carrierLineNumber } = await request.json()
    if (!comparisonId || mineLineNumber === undefined || carrierLineNumber === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const comparison = await prisma.estimateComparison.findUnique({ where: { id: comparisonId } })
    if (!comparison || comparison.userId !== session.user.id) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 })
    }

    const [mineLine, carrierLine] = await Promise.all([
      prisma.estimateLine.findFirst({
        where: { documentId: comparison.mineDocumentId, lineNumber: mineLineNumber },
      }),
      prisma.estimateLine.findFirst({
        where: { documentId: comparison.carrierDocumentId, lineNumber: carrierLineNumber },
      }),
    ])
    if (!mineLine || !carrierLine) {
      return NextResponse.json({ error: 'Line items not found' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.estimateLineMatch.deleteMany({
        where: {
          comparisonId,
          OR: [
            { tier: 'mine-only', mineLineId: mineLine.id },
            { tier: 'carrier-only', carrierLineId: carrierLine.id },
          ],
        },
      }),
      prisma.estimateLineMatch.create({
        data: {
          comparisonId,
          mineLineId: mineLine.id,
          carrierLineId: carrierLine.id,
          tier: 'ai-confirmed',
          rcvDeltaCents: mineLine.rcvCents - carrierLine.rcvCents,
          qtyDelta: Math.round((mineLine.quantity - carrierLine.quantity) * 100) / 100,
        },
      }),
      prisma.estimateComparison.update({
        where: { id: comparisonId },
        data: {
          matchedCount: { increment: 1 },
          mineOnlyCount: { decrement: 1 },
          carrierOnlyCount: { decrement: 1 },
        },
      }),
    ])

    // Learn the synonym (ordered pair; ignore duplicates).
    const a = normalizeDescription(splitAction(mineLine.description).base)
    const b = normalizeDescription(splitAction(carrierLine.description).base)
    if (a !== b && a.length > 0 && b.length > 0) {
      const [first, second] = a < b ? [a, b] : [b, a]
      await prisma.descriptionSynonym
        .create({ data: { a: first, b: second } })
        .catch(() => undefined)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Compare v2] Confirm match failed:', error)
    return NextResponse.json({ error: 'Could not confirm match' }, { status: 500 })
  }
}

// Comparison history — list this user's saved comparisons.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const comparisons = await prisma.estimateComparison.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        clientName: true,
        claimNumber: true,
        mineRcvCents: true,
        carrierRcvCents: true,
        deltaRcvCents: true,
        matchedCount: true,
        mineOnlyCount: true,
        carrierOnlyCount: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ comparisons })
  } catch (error) {
    console.error('[Compare v2] History list failed:', error)
    return NextResponse.json({ error: 'Could not load history' }, { status: 500 })
  }
}

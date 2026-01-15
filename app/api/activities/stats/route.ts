import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActivityStats } from '@/lib/activities'

export const dynamic = 'force-dynamic'

/**
 * GET /api/activities/stats
 * Get activity statistics based on user role
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined

    // For now, get stats for the current user
    // TODO: For Managers/Owners, aggregate team/all stats
    const stats = await getActivityStats(user.id, {
      startDate,
      endDate,
    })

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('Error fetching activity stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity stats', details: error.message },
      { status: 500 }
    )
  }
}

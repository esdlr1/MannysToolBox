import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmployeeStats } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const stats = await getEmployeeStats(session.user.id)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Get employee stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get employee stats' },
      { status: 500 }
    )
  }
}

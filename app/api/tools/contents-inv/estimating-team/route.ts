import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isEstimatingManager } from '@/lib/contents-inv-access'

export const dynamic = 'force-dynamic'

// GET - List employees the current user (Estimating manager) can assign to
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAssign = await isEstimatingManager(session.user.id)
    if (!canAssign) {
      return NextResponse.json({ error: 'Forbidden - Estimating manager access required' }, { status: 403 })
    }

    const assignments = await prisma.managerAssignment.findMany({
      where: { managerId: session.user.id },
      select: { employeeId: true },
    })
    const employeeIds = assignments.map((a) => a.employeeId)
    if (employeeIds.length === 0) {
      return NextResponse.json({ team: [] })
    }

    const team = await prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ team })
  } catch (error) {
    console.error('[Contents INV] GET estimating-team error:', error)
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 })
  }
}

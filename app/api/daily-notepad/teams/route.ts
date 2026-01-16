import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Manager/Owner access required' },
        { status: 403 }
      )
    }

    let teams
    if (user.role === 'Manager') {
      const assignments = await prisma.managerAssignment.findMany({
        where: { managerId: session.user.id },
        select: { employeeId: true },
      })
      const employeeIds = assignments.map((a) => a.employeeId)
      teams = await prisma.team.findMany({
        where: {
          members: {
            some: {
              userId: { in: employeeIds.length > 0 ? employeeIds : ['__none__'] },
            },
          },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    } else {
      teams = await prisma.team.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    }

    return NextResponse.json({
      success: true,
      teams,
    })
  } catch (error) {
    console.error('Get teams error:', error)
    return NextResponse.json(
      { error: 'Failed to get teams' },
      { status: 500 }
    )
  }
}

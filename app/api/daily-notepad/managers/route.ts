import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    // Only Owners and Super Admins can see all managers
    if (!user || !['Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Owner access required' },
        { status: 403 }
      )
    }

    // Get all managers with their assigned employee counts
    const managers = await prisma.user.findMany({
      where: {
        role: 'Manager',
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            managedEmployees: true, // Count of assigned employees
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Get submission counts for today for each manager's employees
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const managersWithStats = await Promise.all(
      managers.map(async (manager) => {
        // Get assigned employee IDs
        const assignments = await prisma.managerAssignment.findMany({
          where: { managerId: manager.id },
          select: { employeeId: true },
        })
        const employeeIds = assignments.map((a) => a.employeeId)

        // Get today's submission count
        const todaySubmissions = await prisma.dailyNotepadSubmission.count({
          where: {
            userId: { in: employeeIds },
            date: today,
          },
        })

        return {
          id: manager.id,
          name: manager.name,
          email: manager.email,
          assignedEmployeesCount: manager._count.managedEmployees,
          todaySubmissions: todaySubmissions,
          missingToday: Math.max(0, manager._count.managedEmployees - todaySubmissions),
        }
      })
    )

    return NextResponse.json({
      success: true,
      managers: managersWithStats,
    })
  } catch (error) {
    console.error('Get managers error:', error)
    return NextResponse.json(
      { error: 'Failed to get managers' },
      { status: 500 }
    )
  }
}

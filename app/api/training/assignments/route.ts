import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

// GET - Get training assignments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const courseId = searchParams.get('courseId')
    const status = searchParams.get('status')

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    // Build where clause based on role
    const where: any = {}
    
    if (user?.role === 'Employee') {
      // Employees can only see their own assignments
      where.employeeId = session.user.id
    } else if (user?.role === 'Manager') {
      // Managers can see assignments for everyone in their subtree (direct + indirect reports)
      const employeeIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      where.employeeId = { in: employeeIds }
    }
    // Owners/Admins can see all

    if (employeeId) {
      where.employeeId = employeeId
    }
    if (courseId) {
      where.courseId = courseId
    }
    if (status) {
      where.status = status
    }

    const trainingAssignments = await prisma.employeeTraining.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            category: true,
            duration: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      assignments: trainingAssignments.map(assignment => ({
        id: assignment.id,
        employee: assignment.employee,
        course: assignment.course,
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        startedAt: assignment.startedAt,
        completedAt: assignment.completedAt,
        progress: assignment.progress,
        status: assignment.status,
        notes: assignment.notes,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Get assignments error:', error)
    return NextResponse.json(
      { error: 'Failed to get assignments' },
      { status: 500 }
    )
  }
}

// POST - Assign a course to employees
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Manager/Owner/Admin
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

    const { courseId, employeeIds, dueDate } = await request.json()

    if (!courseId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: 'Course ID and employee IDs are required' },
        { status: 400 }
      )
    }

    // Check if manager can assign to these employees (must all be in manager's subtree)
    if (user.role === 'Manager') {
      const allowedIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      const allowedSet = new Set(allowedIds)
      const invalidIds = employeeIds.filter((id: string) => !allowedSet.has(id))
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: 'You can only assign training to employees in your team' },
          { status: 403 }
        )
      }
    }

    // Create assignments
    const assignments = await Promise.all(
      employeeIds.map((employeeId: string) =>
        prisma.employeeTraining.upsert({
          where: {
            employeeId_courseId: {
              employeeId,
              courseId,
            },
          },
          update: {
            assignedById: session.user.id,
            assignedAt: new Date(),
            ...(dueDate && { dueDate: new Date(dueDate) }),
            status: 'assigned',
          },
          create: {
            employeeId,
            courseId,
            assignedById: session.user.id,
            ...(dueDate && { dueDate: new Date(dueDate) }),
            status: 'assigned',
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      assignments: assignments.map(a => ({
        id: a.id,
        employeeId: a.employeeId,
        courseId: a.courseId,
        status: a.status,
      })),
    })
  } catch (error) {
    console.error('Assign training error:', error)
    return NextResponse.json(
      { error: 'Failed to assign training' },
      { status: 500 }
    )
  }
}

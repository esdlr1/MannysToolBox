import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

// PUT - Update training assignment (progress, status, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { progress, status, notes, startedAt, completedAt } = await request.json()

    // Check if user owns this assignment or is a manager/owner
    const assignment = await prisma.employeeTraining.findUnique({
      where: { id: params.id },
      select: {
        employeeId: true,
        assignedById: true,
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    // Employees can only update their own assignments
    if (user?.role === 'Employee' && assignment.employeeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own assignments' },
        { status: 403 }
      )
    }
    // Managers can only update assignments for employees in their subtree
    if (user?.role === 'Manager') {
      const allowedIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      if (!allowedIds.includes(assignment.employeeId)) {
        return NextResponse.json(
          { error: 'Forbidden - You can only update assignments for employees in your team' },
          { status: 403 }
        )
      }
    }

    const updateData: any = {}
    if (progress !== undefined) updateData.progress = parseInt(progress)
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (startedAt !== undefined) updateData.startedAt = startedAt ? new Date(startedAt) : null
    if (completedAt !== undefined) {
      updateData.completedAt = completedAt ? new Date(completedAt) : null
      if (completedAt && !updateData.progress) {
        updateData.progress = 100
      }
    }

    // Auto-update status based on progress
    if (updateData.progress !== undefined) {
      if (updateData.progress === 0 && !updateData.status) {
        updateData.status = 'assigned'
      } else if (updateData.progress > 0 && updateData.progress < 100 && !updateData.status) {
        updateData.status = 'in_progress'
        if (!updateData.startedAt) {
          updateData.startedAt = new Date()
        }
      } else if (updateData.progress === 100 && !updateData.status) {
        updateData.status = 'completed'
        if (!updateData.completedAt) {
          updateData.completedAt = new Date()
        }
      }
    }

    const updated = await prisma.employeeTraining.update({
      where: { id: params.id },
      data: updateData,
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
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      assignment: {
        id: updated.id,
        employee: updated.employee,
        course: updated.course,
        progress: updated.progress,
        status: updated.status,
        notes: updated.notes,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
        dueDate: updated.dueDate,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error('Update assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    )
  }
}

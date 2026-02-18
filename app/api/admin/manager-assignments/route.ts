import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwnerOrSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireOwnerOrSuperAdmin()
    if ('error' in auth) return auth.error

    const managers = await prisma.user.findMany({
      where: { role: 'Manager', isApproved: true },
      select: { id: true, name: true, email: true, role: true, isApproved: true },
      orderBy: { name: 'asc' },
    })

    // Get users who can be promoted to Manager (not already Manager, Owner, or Super Admin)
    const potentialManagers = await prisma.user.findMany({
      where: {
        role: { notIn: ['Manager', 'Owner', 'Super Admin'] },
      },
      select: { id: true, name: true, email: true, role: true, isApproved: true },
      orderBy: { name: 'asc' },
    })

    // All users show in the list so you can change anyone's position (who they report to)
    const employees = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })

    const assignments = await prisma.managerAssignment.findMany({
      select: { managerId: true, employeeId: true },
    })

    return NextResponse.json({
      success: true,
      managers,
      potentialManagers,
      employees,
      assignments,
    })
  } catch (error) {
    console.error('Get manager assignments error:', error)
    return NextResponse.json(
      { error: 'Failed to load assignments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwnerOrSuperAdmin()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { managerId, employeeId, assigned } = body

    if (!managerId || !employeeId) {
      return NextResponse.json(
        { error: 'managerId and employeeId are required' },
        { status: 400 }
      )
    }

    if (assigned) {
      if (managerId === employeeId) {
        return NextResponse.json(
          { error: 'A person cannot report to themselves' },
          { status: 400 }
        )
      }
      await prisma.managerAssignment.upsert({
        where: {
          managerId_employeeId: { managerId, employeeId },
        },
        create: { managerId, employeeId },
        update: {},
      })
    } else {
      await prisma.managerAssignment.deleteMany({
        where: { managerId, employeeId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update manager assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireOwnerOrSuperAdmin()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { userId, action } = body

    if (!userId || action !== 'promote') {
      return NextResponse.json(
        { error: 'userId and action are required' },
        { status: 400 }
      )
    }

    // Promote user to Manager role and approve them
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: 'Manager',
        isApproved: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Promote to manager error:', error)
    return NextResponse.json(
      { error: 'Failed to promote user to manager' },
      { status: 500 }
    )
  }
}

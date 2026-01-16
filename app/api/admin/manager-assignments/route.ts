import { NextRequest, NextResponse } from 'next/server'
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const managers = await prisma.user.findMany({
      where: { role: 'Manager', isApproved: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    const employees = await prisma.user.findMany({
      where: { role: 'Employee' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    const assignments = await prisma.managerAssignment.findMany({
      select: { managerId: true, employeeId: true },
    })

    return NextResponse.json({
      success: true,
      managers,
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { managerId, employeeId, assigned } = body

    if (!managerId || !employeeId) {
      return NextResponse.json(
        { error: 'managerId and employeeId are required' },
        { status: 400 }
      )
    }

    if (assigned) {
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

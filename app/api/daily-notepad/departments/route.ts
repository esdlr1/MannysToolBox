import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope } from '@/lib/daily-notepad'

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

    let departments
    if (user.role === 'Manager') {
      const employeeIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      departments = await prisma.department.findMany({
        where: {
          users: {
            some: {
              id: { in: employeeIds.length > 0 ? employeeIds : ['__none__'] },
            },
          },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    } else {
      departments = await prisma.department.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    }

    return NextResponse.json({
      success: true,
      departments,
    })
  } catch (error) {
    console.error('Get departments error:', error)
    return NextResponse.json(
      { error: 'Failed to get departments' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope, parseTagsFromQuery } from '@/lib/daily-notepad'

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

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Manager/Owner access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId') || undefined
    const departmentId = searchParams.get('departmentId') || undefined
    const managerFilterId = searchParams.get('managerId') || undefined
    const tags = parseTagsFromQuery(searchParams)
    // Managers can only see their own employees
    // Owners can filter by any manager or see all
    const managerId = user.role === 'Manager'
      ? session.user.id
      : (managerFilterId || undefined)

    const employeeIds = await getEmployeeIdsForScope({ teamId, departmentId, managerId, tags: tags.length ? tags : undefined })

    const employees = await prisma.user.findMany({
      where: {
        id: { in: employeeIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      employees,
    })
  } catch (error) {
    console.error('Get employees error:', error)
    return NextResponse.json(
      { error: 'Failed to get employees' },
      { status: 500 }
    )
  }
}

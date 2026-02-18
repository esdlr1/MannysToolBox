import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSubmissionStats, getMissingSubmissions, getTodayDate, isWorkday, getEmployeeIdsForScope, parseTagsFromQuery } from '@/lib/daily-notepad'
import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth } from 'date-fns'

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

    // Check if user is manager/owner/admin
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
    const period = searchParams.get('period') || 'today' // today, week, month
    const departmentId = searchParams.get('departmentId') || undefined
    const managerFilterId = searchParams.get('managerId') || undefined
    const tags = parseTagsFromQuery(searchParams)
    const scopeFilters = { departmentId, managerId: user.role === 'Manager' ? session.user.id : (managerFilterId || undefined), tags: tags.length ? tags : undefined }
    // Managers can only see their own employees
    // Owners can filter by any manager or see all
    const managerId = scopeFilters.managerId

    const today = getTodayDate()
    let startDate: Date
    let endDate: Date = today

    switch (period) {
      case 'week':
        startDate = startOfWeek(today)
        endDate = endOfWeek(today)
        break
      case 'month':
        startDate = startOfMonth(today)
        endDate = endOfMonth(today)
        break
      default:
        startDate = today
        endDate = today
    }

    // Get statistics
    const stats = await getSubmissionStats(startDate, endDate, scopeFilters)

    // Get today's missing submissions
    const missingToday = isWorkday(today)
      ? await getMissingSubmissions(today, scopeFilters)
      : []

    // Get total employees
    const employeeIds = await getEmployeeIdsForScope(scopeFilters)
    const totalEmployees = employeeIds.length

    // Calculate today's stats
    const todaySubmissions = await prisma.dailyNotepadSubmission.count({
      where: {
        date: today,
        ...(employeeIds.length > 0 ? { userId: { in: employeeIds } } : {}),
      },
    })

    const submissionRate = totalEmployees > 0 ? (todaySubmissions / totalEmployees) * 100 : 0

    return NextResponse.json({
      success: true,
      stats: {
        period,
        startDate,
        endDate,
        totalEmployees,
        today: {
          submitted: todaySubmissions,
          missing: missingToday.length,
          submissionRate,
        },
        missingEmployees: missingToday.map(emp => ({
          id: emp.id,
          email: emp.email,
          name: emp.name,
        })),
        periodStats: stats.stats,
      },
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    )
  }
}

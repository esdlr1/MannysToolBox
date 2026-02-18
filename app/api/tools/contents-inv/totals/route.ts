import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isEstimatingManager } from '@/lib/contents-inv-access'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

function getPeriodBounds(period: string, dateStr: string | null): { start: Date; end: Date } {
  const base = dateStr ? new Date(dateStr) : new Date()
  if (period === 'day') {
    return { start: startOfDay(base), end: endOfDay(base) }
  }
  if (period === 'week') {
    return { start: startOfWeek(base, { weekStartsOn: 1 }), end: endOfWeek(base, { weekStartsOn: 1 }) }
  }
  if (period === 'month') {
    return { start: startOfMonth(base), end: endOfMonth(base) }
  }
  // default day
  return { start: startOfDay(base), end: endOfDay(base) }
}

// GET - Aggregated totalAmount for completed submissions in a period
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'day'
    const dateStr = searchParams.get('date') || null
    const employeeIdParam = searchParams.get('employeeId') || null

    const { start, end } = getPeriodBounds(period, dateStr)

    const isManager = await isEstimatingManager(session.user.id)

    if (!isManager) {
      // Employee: only their own completed submissions in period
      const list = await prisma.contentsInvSubmission.findMany({
        where: {
          status: 'completed',
          assignedToId: session.user.id,
          completedAt: { gte: start, lte: end },
        },
        select: { totalAmount: true },
      })
      const total = list.reduce((sum, r) => sum + Number(r.totalAmount ?? 0), 0)
      return NextResponse.json({
        total: Math.round(total * 100) / 100,
        period,
        start: start.toISOString(),
        end: end.toISOString(),
      })
    }

    // Manager: team total or single employee
    const { getEmployeeIdsUnderManager } = await import('@/lib/org-hierarchy')
    const teamIds = await getEmployeeIdsUnderManager(session.user.id)
    const assigneeIds = teamIds.size > 0 ? Array.from(teamIds) : []

    if (assigneeIds.length === 0) {
      return NextResponse.json({
        total: 0,
        byEmployee: [],
        period,
        start: start.toISOString(),
        end: end.toISOString(),
      })
    }

    if (employeeIdParam && assigneeIds.includes(employeeIdParam)) {
      // Single employee total
      const list = await prisma.contentsInvSubmission.findMany({
        where: {
          status: 'completed',
          assignedToId: employeeIdParam,
          completedAt: { gte: start, lte: end },
        },
        select: { totalAmount: true },
      })
      const total = list.reduce((sum, r) => sum + Number(r.totalAmount ?? 0), 0)
      return NextResponse.json({
        total: Math.round(total * 100) / 100,
        employeeId: employeeIdParam,
        period,
        start: start.toISOString(),
        end: end.toISOString(),
      })
    }

    // Team total with breakdown by employee
    const list = await prisma.contentsInvSubmission.findMany({
      where: {
        status: 'completed',
        assignedToId: { in: assigneeIds },
        completedAt: { gte: start, lte: end },
      },
      select: { assignedToId: true, totalAmount: true },
    })

    const byEmployeeMap = new Map<string, number>()
    let total = 0
    for (const r of list) {
      const id = r.assignedToId ?? 'unassigned'
      const amt = Number(r.totalAmount ?? 0)
      byEmployeeMap.set(id, (byEmployeeMap.get(id) ?? 0) + amt)
      total += amt
    }

    const userIds = Array.from(byEmployeeMap.keys()).filter((id) => id !== 'unassigned')
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    const byEmployee = users.map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      total: Math.round((byEmployeeMap.get(u.id) ?? 0) * 100) / 100,
    }))

    return NextResponse.json({
      total: Math.round(total * 100) / 100,
      byEmployee,
      period,
      start: start.toISOString(),
      end: end.toISOString(),
    })
  } catch (error) {
    console.error('[Contents INV] GET totals error:', error)
    return NextResponse.json({ error: 'Failed to fetch totals' }, { status: 500 })
  }
}

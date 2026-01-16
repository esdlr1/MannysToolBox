import { prisma } from '@/lib/prisma'
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

/**
 * Check if a date is a weekday (Monday-Friday)
 */
export function isWorkday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5 // Monday = 1, Friday = 5
}

/**
 * Check if submission is before 9 AM deadline
 */
export function isBeforeDeadline(date: Date): boolean {
  const deadline = new Date(date)
  deadline.setHours(9, 0, 0, 0)
  return date < deadline
}

/**
 * Get today's date in the user's timezone (date only, no time)
 */
export function getTodayDate(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getPreviousWorkday(date: Date): Date {
  let cursor = subDays(date, 1)
  while (!isWorkday(cursor)) {
    cursor = subDays(cursor, 1)
  }
  return cursor
}

async function getEmployeesForScope(filters?: { teamId?: string; departmentId?: string }) {
  const { teamId, departmentId } = filters || {}
  const baseEmployees = await prisma.user.findMany({
    where: {
      role: 'Employee',
      ...(departmentId ? { departmentId } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  if (!teamId) {
    return baseEmployees
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  })
  const teamMemberIds = new Set(teamMembers.map((m) => m.userId))
  return baseEmployees.filter((emp) => teamMemberIds.has(emp.id))
}

export async function getEmployeeIdsForScope(filters?: { teamId?: string; departmentId?: string }) {
  const employees = await getEmployeesForScope(filters)
  return employees.map((emp) => emp.id)
}

/**
 * Get all submissions for a user on a specific date
 */
export async function getTodaysSubmissions(userId: string, date?: Date) {
  const targetDate = date || getTodayDate()
  
  return await prisma.dailyNotepadSubmission.findMany({
    where: {
      userId,
      date: targetDate,
    },
    orderBy: {
      submittedAt: 'desc',
    },
    include: {
      reviewedBy: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  })
}

/**
 * Get all employees who haven't submitted for a specific date
 */
export async function getMissingSubmissions(
  date: Date,
  filters?: { teamId?: string; departmentId?: string }
) {
  const employees = await getEmployeesForScope(filters)

  // Get all submissions for that date
  const submissions = await prisma.dailyNotepadSubmission.findMany({
    where: {
      date,
      ...(filters?.teamId || filters?.departmentId
        ? {
            userId: {
              in: employees.map((emp) => emp.id),
            },
          }
        : {}),
    },
    select: {
      userId: true,
    },
  })

  const submittedUserIds = new Set(submissions.map(s => s.userId))
  
  // Find employees who haven't submitted
  const missing = employees.filter(emp => !submittedUserIds.has(emp.id))
  
  return missing
}

/**
 * Get submission statistics for a date range
 */
export async function getSubmissionStats(
  startDate: Date,
  endDate: Date,
  filters?: { teamId?: string; departmentId?: string }
) {
  const scopedEmployees = await getEmployeesForScope(filters)
  const employeeIds = scopedEmployees.map((emp) => emp.id)
  const employees = scopedEmployees.length

  const submissions = await prisma.dailyNotepadSubmission.groupBy({
    by: ['date'],
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
      ...(filters?.teamId || filters?.departmentId
        ? {
            userId: {
              in: employeeIds,
            },
          }
        : {}),
    },
    _count: {
      id: true,
    },
  })

  const stats = submissions.map(sub => ({
    date: sub.date,
    submittedCount: sub._count.id,
    missingCount: Math.max(0, employees - sub._count.id),
    submissionRate: employees > 0 ? (sub._count.id / employees) * 100 : 0,
  }))

  return {
    totalEmployees: employees,
    stats,
  }
}

/**
 * Get all submissions with filters
 */
export async function getSubmissions(filters: {
  date?: Date
  userId?: string
  teamId?: string
  startDate?: Date
  endDate?: Date
  departmentId?: string
}) {
  const where: any = {}

  if (filters.date) {
    where.date = filters.date
  }

  if (filters.startDate && filters.endDate) {
    where.date = {
      gte: filters.startDate,
      lte: filters.endDate,
    }
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.teamId || filters.departmentId) {
    // Get user IDs for this team
    const employees = await getEmployeesForScope({
      teamId: filters.teamId,
      departmentId: filters.departmentId,
    })
    where.userId = { in: employees.map((e) => e.id) }
  }

  return await prisma.dailyNotepadSubmission.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      comments: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
    orderBy: {
      submittedAt: 'desc',
    },
  })
}

/**
 * Get submission by ID
 */
export async function getSubmissionById(id: string) {
  return await prisma.dailyNotepadSubmission.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      comments: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })
}

export async function getEmployeeStats(userId: string) {
  const today = getTodayDate()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const submissions = await prisma.dailyNotepadSubmission.findMany({
    where: {
      userId,
      date: {
        gte: subDays(today, 120),
        lte: monthEnd,
      },
    },
    select: {
      date: true,
    },
  })

  const submittedDates = new Set(submissions.map((s) => toDateKey(s.date)))

  const workdaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(isWorkday)
  const submittedInMonth = workdaysInMonth.filter((day) => submittedDates.has(toDateKey(day))).length
  const monthlyCompliance = workdaysInMonth.length > 0
    ? (submittedInMonth / workdaysInMonth.length) * 100
    : 0

  let cursor = today
  while (!isWorkday(cursor)) {
    cursor = getPreviousWorkday(cursor)
  }

  let streak = 0
  if (submittedDates.has(toDateKey(cursor))) {
    while (submittedDates.has(toDateKey(cursor))) {
      streak += 1
      cursor = getPreviousWorkday(cursor)
    }
  }

  return {
    streak,
    monthlyCompliance,
    submittedInMonth,
    totalWorkdaysInMonth: workdaysInMonth.length,
  }
}

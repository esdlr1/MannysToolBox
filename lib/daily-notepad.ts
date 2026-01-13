import { prisma } from '@/lib/prisma'

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
  })
}

/**
 * Get all employees who haven't submitted for a specific date
 */
export async function getMissingSubmissions(date: Date) {
  // Get all employees
  const employees = await prisma.user.findMany({
    where: {
      role: 'Employee',
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  // Get all submissions for that date
  const submissions = await prisma.dailyNotepadSubmission.findMany({
    where: {
      date,
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
export async function getSubmissionStats(startDate: Date, endDate: Date) {
  const employees = await prisma.user.count({
    where: {
      role: 'Employee',
    },
  })

  const submissions = await prisma.dailyNotepadSubmission.groupBy({
    by: ['date'],
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
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

  if (filters.teamId) {
    // Get user IDs for this team
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: filters.teamId,
      },
      select: {
        userId: true,
      },
    })
    const userIds = teamMembers.map(m => m.userId)
    where.userId = {
      in: userIds,
    }
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

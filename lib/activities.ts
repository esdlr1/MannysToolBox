import { prisma } from './prisma'

export interface CreateActivityParams {
  userId: string
  type: 'tool_used' | 'notepad_submitted' | 'estimate_compared' | 'work_saved' | 'announcement_created' | 'other'
  toolId?: string
  action: string
  metadata?: Record<string, any>
}

/**
 * Create a new activity record
 */
export async function createActivity(params: CreateActivityParams) {
  try {
    const activity = await prisma.activity.create({
      data: {
        userId: params.userId,
        type: params.type,
        toolId: params.toolId || null,
        action: params.action,
        metadata: params.metadata || undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return activity
  } catch (error) {
    console.error('Error creating activity:', error)
    throw error
  }
}

/**
 * Get activities for a user
 */
export async function getUserActivities(
  userId: string,
  options?: {
    limit?: number
    type?: string
    startDate?: Date
    endDate?: Date
  }
) {
  try {
    const where: any = {
      userId,
    }

    if (options?.type) {
      where.type = options.type
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) {
        where.createdAt.gte = options.startDate
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate
      }
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 50,
    })

    return activities
  } catch (error) {
    console.error('Error fetching user activities:', error)
    throw error
  }
}

/**
 * Get activities for a manager's team
 */
export async function getTeamActivities(
  managerId: string,
  options?: {
    limit?: number
    type?: string
    startDate?: Date
    endDate?: Date
  }
) {
  try {
    // Get all employees (for now, managers see all employees)
    // TODO: Implement team/department filtering when teams are set up
    const where: any = {
      user: {
        role: 'Employee',
      },
    }

    if (options?.type) {
      where.type = options.type
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) {
        where.createdAt.gte = options.startDate
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate
      }
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 100,
    })

    return activities
  } catch (error) {
    console.error('Error fetching team activities:', error)
    throw error
  }
}

/**
 * Get all activities (for Owners/Super Admins)
 */
export async function getAllActivities(
  options?: {
    limit?: number
    type?: string
    userId?: string
    startDate?: Date
    endDate?: Date
  }
) {
  try {
    const where: any = {}

    if (options?.type) {
      where.type = options.type
    }

    if (options?.userId) {
      where.userId = options.userId
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) {
        where.createdAt.gte = options.startDate
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate
      }
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 100,
    })

    return activities
  } catch (error) {
    console.error('Error fetching all activities:', error)
    throw error
  }
}

/**
 * Get activity statistics
 */
export async function getActivityStats(
  userId?: string,
  options?: {
    startDate?: Date
    endDate?: Date
  }
) {
  try {
    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) {
        where.createdAt.gte = options.startDate
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate
      }
    }

    const [total, byType, recent] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.groupBy({
        by: ['type'],
        where,
        _count: {
          type: true,
        },
      }),
      prisma.activity.findMany({
        where,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ])

    return {
      total,
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count.type,
      })),
      recent,
    }
  } catch (error) {
    console.error('Error fetching activity stats:', error)
    throw error
  }
}

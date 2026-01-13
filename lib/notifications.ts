import { prisma } from '@/lib/prisma'

export type NotificationType = 
  | 'submission'
  | 'reminder'
  | 'confirmation'
  | 'summary'
  | 'comment'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, any>
}

/**
 * Create a new notification
 */
export async function createNotification(params: CreateNotificationParams) {
  return await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || null,
    },
  })
}

/**
 * Get all notifications for a user
 */
export async function getNotifications(userId: string, unreadOnly = false) {
  return await prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly && { read: false }),
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string) {
  return await prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  })
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  return await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId, // Ensure user can only mark their own notifications
    },
    data: {
      read: true,
    },
  })
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
    },
  })
}

/**
 * Notify managers/owners when an employee submits
 */
export async function notifyManagersOnSubmission(
  employeeId: string,
  employeeName: string | null,
  submissionId: string
) {
  const managers = await prisma.user.findMany({
    where: {
      role: {
        in: ['Manager', 'Owner', 'Super Admin'],
      },
      isApproved: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  for (const manager of managers) {
    await createNotification({
      userId: manager.id,
      type: 'submission',
      title: `${employeeName || 'An employee'} submitted daily notepad`,
      message: `${employeeName || 'An employee'} has submitted their daily notepad.`,
      metadata: {
        submissionId,
        employeeId,
      },
    })
  }
}

import { prisma } from '@/lib/prisma'

export interface CreateAnnouncementParams {
  title: string
  message: string
  authorId: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  category?: string
  pinned?: boolean
}

export interface UpdateAnnouncementParams {
  title?: string
  message?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  category?: string
  pinned?: boolean
}

/**
 * Create a new announcement
 */
export async function createAnnouncement(params: CreateAnnouncementParams) {
  return await prisma.announcement.create({
    data: {
      title: params.title,
      message: params.message,
      authorId: params.authorId,
      priority: params.priority || 'normal',
      category: params.category || null,
      pinned: params.pinned || false,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

/**
 * Get all announcements, ordered by pinned first, then newest first
 */
export async function getAnnouncements(limit?: number) {
  const announcements = await prisma.announcement.findMany({
    orderBy: [
      { pinned: 'desc' }, // Pinned announcements first
      { createdAt: 'desc' }, // Then newest first
    ],
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    take: limit,
  })

  return announcements
}

/**
 * Get latest N announcements (for dashboard)
 */
export async function getLatestAnnouncements(count: number = 3) {
  return await getAnnouncements(count)
}

/**
 * Get a single announcement by ID
 */
export async function getAnnouncementById(id: string) {
  return await prisma.announcement.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(
  id: string,
  params: UpdateAnnouncementParams
) {
  return await prisma.announcement.update({
    where: { id },
    data: {
      ...(params.title && { title: params.title }),
      ...(params.message && { message: params.message }),
      ...(params.priority && { priority: params.priority }),
      ...(params.category !== undefined && { category: params.category || null }),
      ...(params.pinned !== undefined && { pinned: params.pinned }),
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(id: string) {
  return await prisma.announcement.delete({
    where: { id },
  })
}

/**
 * Check if user can create announcements
 */
export function canCreateAnnouncement(role: string | null | undefined): boolean {
  if (!role) return false
  return ['Super Admin', 'Owner', 'Manager'].includes(role)
}

/**
 * Check if user can edit/delete announcements
 */
export function canManageAnnouncement(
  userRole: string | null | undefined,
  announcementAuthorId: string,
  userId: string
): boolean {
  if (!userRole) return false
  
  // Super Admin and Owner can manage all announcements
  if (['Super Admin', 'Owner'].includes(userRole)) {
    return true
  }
  
  // Managers can manage their own announcements
  if (userRole === 'Manager' && announcementAuthorId === userId) {
    return true
  }
  
  return false
}

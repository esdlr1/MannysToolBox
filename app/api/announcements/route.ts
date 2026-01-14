import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createAnnouncement,
  getAnnouncements,
  canCreateAnnouncement,
} from '@/lib/announcements'
import { createNotification } from '@/lib/notifications'
import { sendAnnouncementEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/announcements
 * Get all announcements (latest first, pinned first)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined

    const announcements = await getAnnouncements(limit)

    return NextResponse.json({ announcements })
  } catch (error: any) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch announcements', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/announcements
 * Create a new announcement (Super Admin, Owner, Manager only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!canCreateAnnouncement(user?.role || null)) {
      return NextResponse.json(
        { error: 'You do not have permission to create announcements' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, message, priority, category, pinned } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      )
    }

    // Create announcement
    const announcement = await createAnnouncement({
      title,
      message,
      authorId: session.user.id,
      priority: priority || 'normal',
      category: category || null,
      pinned: pinned || false,
    })

    // Notify all employees (in-app notifications)
    const employees = await prisma.user.findMany({
      where: {
        role: 'Employee',
        isApproved: true,
      },
      select: { id: true, email: true, name: true },
    })

    // Create in-app notifications for all employees
    const notificationPromises = employees.map((employee) =>
      createNotification({
        userId: employee.id,
        type: 'announcement',
        title: `New Announcement: ${title}`,
        message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
        metadata: {
          announcementId: announcement.id,
          priority: priority || 'normal',
        },
      })
    )

    await Promise.all(notificationPromises)

    // Send email notifications (async, don't wait)
    employees.forEach((employee) => {
      sendAnnouncementEmail({
        to: employee.email,
        name: employee.name || 'Employee',
        announcementTitle: title,
        announcementMessage: message,
        priority: priority || 'normal',
        authorName: session.user?.name || 'Management',
      }).catch((error) => {
        console.error(`Failed to send email to ${employee.email}:`, error)
      })
    })

    return NextResponse.json(
      { announcement, message: 'Announcement created and notifications sent' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating announcement:', error)
    return NextResponse.json(
      { error: 'Failed to create announcement', details: error.message },
      { status: 500 }
    )
  }
}

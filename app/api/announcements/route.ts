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
    
    // If it's a database connection error, return empty array instead of error
    // This allows the UI to still render even if DB is unavailable
    if (error.message?.includes('database') || error.message?.includes('connection') || error.message?.includes('credentials')) {
      console.warn('Database connection issue - returning empty announcements array')
      return NextResponse.json({ announcements: [] })
    }
    
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

    // Check database connection first
    let user
    try {
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    } catch (dbError: any) {
      console.error('Database error when checking user:', dbError)
      if (dbError.message?.includes('database') || dbError.message?.includes('connection') || dbError.message?.includes('credentials')) {
        return NextResponse.json(
          { error: 'Database connection failed. Please check your database configuration.' },
          { status: 503 }
        )
      }
      throw dbError
    }

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
    let announcement
    try {
      announcement = await createAnnouncement({
        title,
        message,
        authorId: session.user.id,
        priority: priority || 'normal',
        category: category || null,
        pinned: pinned || false,
      })
    } catch (dbError: any) {
      console.error('Database error when creating announcement:', dbError)
      if (dbError.message?.includes('database') || dbError.message?.includes('connection') || dbError.message?.includes('credentials')) {
        return NextResponse.json(
          { error: 'Database connection failed. Unable to create announcement. Please check your database configuration.' },
          { status: 503 }
        )
      }
      throw dbError
    }

    // Notify all employees (in-app notifications) - don't fail if this errors
    try {
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
        }).catch((err) => {
          console.error(`Failed to create notification for ${employee.email}:`, err)
          return null
        })
      )

      await Promise.all(notificationPromises)
    } catch (notifError) {
      console.error('Error creating notifications (non-fatal):', notifError)
      // Continue even if notifications fail
    }

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

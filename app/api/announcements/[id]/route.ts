import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  canManageAnnouncement,
} from '@/lib/announcements'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/announcements/[id]
 * Get a single announcement by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const announcement = await getAnnouncementById(params.id)

    if (!announcement) {
      return NextResponse.json(
        { error: 'Announcement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ announcement })
  } catch (error: any) {
    console.error('Error fetching announcement:', error)
    return NextResponse.json(
      { error: 'Failed to fetch announcement', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/announcements/[id]
 * Update an announcement (author, Super Admin, Owner only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const announcement = await getAnnouncementById(params.id)

    if (!announcement) {
      return NextResponse.json(
        { error: 'Announcement not found' },
        { status: 404 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (
      !canManageAnnouncement(
        user?.role || null,
        announcement.authorId,
        session.user.id
      )
    ) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this announcement' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, message, priority, category, pinned } = body

    const updated = await updateAnnouncement(params.id, {
      title,
      message,
      priority,
      category,
      pinned,
    })

    return NextResponse.json({ announcement: updated })
  } catch (error: any) {
    console.error('Error updating announcement:', error)
    return NextResponse.json(
      { error: 'Failed to update announcement', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/announcements/[id]
 * Delete an announcement (author, Super Admin, Owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const announcement = await getAnnouncementById(params.id)

    if (!announcement) {
      return NextResponse.json(
        { error: 'Announcement not found' },
        { status: 404 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (
      !canManageAnnouncement(
        user?.role || null,
        announcement.authorId,
        session.user.id
      )
    ) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this announcement' },
        { status: 403 }
      )
    }

    await deleteAnnouncement(params.id)

    return NextResponse.json({ message: 'Announcement deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting announcement:', error)
    return NextResponse.json(
      { error: 'Failed to delete announcement', details: error.message },
      { status: 500 }
    )
  }
}

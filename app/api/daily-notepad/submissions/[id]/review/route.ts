import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    if (user.role === 'Manager') {
      const submission = await prisma.dailyNotepadSubmission.findUnique({
        where: { id: params.id },
        select: { userId: true },
      })
      if (!submission) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        )
      }
      const allowedIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      if (!allowedIds.includes(submission.userId)) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { reviewStatus, reviewNote } = body

    if (!reviewStatus || !['ok', 'needs_follow_up'].includes(reviewStatus)) {
      return NextResponse.json(
        { error: 'Invalid review status' },
        { status: 400 }
      )
    }

    const updated = await prisma.dailyNotepadSubmission.update({
      where: { id: params.id },
      data: {
        reviewStatus,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
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

    return NextResponse.json({
      success: true,
      submission: {
        id: updated.id,
        reviewStatus: updated.reviewStatus,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt,
        reviewedBy: updated.reviewedBy,
      },
    })
  } catch (error) {
    console.error('Review submission error:', error)
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    )
  }
}

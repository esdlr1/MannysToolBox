import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSubmissionById, getEmployeeIdsForScope } from '@/lib/daily-notepad'
import { prisma } from '@/lib/prisma'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET(
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

    const submission = await getSubmissionById(params.id)

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    // Check if user has access (owner, manager/admin, or the employee who submitted)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isOwner = submission.userId === session.user.id
    const isManager = user?.role && ['Manager', 'Owner', 'Super Admin'].includes(user.role)
    const isOwnerOrAdmin = user?.role && ['Owner', 'Super Admin'].includes(user.role)

    if (!isOwner && !isManager) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    if (!isOwner && user?.role === 'Manager' && !isOwnerOrAdmin) {
      const allowedIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      if (!allowedIds.includes(submission.userId)) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        userId: submission.userId,
        user: submission.user,
        date: submission.date,
        submittedAt: submission.submittedAt,
        isOnTime: submission.isOnTime,
        reviewStatus: submission.reviewStatus,
        reviewNote: submission.reviewNote,
        reviewedAt: submission.reviewedAt,
        reviewedBy: submission.reviewedBy ? {
          id: submission.reviewedBy.id,
          email: submission.reviewedBy.email,
          name: submission.reviewedBy.name,
        } : null,
        imageUrl: `/api/files/daily-notepad/${path.basename(submission.imageUrl)}`,
        thumbnailUrl: submission.thumbnailUrl ? `/api/files/daily-notepad/thumbnails/${path.basename(submission.thumbnailUrl)}` : null,
        ocrText: submission.ocrText,
        comments: submission.comments.map(comment => ({
          id: comment.id,
          userId: comment.userId,
          user: comment.user,
          comment: comment.comment,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        })),
      },
    })
  } catch (error) {
    console.error('Get submission error:', error)
    return NextResponse.json(
      { error: 'Failed to get submission' },
      { status: 500 }
    )
  }
}

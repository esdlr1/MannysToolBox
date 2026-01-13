import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is manager/owner/admin
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

    const { submissionId, comment } = await request.json()

    if (!submissionId || !comment || !comment.trim()) {
      return NextResponse.json(
        { error: 'Submission ID and comment are required' },
        { status: 400 }
      )
    }

    // Verify submission exists
    const submission = await prisma.dailyNotepadSubmission.findUnique({
      where: { id: submissionId },
    })

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    // Create comment
    const newComment = await prisma.submissionComment.create({
      data: {
        submissionId,
        userId: session.user.id,
        comment: comment.trim(),
      },
      include: {
        user: {
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
      comment: {
        id: newComment.id,
        userId: newComment.userId,
        user: newComment.user,
        comment: newComment.comment,
        createdAt: newComment.createdAt,
        updatedAt: newComment.updatedAt,
      },
    })
  } catch (error) {
    console.error('Create comment error:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}

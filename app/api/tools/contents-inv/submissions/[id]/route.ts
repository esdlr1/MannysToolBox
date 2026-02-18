import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  canViewAllContentsInvSubmissions,
  canUpdateAssignment,
  canCompleteSubmission,
} from '@/lib/contents-inv-access'
import { Decimal } from '@prisma/client/runtime/library'

export const dynamic = 'force-dynamic'

// GET - Get one submission by id (queue users: any; others: own or assigned to them)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const submission = await prisma.contentsInvSubmission.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const canViewAll = await canViewAllContentsInvSubmissions(
      session.user.id,
      session.user.role
    )
    const isOwnerOrAssigned =
      submission.userId === session.user.id || submission.assignedToId === session.user.id
    if (!canViewAll && !isOwnerOrAssigned) {
      return NextResponse.json({ error: 'Forbidden - you can only view your own or assigned submissions' }, { status: 403 })
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('[Contents INV] GET submission error:', error)
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 })
  }
}

// PATCH - Assign/unassign or mark complete
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const submission = await prisma.contentsInvSubmission.findUnique({
      where: { id: params.id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const { assignedToId, status: newStatus, totalAmount: totalAmountRaw } = body

    // Assign or unassign
    if (typeof assignedToId !== 'undefined') {
      const assigneeId = assignedToId === null || assignedToId === '' ? null : String(assignedToId)
      const allowed = await canUpdateAssignment(session.user.id, submission, assigneeId)
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden - you cannot assign this submission' }, { status: 403 })
      }
      const updated = await prisma.contentsInvSubmission.update({
        where: { id: params.id },
        data: {
          assignedToId: assigneeId,
          status: assigneeId ? 'in_progress' : 'pending_estimate',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      })
      return NextResponse.json({ submission: updated })
    }

    // Mark complete
    if (newStatus === 'completed') {
      const allowed = await canCompleteSubmission(session.user.id, submission)
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden - you cannot complete this submission' }, { status: 403 })
      }
      const totalAmount =
        totalAmountRaw !== undefined && totalAmountRaw !== null && totalAmountRaw !== ''
          ? new Decimal(Number(totalAmountRaw))
          : null
      if (totalAmount === null || totalAmount.lte(0)) {
        return NextResponse.json({ error: 'Total amount is required when completing' }, { status: 400 })
      }
      const updated = await prisma.contentsInvSubmission.update({
        where: { id: params.id },
        data: {
          status: 'completed',
          totalAmount,
          completedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      })
      return NextResponse.json({ submission: updated })
    }

    return NextResponse.json({ error: 'Bad request - provide assignedToId or status' }, { status: 400 })
  } catch (error) {
    console.error('[Contents INV] PATCH submission error:', error)
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 })
  }
}

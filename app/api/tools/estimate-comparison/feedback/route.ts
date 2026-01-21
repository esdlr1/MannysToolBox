import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Mark as dynamic route since it uses getServerSession
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

    const body = await request.json()
    const {
      comparisonId,
      itemType, // "missing_item" | "discrepancy" | "overall"
      itemIndex,
      itemDescription,
      isCorrect,
      feedbackType, // "false_positive" | "false_negative" | "missing_item" | "other"
      comment,
      adjusterData,
      contractorData,
      metadata,
    } = body

    if (!itemType || typeof isCorrect !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: itemType, isCorrect' },
        { status: 400 }
      )
    }

    const feedback = await prisma.estimateComparisonFeedback.create({
      data: {
        userId: session.user.id,
        comparisonId: comparisonId || null,
        itemType,
        itemIndex: itemIndex ?? null,
        itemDescription: itemDescription || null,
        isCorrect,
        feedbackType: feedbackType || null,
        comment: comment || null,
        adjusterData: adjusterData || null,
        contractorData: contractorData || null,
        metadata: metadata || null,
      },
    })

    return NextResponse.json({ success: true, feedback })
  } catch (error: any) {
    console.error('Feedback submission error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const comparisonId = searchParams.get('comparisonId')

    const feedback = await prisma.estimateComparisonFeedback.findMany({
      where: {
        userId: session.user.id,
        ...(comparisonId && { comparisonId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    return NextResponse.json({ feedback })
  } catch (error: any) {
    console.error('Feedback retrieval error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve feedback' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all surveys
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const surveys = await prisma.survey.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      surveys: surveys.map(survey => ({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        createdBy: survey.createdBy,
        targetType: survey.targetType,
        targetIds: survey.targetIds,
        isActive: survey.isActive,
        deadline: survey.deadline,
        createdAt: survey.createdAt,
        _count: survey._count,
      })),
    })
  } catch (error) {
    console.error('Get surveys error:', error)
    return NextResponse.json(
      { error: 'Failed to get surveys' },
      { status: 500 }
    )
  }
}

// POST - Create a new survey
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Manager/Owner/Admin
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

    const { title, description, targetType, targetIds, deadline, questions } = await request.json()

    if (!title || !questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'Title and at least one question are required' },
        { status: 400 }
      )
    }

    const survey = await prisma.survey.create({
      data: {
        title,
        description: description || null,
        createdById: session.user.id,
        questions: questions || [],
        targetType: targetType || 'all',
        targetIds: targetIds || [],
        deadline: deadline ? new Date(deadline) : null,
        isActive: true,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        createdBy: survey.createdBy,
        targetType: survey.targetType,
        targetIds: survey.targetIds,
        isActive: survey.isActive,
        deadline: survey.deadline,
        createdAt: survey.createdAt,
      },
    })
  } catch (error) {
    console.error('Create survey error:', error)
    return NextResponse.json(
      { error: 'Failed to create survey' },
      { status: 500 }
    )
  }
}

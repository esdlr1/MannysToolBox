import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSubmissions, getSubmissionById, parseTagsFromQuery } from '@/lib/daily-notepad'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const userIdParam = searchParams.get('userId')
    const departmentIdParam = searchParams.get('departmentId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const filters: any = {}
    
    if (dateParam) {
      filters.date = new Date(dateParam)
    }
    
    if (startDateParam && endDateParam) {
      filters.startDate = new Date(startDateParam)
      filters.endDate = new Date(endDateParam)
    }
    
    if (userIdParam) {
      filters.userId = userIdParam
    }
    if (departmentIdParam) {
      filters.departmentId = departmentIdParam
    }
    const managerFilterId = searchParams.get('managerId')
    const tags = parseTagsFromQuery(searchParams)
    // Managers can only see their own employees
    // Owners can filter by any manager or see all
    if (user.role === 'Manager') {
      filters.managerId = session.user.id
    } else if (managerFilterId) {
      filters.managerId = managerFilterId
    }
    if (tags.length) filters.tags = tags

    const submissions = await getSubmissions(filters)

    return NextResponse.json({
      success: true,
      submissions: submissions.map(sub => ({
        id: sub.id,
        userId: sub.userId,
        user: sub.user,
        date: sub.date,
        submittedAt: sub.submittedAt,
        isOnTime: sub.isOnTime,
        reviewStatus: sub.reviewStatus,
        reviewNote: sub.reviewNote,
        reviewedAt: sub.reviewedAt,
        reviewedBy: sub.reviewedBy ? {
          id: sub.reviewedBy.id,
          email: sub.reviewedBy.email,
          name: sub.reviewedBy.name,
        } : null,
        imageUrl: `/api/files/daily-notepad/${sub.imageUrl.split('/').pop()}`,
        thumbnailUrl: sub.thumbnailUrl ? `/api/files/daily-notepad/thumbnails/${sub.thumbnailUrl.split('/').pop()}` : null,
        commentsCount: sub._count?.comments || 0,
      })),
    })
  } catch (error) {
    console.error('Get submissions error:', error)
    return NextResponse.json(
      { error: 'Failed to get submissions' },
      { status: 500 }
    )
  }
}

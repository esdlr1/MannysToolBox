import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTodaysSubmissions, getSubmissions } from '@/lib/daily-notepad'
import { format } from 'date-fns'

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

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    let submissions

    if (dateParam) {
      const date = new Date(dateParam)
      submissions = await getTodaysSubmissions(session.user.id, date)
    } else if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam)
      const endDate = new Date(endDateParam)
      submissions = await getSubmissions({
        userId: session.user.id,
        startDate,
        endDate,
      })
    } else {
      submissions = await getTodaysSubmissions(session.user.id)
    }

    return NextResponse.json({
      success: true,
      submissions: submissions.map(sub => ({
        id: sub.id,
        date: sub.date,
        submittedAt: sub.submittedAt,
        isOnTime: sub.isOnTime,
        imageUrl: `/api/files/daily-notepad/${sub.imageUrl.split('/').pop()}`,
        thumbnailUrl: sub.thumbnailUrl ? `/api/files/daily-notepad/thumbnails/${sub.thumbnailUrl.split('/').pop()}` : null,
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

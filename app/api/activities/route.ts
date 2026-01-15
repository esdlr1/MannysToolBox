import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getUserActivities,
  getTeamActivities,
  getAllActivities,
  getActivityStats,
} from '@/lib/activities'

export const dynamic = 'force-dynamic'

/**
 * GET /api/activities
 * Get activities based on user role
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined
    const type = searchParams.get('type') || undefined
    const userId = searchParams.get('userId') || undefined
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined

    let activities

    // Super Admin and Owner see all activities
    if (user.role === 'Super Admin' || user.role === 'Owner') {
      activities = await getAllActivities({
        limit,
        type,
        userId: userId || undefined,
        startDate,
        endDate,
      })
    }
    // Manager sees team activities
    else if (user.role === 'Manager') {
      activities = await getTeamActivities(user.id, {
        limit,
        type,
        startDate,
        endDate,
      })
    }
    // Employee sees only their own activities
    else {
      activities = await getUserActivities(user.id, {
        limit,
        type,
        startDate,
        endDate,
      })
    }

    return NextResponse.json({ activities })
  } catch (error: any) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities', details: error.message },
      { status: 500 }
    )
  }
}

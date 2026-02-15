import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMissingSubmissions, getTodayDate, isWorkday, parseTagsFromQuery } from '@/lib/daily-notepad'
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
    const teamId = searchParams.get('teamId') || undefined
    const departmentId = searchParams.get('departmentId') || undefined
    const tags = parseTagsFromQuery(searchParams)
    const managerId = user.role === 'Manager' ? session.user.id : (searchParams.get('managerId') || undefined)

    const targetDate = dateParam ? new Date(dateParam) : getTodayDate()

    if (!isWorkday(targetDate)) {
      return NextResponse.json({
        success: true,
        date: targetDate,
        missing: [],
        message: 'Not a workday',
      })
    }

    const missing = await getMissingSubmissions(targetDate, { teamId, departmentId, managerId, tags: tags.length ? tags : undefined })

    return NextResponse.json({
      success: true,
      date: targetDate,
      missing: missing.map(emp => ({
        id: emp.id,
        email: emp.email,
        name: emp.name,
      })),
      count: missing.length,
    })
  } catch (error) {
    console.error('Get missing submissions error:', error)
    return NextResponse.json(
      { error: 'Failed to get missing submissions' },
      { status: 500 }
    )
  }
}

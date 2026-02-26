import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'

export const dynamic = 'force-dynamic'

// GET - List estimate diary entries with optional week filter
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')

    const where: { userId: string; weekStartDate?: Date } = { userId: session.user.id }

    if (weekStartParam) {
      const weekStart = new Date(weekStartParam.trim() + 'T00:00:00.000Z')
      if (isNaN(weekStart.getTime())) {
        return NextResponse.json({ error: 'Invalid weekStart date' }, { status: 400 })
      }
      where.weekStartDate = weekStart
    }

    const entries = await prisma.estimateDiaryEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const totalAmount = entries.reduce((sum, e) => sum + e.totalAmount, 0)

    return NextResponse.json({
      entries,
      totalAmount,
    })
  } catch (error) {
    console.error('[Estimate Diary] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 })
  }
}

// POST - Create a new estimate diary entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clientName, jobNumber, totalAmount: totalAmountInput, weekStartDate: weekStartInput } = body

    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
    }
    if (!jobNumber || typeof jobNumber !== 'string' || !jobNumber.trim()) {
      return NextResponse.json({ error: 'Job number is required' }, { status: 400 })
    }

    const totalAmount = typeof totalAmountInput === 'number'
      ? totalAmountInput
      : parseFloat(String(totalAmountInput).replace(/[,$]/g, ''))
    if (isNaN(totalAmount) || totalAmount < 0) {
      return NextResponse.json({ error: 'Total amount must be a valid non-negative number' }, { status: 400 })
    }

    const weekStart = weekStartInput
      ? new Date(String(weekStartInput).trim() + 'T00:00:00.000Z')
      : startOfWeek(new Date(), { weekStartsOn: 1 })
    if (isNaN(weekStart.getTime())) {
      return NextResponse.json({ error: 'Invalid week start date' }, { status: 400 })
    }

    const entry = await prisma.estimateDiaryEntry.create({
      data: {
        userId: session.user.id,
        clientName: clientName.trim(),
        jobNumber: jobNumber.trim(),
        totalAmount,
        weekStartDate: weekStart,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error('[Estimate Diary] POST error:', error)
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
  }
}

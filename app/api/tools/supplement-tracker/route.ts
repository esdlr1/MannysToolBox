import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, format } from 'date-fns'

export const dynamic = 'force-dynamic'

// GET - List supplement entries with optional week filter
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    const userId = searchParams.get('userId') || session.user.id

    // Only allow viewing own entries unless Super Admin/Owner
    const canViewAll = session.user.role === 'Super Admin' || session.user.role === 'Owner'
    const targetUserId = canViewAll && searchParams.get('userId') ? searchParams.get('userId') : session.user.id

    const where: any = { userId: targetUserId }

    // Filter by week: use date-only (UTC midnight) so comparison matches @db.Date storage
    if (weekStartParam) {
      const weekStart = new Date(weekStartParam.trim() + 'T00:00:00.000Z')
      if (isNaN(weekStart.getTime())) {
        return NextResponse.json({ error: 'Invalid weekStart date' }, { status: 400 })
      }
      where.weekStartDate = weekStart
    }

    const entries = await prisma.supplementTracker.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Calculate totals
    const totals = entries.reduce(
      (acc, entry) => ({
        totalOriginal: acc.totalOriginal + entry.originalAmount,
        totalSupplement: acc.totalSupplement + entry.supplementAmount,
        totalFinal: acc.totalFinal + entry.finalAmount,
      }),
      { totalOriginal: 0, totalSupplement: 0, totalFinal: 0 }
    )

    return NextResponse.json({
      entries,
      totals,
    })
  } catch (error) {
    console.error('[Supplement Tracker] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch supplement entries' }, { status: 500 })
  }
}

// POST - Create a new supplement entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerName, claimNumber, originalAmount, finalAmount: finalAmountInput, supplementAmount: supplementAmountInput, weekStartDate, notes } = body

    const nameTrimmed = typeof customerName === 'string' ? customerName.trim() : ''
    const claimTrimmed = typeof claimNumber === 'string' ? claimNumber.trim() : ''
    if (!nameTrimmed || !claimTrimmed) {
      return NextResponse.json(
        { error: 'customerName and claimNumber are required and cannot be empty or whitespace-only' },
        { status: 400 }
      )
    }

    // Accept either (originalAmount + finalAmount) or (originalAmount + supplementAmount) for backwards compatibility
    const orig = typeof originalAmount === 'number' ? originalAmount : null
    const finalAmount = typeof finalAmountInput === 'number' ? finalAmountInput : null
    const supplementAmountInputVal = typeof supplementAmountInput === 'number' ? supplementAmountInput : null

    let finalAmountRes: number
    let supplementAmountRes: number

    if (orig !== null && finalAmount !== null) {
      // New flow: user enters original and amount after supplement; we store the difference as supplement
      if (orig < 0 || finalAmount < 0) {
        return NextResponse.json({ error: 'Amounts must be non-negative' }, { status: 400 })
      }
      if (finalAmount < orig) {
        return NextResponse.json({ error: 'Amount after supplement cannot be less than original amount' }, { status: 400 })
      }
      finalAmountRes = finalAmount
      supplementAmountRes = finalAmount - orig
    } else if (orig !== null && supplementAmountInputVal !== null) {
      // Legacy: original + supplement amount
      if (orig < 0 || supplementAmountInputVal < 0) {
        return NextResponse.json({ error: 'Amounts must be non-negative' }, { status: 400 })
      }
      supplementAmountRes = supplementAmountInputVal
      finalAmountRes = orig + supplementAmountInputVal
    } else {
      return NextResponse.json(
        { error: 'Provide both originalAmount and finalAmount (amount after supplement), or originalAmount and supplementAmount' },
        { status: 400 }
      )
    }

    const originalAmountRes = orig!

    // Determine week start date (Monday of the week)
    let weekStart: Date
    if (weekStartDate) {
      weekStart = startOfWeek(new Date(weekStartDate), { weekStartsOn: 1 })
    } else {
      weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    }

    const entry = await prisma.supplementTracker.create({
      data: {
        userId: session.user.id,
        customerName: nameTrimmed,
        claimNumber: claimTrimmed,
        originalAmount: originalAmountRes,
        supplementAmount: supplementAmountRes,
        finalAmount: finalAmountRes,
        weekStartDate: weekStart,
        notes: (typeof notes === 'string' ? notes.trim() : null) || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error('[Supplement Tracker] POST error:', error)
    return NextResponse.json({ error: 'Failed to create supplement entry' }, { status: 500 })
  }
}

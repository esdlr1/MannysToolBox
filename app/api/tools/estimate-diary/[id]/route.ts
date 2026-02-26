import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'

export const dynamic = 'force-dynamic'

// DELETE - Delete an estimate diary entry (own entries only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entry = await prisma.estimateDiaryEntry.findUnique({
      where: { id: params.id },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'You can only delete your own entries' }, { status: 403 })
    }

    await prisma.estimateDiaryEntry.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Estimate Diary] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }
}

// PATCH - Update an estimate diary entry (own entries only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entry = await prisma.estimateDiaryEntry.findUnique({
      where: { id: params.id },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit your own entries' }, { status: 403 })
    }

    const body = await request.json()
    const { clientName, jobNumber, totalAmount: totalAmountInput, weekStartDate: weekStartInput } = body

    const updateData: {
      clientName?: string
      jobNumber?: string
      totalAmount?: number
      weekStartDate?: Date
    } = {}

    if (clientName !== undefined) {
      const s = typeof clientName === 'string' ? clientName.trim() : ''
      if (!s) return NextResponse.json({ error: 'Client name cannot be empty' }, { status: 400 })
      updateData.clientName = s
    }
    if (jobNumber !== undefined) {
      updateData.jobNumber = typeof jobNumber === 'string' ? jobNumber.trim() : ''
    }
    if (totalAmountInput !== undefined) {
      const totalAmount = typeof totalAmountInput === 'number'
        ? totalAmountInput
        : parseFloat(String(totalAmountInput).replace(/[,$]/g, ''))
      if (isNaN(totalAmount) || totalAmount < 0) {
        return NextResponse.json({ error: 'Total amount must be a valid non-negative number' }, { status: 400 })
      }
      updateData.totalAmount = totalAmount
    }
    if (weekStartInput) {
      const weekStart = new Date(String(weekStartInput).trim() + 'T00:00:00.000Z')
      if (!isNaN(weekStart.getTime())) {
        updateData.weekStartDate = startOfWeek(weekStart, { weekStartsOn: 1 })
      }
    }

    const updated = await prisma.estimateDiaryEntry.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ entry: updated })
  } catch (error) {
    console.error('[Estimate Diary] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}

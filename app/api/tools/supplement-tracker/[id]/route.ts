import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'

export const dynamic = 'force-dynamic'

// DELETE - Delete a supplement entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entry = await prisma.supplementTracker.findUnique({
      where: { id: params.id },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Only allow deleting own entries unless Super Admin/Owner
    if (entry.userId !== session.user.id && session.user.role !== 'Super Admin' && session.user.role !== 'Owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.supplementTracker.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Supplement Tracker] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }
}

// PUT - Update a supplement entry
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entry = await prisma.supplementTracker.findUnique({
      where: { id: params.id },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Only allow updating own entries unless Super Admin/Owner
    if (entry.userId !== session.user.id && session.user.role !== 'Super Admin' && session.user.role !== 'Owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { customerName, claimNumber, originalAmount, finalAmount: finalAmountInput, supplementAmount: supplementAmountInput, weekStartDate, notes } = body

    if (typeof originalAmount === 'number' && originalAmount < 0) {
      return NextResponse.json({ error: 'originalAmount must be non-negative' }, { status: 400 })
    }
    if (typeof finalAmountInput === 'number' && finalAmountInput < 0) {
      return NextResponse.json({ error: 'finalAmount must be non-negative' }, { status: 400 })
    }
    if (typeof supplementAmountInput === 'number' && supplementAmountInput < 0) {
      return NextResponse.json({ error: 'supplementAmount must be non-negative' }, { status: 400 })
    }

    const updateData: any = {}
    if (customerName !== undefined) {
      const s = typeof customerName === 'string' ? customerName.trim() : String(customerName).trim()
      if (!s) return NextResponse.json({ error: 'customerName cannot be empty or whitespace-only' }, { status: 400 })
      updateData.customerName = s
    }
    if (claimNumber !== undefined) {
      const s = typeof claimNumber === 'string' ? claimNumber.trim() : String(claimNumber).trim()
      if (!s) return NextResponse.json({ error: 'claimNumber cannot be empty or whitespace-only' }, { status: 400 })
      updateData.claimNumber = s
    }
    if (notes !== undefined) {
      updateData.notes = (typeof notes === 'string' ? notes.trim() : String(notes ?? '').trim()) || null
    }

    const newOriginal = typeof originalAmount === 'number' ? originalAmount : entry.originalAmount
    let newSupplement: number = entry.supplementAmount
    let newFinal: number = entry.finalAmount

    if (typeof finalAmountInput === 'number') {
      // New flow: user sends original + amount after supplement
      if (finalAmountInput < newOriginal) {
        return NextResponse.json({ error: 'Amount after supplement cannot be less than original amount' }, { status: 400 })
      }
      updateData.originalAmount = newOriginal
      newFinal = finalAmountInput
      newSupplement = finalAmountInput - newOriginal
      updateData.finalAmount = newFinal
      updateData.supplementAmount = newSupplement
    } else if (typeof originalAmount === 'number' || typeof supplementAmountInput === 'number') {
      // Legacy: original + supplement
      const newSupp = typeof supplementAmountInput === 'number' ? supplementAmountInput : entry.supplementAmount
      updateData.originalAmount = newOriginal
      newSupplement = newSupp
      newFinal = newOriginal + newSupp
      updateData.supplementAmount = newSupplement
      updateData.finalAmount = newFinal
    }

    // Update week start date if provided
    if (weekStartDate) {
      updateData.weekStartDate = startOfWeek(new Date(weekStartDate), { weekStartsOn: 1 })
    }

    const updated = await prisma.supplementTracker.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json({ entry: updated })
  } catch (error) {
    console.error('[Supplement Tracker] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}

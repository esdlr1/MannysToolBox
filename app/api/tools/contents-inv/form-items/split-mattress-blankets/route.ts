import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const OLD_LABEL = 'Mattress Bag Furniture Blankets'

// POST - One-time: replace "Mattress Bag Furniture Blankets" with "Mattress Bag" and "Furniture Blankets". Super Admin only.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const existing = await prisma.contentsInvFormItem.findFirst({
      where: { label: OLD_LABEL },
      select: { id: true, sortOrder: true },
    })
    if (!existing) {
      const items = await prisma.contentsInvFormItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
      })
      return NextResponse.json({ message: 'No combined item to split.', items })
    }

    const sortOrder = existing.sortOrder
    await prisma.$transaction([
      prisma.contentsInvFormItem.updateMany({
        where: { sortOrder: { gt: sortOrder } },
        data: { sortOrder: { increment: 1 } },
      }),
      prisma.contentsInvFormItem.delete({ where: { id: existing.id } }),
      prisma.contentsInvFormItem.create({
        data: { label: 'Mattress Bag', sortOrder, isActive: true },
      }),
      prisma.contentsInvFormItem.create({
        data: { label: 'Furniture Blankets', sortOrder: sortOrder + 1, isActive: true },
      }),
    ])

    const items = await prisma.contentsInvFormItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
    })
    return NextResponse.json({
      message: 'Split into "Mattress Bag" and "Furniture Blankets".',
      items,
    })
  } catch (error) {
    console.error('[Contents INV] Split mattress blankets error:', error)
    return NextResponse.json({ error: 'Failed to split line items' }, { status: 500 })
  }
}

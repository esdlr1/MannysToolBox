import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Must match the list in form-items/route.ts and seed/route.ts
const DEFAULT_FORM_ITEMS = [
  'Inventory Hours',
  'Supervisor on site hours',
  'content pack-out labor',
  'PPE',
  'Floor Protection',
  'Small box',
  'Medium box',
  'Large Box',
  'Wardrobe Box',
  'TV/Picture box',
  'Mattress Bag',
  'Furniture Blankets',
  "Stretch Wrap (20'x1000')",
  "Hand Wrap (5\"1000')",
  'Packing Paper (LF Used)',
  'Bubble Wrap (LF) Used)',
  'Storage Vault Sanitation (Number of vaults)',
  'Offsite Storage (Per CF)',
  'Moving Trucks',
]

// POST - Insert any default line items that are missing, in the correct order. Super Admin only.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const existing = await prisma.contentsInvFormItem.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, sortOrder: true },
    })
    const existingLabels = new Set(existing.map((e) => e.label))

    const missing = DEFAULT_FORM_ITEMS.filter((label) => !existingLabels.has(label))
    if (missing.length === 0) {
      const items = await prisma.contentsInvFormItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
      })
      return NextResponse.json({ message: 'No missing line items.', items })
    }

    // Insert missing items in order of their target index (so "Large Box" goes between Medium and Wardrobe)
    const missingWithIndex = missing.map((label) => ({ label, index: DEFAULT_FORM_ITEMS.indexOf(label) }))
    missingWithIndex.sort((a, b) => a.index - b.index)

    for (const { label, index: targetSortOrder } of missingWithIndex) {
      await prisma.$transaction([
        prisma.contentsInvFormItem.updateMany({
          where: { sortOrder: { gte: targetSortOrder } },
          data: { sortOrder: { increment: 1 } },
        }),
        prisma.contentsInvFormItem.create({
          data: { label, sortOrder: targetSortOrder, isActive: true },
        }),
      ])
    }

    const items = await prisma.contentsInvFormItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
    })
    return NextResponse.json({
      message: `Added ${missing.length} missing line item(s): ${missing.join(', ')}.`,
      items,
    })
  } catch (error) {
    console.error('[Contents INV] Insert missing form-items error:', error)
    return NextResponse.json({ error: 'Failed to add missing line items' }, { status: 500 })
  }
}

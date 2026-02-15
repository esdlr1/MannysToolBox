import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

// POST - Seed default form items (Super Admin only). Only runs if no items exist.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const count = await prisma.contentsInvFormItem.count()
    if (count > 0) {
      return NextResponse.json({
        message: 'Form items already exist.',
        items: await prisma.contentsInvFormItem.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
        }),
      })
    }

    await prisma.$transaction(
      DEFAULT_FORM_ITEMS.map((label, sortOrder) =>
        prisma.contentsInvFormItem.create({
          data: { label, sortOrder, isActive: true },
        })
      )
    )

    const items = await prisma.contentsInvFormItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
    })

    return NextResponse.json({ message: `Created ${items.length} line items.`, items })
  } catch (error) {
    console.error('[Contents INV] Seed form-items error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const hint = /column|unknown field|does not exist|unit|xactimate/i.test(msg)
      ? ' Run: npx prisma db push'
      : ''
    return NextResponse.json(
      { error: 'Failed to seed form items.' + hint },
      { status: 500 }
    )
  }
}

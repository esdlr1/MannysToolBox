import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Default form items if DB is empty (e.g. first deploy or new environment)
const DEFAULT_FORM_ITEMS = [
  'Inventory Hours',
  'Supervisor on site hours',
  'content pack-out labor',
  'PPE',
  'Floor Protection',
  'Small box',
  'Medium box',
  'Wardrobe Box',
  'TV/Picture box',
  'Mattress Bag Furniture Blankets',
  "Stretch Wrap (20'x1000')",
  "Hand Wrap (5\"1000')",
  'Packing Paper (LF Used)',
  'Bubble Wrap (LF) Used)',
  'Storage Vault Sanitation (Number of vaults)',
  'Offsite Storage (Per CF)',
  'Moving Trucks',
]

// GET - List form items (questions) for the Contents INV form, ordered by sortOrder
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let items = await prisma.contentsInvFormItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, sortOrder: true },
    })

    // If no items (e.g. first deploy on Railway), seed defaults so the form works without running the script
    if (items.length === 0) {
      await prisma.$transaction(
        DEFAULT_FORM_ITEMS.map((label, sortOrder) =>
          prisma.contentsInvFormItem.create({
            data: { label, sortOrder, isActive: true },
          })
        )
      )
      items = await prisma.contentsInvFormItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, sortOrder: true },
      })
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[Contents INV] GET form-items error:', error)
    return NextResponse.json({ error: 'Failed to fetch form items' }, { status: 500 })
  }
}

// POST - Create form item(s). Super Admin only. Body: { label, sortOrder } or { items: [{ label, sortOrder }] }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const body = await request.json()

    if (body.items && Array.isArray(body.items)) {
      const created = await prisma.$transaction(
        body.items.map((item: { label: string; sortOrder?: number }, i: number) =>
          prisma.contentsInvFormItem.create({
            data: {
              label: typeof item.label === 'string' ? item.label.trim() : String(item.label),
              sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : i,
            },
          })
        )
      )
      return NextResponse.json({ items: created })
    }

    const label = typeof body.label === 'string' ? body.label.trim() : ''
    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 })
    }
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0

    const item = await prisma.contentsInvFormItem.create({
      data: { label, sortOrder },
    })
    return NextResponse.json({ item })
  } catch (error) {
    console.error('[Contents INV] POST form-items error:', error)
    return NextResponse.json({ error: 'Failed to create form item' }, { status: 500 })
  }
}

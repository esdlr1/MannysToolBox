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
      select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
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
        select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
      })
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[Contents INV] GET form-items error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const hint = /column|unknown field|does not exist|unit|xactimate/i.test(msg)
      ? ' The database may be out of date. Run: npx prisma db push'
      : ''
    return NextResponse.json(
      { error: 'Failed to fetch form items.' + hint },
      { status: 500 }
    )
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
        body.items.map((item: { label: string; sortOrder?: number; xactimateCode?: string; xactimateCat?: string; xactimateSel?: string; unit?: string; customUnitPrice?: number | string | null }, i: number) => {
          const price = item.customUnitPrice
          const customUnitPrice = price === null || price === undefined || price === ''
            ? null
            : typeof price === 'number'
              ? (Number.isFinite(price) ? price : null)
              : parseFloat(String(price).trim())
          return prisma.contentsInvFormItem.create({
            data: {
              label: typeof item.label === 'string' ? item.label.trim() : String(item.label),
              sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : i,
              xactimateCode: typeof item.xactimateCode === 'string' ? item.xactimateCode.trim() || null : null,
              xactimateCat: typeof item.xactimateCat === 'string' ? item.xactimateCat.trim() || null : null,
              xactimateSel: typeof item.xactimateSel === 'string' ? item.xactimateSel.trim() || null : null,
              unit: typeof item.unit === 'string' ? item.unit.trim() || null : null,
              customUnitPrice: Number.isFinite(customUnitPrice) ? customUnitPrice : null,
            },
          })
        })
      )
      return NextResponse.json({ items: created })
    }

    const label = typeof body.label === 'string' ? body.label.trim() : ''
    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 })
    }
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0
    const xactimateCode = typeof body.xactimateCode === 'string' ? body.xactimateCode.trim() || null : null
    const xactimateCat = typeof body.xactimateCat === 'string' ? body.xactimateCat.trim() || null : null
    const xactimateSel = typeof body.xactimateSel === 'string' ? body.xactimateSel.trim() || null : null
    const unit = typeof body.unit === 'string' ? body.unit.trim() || null : null
    const rawPrice = body.customUnitPrice
    const customUnitPrice = rawPrice === null || rawPrice === undefined || rawPrice === ''
      ? null
      : (typeof rawPrice === 'number' && Number.isFinite(rawPrice) ? rawPrice : parseFloat(String(rawPrice).trim()))
    const customUnitPriceVal = Number.isFinite(customUnitPrice) ? customUnitPrice : null

    const item = await prisma.contentsInvFormItem.create({
      data: { label, sortOrder, xactimateCode, xactimateCat, xactimateSel, unit, customUnitPrice: customUnitPriceVal },
    })
    return NextResponse.json({ item })
  } catch (error) {
    console.error('[Contents INV] POST form-items error:', error)
    return NextResponse.json({ error: 'Failed to create form item' }, { status: 500 })
  }
}

// PATCH - Update form items (e.g. label, Xactimate CAT/SEL, unit, customUnitPrice). Super Admin only. Body: { updates: [{ id, label?, xactimateCat?, xactimateSel?, unit?, customUnitPrice? }] }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const updates = Array.isArray(body.updates) ? body.updates : []
    if (updates.length === 0) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 })
    }

    for (const u of updates) {
      const id = typeof u.id === 'string' ? u.id.trim() : ''
      if (!id) continue
      const label =
        u.label !== null && u.label !== undefined && typeof u.label === 'string'
          ? u.label.trim()
          : undefined
      const xactimateCat =
        u.xactimateCat === null || u.xactimateCat === undefined
          ? null
          : typeof u.xactimateCat === 'string'
            ? u.xactimateCat.trim() || null
            : null
      const xactimateSel =
        u.xactimateSel === null || u.xactimateSel === undefined
          ? null
          : typeof u.xactimateSel === 'string'
            ? u.xactimateSel.trim() || null
            : null
      const unit =
        u.unit === null || u.unit === undefined
          ? null
          : typeof u.unit === 'string'
            ? u.unit.trim() || null
            : null
      const rawPrice = u.customUnitPrice
      const customUnitPrice =
        rawPrice === null || rawPrice === undefined || rawPrice === ''
          ? null
          : typeof rawPrice === 'number' && Number.isFinite(rawPrice)
            ? rawPrice
            : (() => { const n = parseFloat(String(rawPrice).trim()); return Number.isFinite(n) ? n : null })()
      const data: { label?: string; xactimateCat: string | null; xactimateSel: string | null; unit: string | null; customUnitPrice: number | null } = { xactimateCat, xactimateSel, unit, customUnitPrice }
      if (label !== undefined && label !== '') data.label = label
      await prisma.contentsInvFormItem.updateMany({
        where: { id },
        data,
      })
    }

    const items = await prisma.contentsInvFormItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, sortOrder: true, xactimateCode: true, xactimateCat: true, xactimateSel: true, unit: true, customUnitPrice: true },
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('[Contents INV] PATCH form-items error:', error)
    return NextResponse.json({ error: 'Failed to update form items' }, { status: 500 })
  }
}

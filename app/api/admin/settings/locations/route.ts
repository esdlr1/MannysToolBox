import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  try {
    const stateId = request.nextUrl.searchParams.get('stateId') || undefined
    const locations = await prisma.location.findMany({
      where: stateId ? { stateId } : undefined,
      orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        stateId: true,
        name: true,
        description: true,
        state: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ locations })
  } catch (e) {
    console.error('[admin/settings/locations] GET error:', e)
    const message = e instanceof Error ? e.message : 'Failed to load locations'
    return NextResponse.json(
      { error: 'Failed to load locations', detail: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  try {
    const { stateId, name, description } = await request.json()
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!stateId || typeof stateId !== 'string') {
      return NextResponse.json({ error: 'State is required' }, { status: 400 })
    }
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const state = await prisma.state.findUnique({ where: { id: stateId } })
    if (!state) return NextResponse.json({ error: 'State not found' }, { status: 400 })
    const existing = await prisma.location.findUnique({
      where: { stateId_name: { stateId, name: trimmedName } },
    })
    if (existing) {
      return NextResponse.json({ error: 'A location with this name already exists in this state' }, { status: 400 })
    }
    const location = await prisma.location.create({
      data: {
        stateId,
        name: trimmedName,
        description: typeof description === 'string' ? description.trim() || null : null,
      },
      select: {
        id: true,
        stateId: true,
        name: true,
        description: true,
        state: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(
      { message: 'Location created', location },
      { status: 201 }
    )
  } catch (e) {
    console.error('[admin/settings/locations] POST error:', e)
    const message = e instanceof Error ? e.message : 'Failed to create location'
    return NextResponse.json(
      { error: 'Failed to create location', detail: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  try {
    const states = await prisma.state.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, _count: { select: { locations: true } } },
    })
    return NextResponse.json({ states })
  } catch (e) {
    console.error('[admin/settings/states] GET error:', e)
    const message = e instanceof Error ? e.message : 'Failed to load states'
    return NextResponse.json(
      { error: 'Failed to load states', detail: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  try {
    const { name, description } = await request.json()
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const existing = await prisma.state.findUnique({
      where: { name: trimmedName },
    })
    if (existing) {
      return NextResponse.json({ error: 'A state with this name already exists' }, { status: 400 })
    }
    const state = await prisma.state.create({
      data: {
        name: trimmedName,
        description: typeof description === 'string' ? description.trim() || null : null,
      },
    })
    return NextResponse.json(
      { message: 'State created', state: { id: state.id, name: state.name, description: state.description } },
      { status: 201 }
    )
  } catch (e) {
    console.error('[admin/settings/states] POST error:', e)
    const message = e instanceof Error ? e.message : 'Failed to create state'
    return NextResponse.json(
      { error: 'Failed to create state', detail: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    )
  }
}

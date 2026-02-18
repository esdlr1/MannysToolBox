import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const description = typeof body.description === 'string' ? body.description.trim() || null : undefined
    const location = await prisma.location.findUnique({ where: { id } })
    if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    if (name !== undefined && name !== location.name) {
      const existing = await prisma.location.findUnique({
        where: { stateId_name: { stateId: location.stateId, name } },
      })
      if (existing) return NextResponse.json({ error: 'A location with this name already exists in this state' }, { status: 400 })
    }
    const updated = await prisma.location.update({
      where: { id },
      data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }) },
      select: { id: true, stateId: true, name: true, description: true, state: { select: { id: true, name: true } } },
    })
    return NextResponse.json({ location: updated })
  } catch (e) {
    console.error('[admin/settings/locations/:id] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params
  try {
    await prisma.location.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/settings/locations/:id] DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 })
  }
}

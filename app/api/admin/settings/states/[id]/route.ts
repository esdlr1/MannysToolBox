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
    const state = await prisma.state.findUnique({ where: { id } })
    if (!state) return NextResponse.json({ error: 'State not found' }, { status: 404 })
    if (name !== undefined && name !== state.name) {
      const existing = await prisma.state.findUnique({ where: { name } })
      if (existing) return NextResponse.json({ error: 'A state with this name already exists' }, { status: 400 })
    }
    const updated = await prisma.state.update({
      where: { id },
      data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }) },
      select: { id: true, name: true, description: true },
    })
    return NextResponse.json({ state: updated })
  } catch (e) {
    console.error('[admin/settings/states/:id] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update state' }, { status: 500 })
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
    await prisma.state.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/settings/states/:id] DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete state' }, { status: 500 })
  }
}

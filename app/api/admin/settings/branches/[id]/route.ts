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
    const branch = await prisma.branch.findUnique({ where: { id }, select: { stateId: true, name: true } })
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    if (name !== undefined && name !== branch.name) {
      const existing = await prisma.branch.findUnique({
        where: { stateId_name: { stateId: branch.stateId, name } },
      })
      if (existing) return NextResponse.json({ error: 'A branch with this name already exists in this state' }, { status: 400 })
    }
    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
      select: {
        id: true,
        stateId: true,
        name: true,
        description: true,
        state: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ branch: updated })
  } catch (e) {
    console.error('[admin/settings/branches/:id] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
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
    await prisma.branch.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/settings/branches/:id] DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 })
  }
}

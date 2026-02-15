import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function requireSuperAdminOrOwner() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!me || !['Super Admin', 'Owner'].includes(me.role || '')) {
    return { error: NextResponse.json({ error: 'Forbidden - Super Admin or Owner only' }, { status: 403 }) }
  }
  return { error: null }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminOrOwner()
  if (auth.error) return auth.error
  const { id } = await params
  try {
    const team = await prisma.team.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        members: {
          select: { userId: true, user: { select: { id: true, name: true, email: true } } },
        },
      },
    })
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        members: team.members.map((m) => ({ userId: m.userId, user: m.user })),
      },
    })
  } catch (e) {
    console.error('[admin/teams/:id] GET error:', e)
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminOrOwner()
  if (auth.error) return auth.error
  const { id } = await params
  try {
    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const description = typeof body.description === 'string' ? body.description.trim() || null : undefined
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter((id: unknown) => typeof id === 'string') : undefined

    if (name !== undefined && name !== team.name) {
      const existing = await prisma.team.findUnique({ where: { name } })
      if (existing) return NextResponse.json({ error: 'A team with this name already exists' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (name !== undefined) await tx.team.update({ where: { id }, data: { name } })
      if (description !== undefined) await tx.team.update({ where: { id }, data: { description } })
      if (memberIds !== undefined) {
        await tx.teamMember.deleteMany({ where: { teamId: id } })
        if (memberIds.length > 0) {
          await tx.teamMember.createMany({
            data: memberIds.map((userId: string) => ({ teamId: id, userId })),
            skipDuplicates: true,
          })
        }
      }
    })

    const updated = await prisma.team.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        members: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
      },
    })
    return NextResponse.json({ team: updated })
  } catch (e) {
    console.error('[admin/teams/:id] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 })
  }
}

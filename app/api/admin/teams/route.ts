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

export async function GET() {
  const auth = await requireSuperAdminOrOwner()
  if (auth.error) return auth.error
  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { members: true } },
      },
    })
    return NextResponse.json({ teams })
  } catch (e) {
    console.error('[admin/teams] GET error:', e)
    return NextResponse.json({ error: 'Failed to load teams' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminOrOwner()
  if (auth.error) return auth.error
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter((id: unknown) => typeof id === 'string') : []

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    const existing = await prisma.team.findUnique({
      where: { name },
    })
    if (existing) {
      return NextResponse.json({ error: 'A team with this name already exists' }, { status: 400 })
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
      },
    })

    if (memberIds.length > 0) {
      await prisma.teamMember.createMany({
        data: memberIds.map((userId: string) => ({ teamId: team.id, userId })),
        skipDuplicates: true,
      })
    }

    const created = await prisma.team.findUnique({
      where: { id: team.id },
      select: { id: true, name: true, description: true, _count: { select: { members: true } } },
    })
    return NextResponse.json({ team: created }, { status: 201 })
  } catch (e) {
    console.error('[admin/teams] POST error:', e)
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
  }
}

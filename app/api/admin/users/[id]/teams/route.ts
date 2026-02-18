import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET - List team IDs this user belongs to (Super Admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error
    const { id: userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    })
    return NextResponse.json({ teamIds: memberships.map((m) => m.teamId) })
  } catch (e) {
    console.error('[admin/users/[id]/teams] GET error:', e)
    return NextResponse.json({ error: 'Failed to load teams' }, { status: 500 })
  }
}

// PUT - Set user's team memberships. Body: { teamIds: string[] } (Super Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error
    const { id: userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await request.json()
    const teamIds = Array.isArray(body.teamIds) ? body.teamIds.filter((id: unknown) => typeof id === 'string') : []

    const existingTeams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true },
    })
    const validTeamIds = new Set(existingTeams.map((t) => t.id))

    await prisma.$transaction(async (tx) => {
      await tx.teamMember.deleteMany({ where: { userId } })
      if (validTeamIds.size > 0) {
        await tx.teamMember.createMany({
          data: Array.from(validTeamIds).map((teamId) => ({ teamId, userId })),
          skipDuplicates: true,
        })
      }
    })

    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    })
    return NextResponse.json({ teamIds: memberships.map((m) => m.teamId) })
  } catch (e) {
    console.error('[admin/users/[id]/teams] PUT error:', e)
    return NextResponse.json({ error: 'Failed to update teams' }, { status: 500 })
  }
}

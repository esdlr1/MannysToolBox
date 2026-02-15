import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** List users for team member picker (Super Admin and Owner). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (!me || !['Super Admin', 'Owner'].includes(me.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const users = await prisma.user.findMany({
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, name: true, email: true },
    })
    return NextResponse.json({ users })
  } catch (e) {
    console.error('[admin/teams/available-users] GET error:', e)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

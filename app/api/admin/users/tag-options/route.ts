import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET ?key=location -> { values: string[] } (distinct values for that tag key)
 * GET (no key) -> { keys: string[] } (distinct tag keys in use)
 * Manager/Owner/Super Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')?.trim()

    if (key) {
      // Use managed Location/Branch lists from Settings when available
      if (key === 'location') {
        const locations = await prisma.location.findMany({
          orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
          select: { name: true, state: { select: { name: true } } },
        })
        return NextResponse.json({
          values: locations.map((r) => `${r.state.name} – ${r.name}`),
        })
      }
      if (key === 'branch') {
        const branches = await prisma.branch.findMany({
          orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
          select: { name: true, state: { select: { name: true } } },
        })
        return NextResponse.json({
          values: branches.map((r) => (r.state ? `${r.state.name} – ${r.name}` : r.name)),
        })
      }
      const rows = await prisma.userTag.findMany({
        where: { key },
        select: { value: true },
        distinct: ['value'],
        orderBy: { value: 'asc' },
      })
      return NextResponse.json({ values: rows.map((r) => r.value) })
    }

    const keys = await prisma.userTag.findMany({
      select: { key: true },
      distinct: ['key'],
      orderBy: { key: 'asc' },
    })
    return NextResponse.json({ keys: keys.map((r) => r.key) })
  } catch (e) {
    console.error('[admin/users/tag-options] GET error:', e)
    return NextResponse.json({ error: 'Failed to load tag options' }, { status: 500 })
  }
}

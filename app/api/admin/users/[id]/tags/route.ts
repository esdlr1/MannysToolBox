import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserTags, setUserTags, type TagRecord } from '@/lib/user-tags'

export const dynamic = 'force-dynamic'

// GET - Get tags for a user (Super Admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (user?.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    const { id: userId } = await params
    const tags = await getUserTags(userId)
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('[admin/users/[id]/tags] GET error:', error)
    return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 })
  }
}

// PATCH - Set tags for a user (Super Admin only). Body: { tags: [{ key, value }, ...] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (user?.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    const { id: userId } = await params
    const body = await request.json()
    const raw = Array.isArray(body.tags) ? body.tags : []
    const tags: TagRecord[] = raw
      .filter((t: unknown) => t && typeof t === 'object' && 'key' in t && 'value' in t)
      .map((t: { key: string; value: string }) => ({ key: String(t.key), value: String(t.value) }))
    const updated = await setUserTags(userId, tags)
    return NextResponse.json({ tags: updated })
  } catch (error) {
    console.error('[admin/users/[id]/tags] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save tags' }, { status: 500 })
  }
}

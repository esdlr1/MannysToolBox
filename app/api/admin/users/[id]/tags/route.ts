import { NextRequest, NextResponse } from 'next/server'
import { getUserTags, setUserTags, type TagRecord } from '@/lib/user-tags'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET - Get tags for a user (Super Admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error
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
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error
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

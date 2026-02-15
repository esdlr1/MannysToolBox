import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserTags, setUserTags, type TagRecord } from '@/lib/user-tags'

export const dynamic = 'force-dynamic'

// GET - Current user's tags
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tags = await getUserTags(session.user.id)
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('[user/tags] GET error:', error)
    return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 })
  }
}

// PATCH - Update current user's tags. Body: { tags: [{ key, value }, ...] }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const raw = Array.isArray(body.tags) ? body.tags : []
    const tags: TagRecord[] = raw
      .filter((t: unknown) => t && typeof t === 'object' && 'key' in t && 'value' in t)
      .map((t: { key: string; value: string }) => ({ key: String(t.key), value: String(t.value) }))
    const updated = await setUserTags(session.user.id, tags)
    return NextResponse.json({ tags: updated })
  } catch (error) {
    console.error('[user/tags] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save tags' }, { status: 500 })
  }
}

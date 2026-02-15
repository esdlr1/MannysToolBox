import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getToolById } from '@/lib/tools'

export const dynamic = 'force-dynamic'

const MAX_SHORTCUTS = 4

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { preferences: true },
    })

    const prefs = profile?.preferences as { toolShortcuts?: string[] } | null
    const toolShortcuts = Array.isArray(prefs?.toolShortcuts) ? prefs.toolShortcuts : []
    const valid = toolShortcuts.filter((id) => getToolById(id)).slice(0, MAX_SHORTCUTS)

    return NextResponse.json({ toolShortcuts: valid })
  } catch (error) {
    console.error('Tool shortcuts fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const raw = body.toolShortcuts
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: 'toolShortcuts must be an array' },
        { status: 400 }
      )
    }

    const seen = new Set<string>()
    const toolShortcuts: string[] = []
    for (const id of raw) {
      if (typeof id !== 'string' || seen.has(id) || toolShortcuts.length >= MAX_SHORTCUTS) continue
      if (!getToolById(id)) continue
      seen.add(id)
      toolShortcuts.push(id)
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { preferences: true },
    })

    const current = (profile?.preferences as Record<string, unknown>) || {}
    const updated = { ...current, toolShortcuts }

    await prisma.profile.upsert({
      where: { userId: session.user.id },
      update: { preferences: updated },
      create: {
        userId: session.user.id,
        preferences: updated,
      },
    })

    return NextResponse.json({ toolShortcuts })
  } catch (error) {
    console.error('Tool shortcuts update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

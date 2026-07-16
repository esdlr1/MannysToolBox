// "Doesn't apply" — permanently dismiss one finding shape for this user:
// (rule, trigger item, companion). Idempotent.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { ruleName, triggerKey, companionLabel } = await request.json()
    if (!ruleName || !triggerKey || !companionLabel) {
      return NextResponse.json(
        { error: 'Missing ruleName, triggerKey, or companionLabel' },
        { status: 400 }
      )
    }
    await prisma.scopeRuleDismissal.upsert({
      where: {
        userId_ruleName_triggerKey_companionLabel: {
          userId: session.user.id,
          ruleName,
          triggerKey,
          companionLabel,
        },
      },
      create: { userId: session.user.id, ruleName, triggerKey, companionLabel },
      update: {},
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Scope Check] Dismiss failed:', error)
    return NextResponse.json({ error: 'Could not save dismissal' }, { status: 500 })
  }
}

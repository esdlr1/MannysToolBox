// Rule Studio — list scope rules. Seeds the table from the in-code set on
// first use so the UI always has rows to manage.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncSeedRules } from '@/lib/scope-check/rule-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await syncSeedRules()
    const rules = await prisma.scopeRule.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[Rule Studio] List failed:', error)
    return NextResponse.json({ error: 'Could not load rules' }, { status: 500 })
  }
}

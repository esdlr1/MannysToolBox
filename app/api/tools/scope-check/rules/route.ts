// Rule Studio — list scope rules. Seeds the table from the in-code set on
// first use so the UI always has rows to manage.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SEED_RULES } from '@/lib/scope-check/rules'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let rules = await prisma.scopeRule.findMany({ orderBy: { createdAt: 'asc' } })
    if (rules.length === 0) {
      for (const rule of SEED_RULES) {
        await prisma.scopeRule.upsert({
          where: { name: rule.name },
          create: {
            name: rule.name,
            trigger: rule.trigger as unknown as Prisma.InputJsonValue,
            companions: rule.companions as unknown as Prisma.InputJsonValue,
            priority: rule.priority,
            source: rule.source,
            status: rule.status,
            reason: rule.reason,
          },
          update: {},
        })
      }
      rules = await prisma.scopeRule.findMany({ orderBy: { createdAt: 'asc' } })
    }
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[Rule Studio] List failed:', error)
    return NextResponse.json({ error: 'Could not load rules' }, { status: 500 })
  }
}

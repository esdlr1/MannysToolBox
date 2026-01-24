import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listLogicRules } from '@/lib/logic-rules'

export const dynamic = 'force-dynamic'

const RULE_TYPES = ['dependency_rule', 'synonym', 'prompt_hint']
const SCOPES = ['estimate_audit', 'estimate_comparison', 'whats_xact_photo', 'photoxact', 'all']

// GET - List logic rules with optional ?ruleType= & ?scope=
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ruleType = searchParams.get('ruleType') || undefined
    const scope = searchParams.get('scope') || undefined

    const rules = await listLogicRules({
      ruleType: ruleType || undefined,
      scope: scope || undefined,
      userId: session.user.id,
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[logic-rules] GET error:', error)
    return NextResponse.json({ error: 'Failed to list logic rules' }, { status: 500 })
  }
}

// POST - Create a logic rule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ruleType, scope, name, payload, isActive } = body

    if (!ruleType || !RULE_TYPES.includes(ruleType)) {
      return NextResponse.json(
        { error: 'ruleType is required and must be one of: ' + RULE_TYPES.join(', ') },
        { status: 400 }
      )
    }
    if (!scope || !SCOPES.includes(scope)) {
      return NextResponse.json(
        { error: 'scope is required and must be one of: ' + SCOPES.join(', ') },
        { status: 400 }
      )
    }
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'payload is required and must be an object' }, { status: 400 })
    }

    // Basic payload validation by ruleType
    if (ruleType === 'dependency_rule') {
      const t = payload.trigger
      const r = payload.required
      if (!t?.keywords || !Array.isArray(t.keywords) || !r?.keywords || !Array.isArray(r.keywords)) {
        return NextResponse.json(
          { error: 'dependency_rule payload must have trigger.keywords (string[][]) and required.keywords (string[])' },
          { status: 400 }
        )
      }
      if (!payload.missingItem || !payload.reason) {
        return NextResponse.json(
          { error: 'dependency_rule payload must have missingItem and reason' },
          { status: 400 }
        )
      }
    }
    if (ruleType === 'synonym') {
      if (!payload.termA || !payload.termB) {
        return NextResponse.json(
          { error: 'synonym payload must have termA and termB' },
          { status: 400 }
        )
      }
    }
    if (ruleType === 'prompt_hint') {
      if (typeof payload.text !== 'string' || !payload.text.trim()) {
        return NextResponse.json(
          { error: 'prompt_hint payload must have non-empty text' },
          { status: 400 }
        )
      }
    }

    const rule = await prisma.logicRule.create({
      data: {
        userId: session.user.id,
        ruleType,
        scope,
        name: name && String(name).trim() ? String(name).trim() : null,
        payload,
        isActive: isActive !== false,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[logic-rules] POST error:', error)
    return NextResponse.json({ error: 'Failed to create logic rule' }, { status: 500 })
  }
}

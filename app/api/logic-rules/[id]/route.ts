import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const RULE_TYPES = ['dependency_rule', 'synonym', 'prompt_hint']
const SCOPES = ['estimate_audit', 'estimate_comparison', 'whats_xact_photo', 'photoxact', 'all']

// PUT - Update a logic rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.logicRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Logic rule not found' }, { status: 404 })
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { ruleType, scope, name, payload, isActive } = body

    const data: Record<string, unknown> = {}
    if (ruleType !== undefined) {
      if (!RULE_TYPES.includes(ruleType)) {
        return NextResponse.json({ error: 'Invalid ruleType' }, { status: 400 })
      }
      data.ruleType = ruleType
    }
    if (scope !== undefined) {
      if (!SCOPES.includes(scope)) {
        return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
      }
      data.scope = scope
    }
    if (name !== undefined) data.name = name && String(name).trim() ? String(name).trim() : null
    if (payload !== undefined) {
      if (typeof payload !== 'object') {
        return NextResponse.json({ error: 'payload must be an object' }, { status: 400 })
      }
      data.payload = payload
    }
    if (typeof isActive === 'boolean') data.isActive = isActive

    const rule = await prisma.logicRule.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[logic-rules] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update logic rule' }, { status: 500 })
  }
}

// DELETE - Delete a logic rule
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.logicRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Logic rule not found' }, { status: 404 })
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.logicRule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[logic-rules] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete logic rule' }, { status: 500 })
  }
}

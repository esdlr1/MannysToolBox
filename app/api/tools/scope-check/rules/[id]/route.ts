// Rule Studio — approve / mute / re-propose a scope rule.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['proposed', 'approved', 'muted'] as const

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status } = await request.json()
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const rule = await prisma.scopeRule.update({
      where: { id: params.id },
      data: { status },
    })
    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[Rule Studio] Update failed:', error)
    return NextResponse.json({ error: 'Could not update rule' }, { status: 500 })
  }
}

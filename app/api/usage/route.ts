import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Mark as dynamic route since it uses getServerSession
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { toolId, action, metadata } = await request.json()

    await prisma.usageHistory.create({
      data: {
        userId: session.user.id,
        toolId: toolId || 'general',
        action: action || 'unknown',
        metadata: metadata || {},
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Usage logging error:', error)
    return NextResponse.json(
      { error: 'Failed to log usage' },
      { status: 500 }
    )
  }
}

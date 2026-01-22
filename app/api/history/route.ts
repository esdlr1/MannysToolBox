import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Mark as dynamic route since it uses getServerSession
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get usage history
    const history = await prisma.usageHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 entries
    })

    // Get saved work (completed reports)
    const savedWork = await prisma.savedWork.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    // Get uploaded files
    const files = await prisma.file.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        toolId: true,
        originalName: true,
        filename: true,
        size: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      history,
      savedWork,
      files,
    })
  } catch (error) {
    console.error('History fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

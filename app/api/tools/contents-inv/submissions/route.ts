import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function canViewMasterList(userId: string, role: string | null | undefined): Promise<boolean> {
  if (role === 'Super Admin' || role === 'Owner' || role === 'Manager') return true
  const access = await prisma.contentsInvAccess.findUnique({
    where: { userId },
  })
  return !!access
}

// GET - List all submissions (only for Manager, Owner, Super Admin, or users granted access)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await canViewMasterList(
      session.user.id,
      session.user.role
    )
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden - no access to master list' }, { status: 403 })
    }

    const submissions = await prisma.contentsInvSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('[Contents INV] GET submissions error:', error)
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}

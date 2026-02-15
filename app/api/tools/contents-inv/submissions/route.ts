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

// GET - List submissions: Employees see only their own; Managers, Owner, Super Admin, and granted Access see all
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewAll = await canViewMasterList(
      session.user.id,
      session.user.role
    )

    const submissions = await prisma.contentsInvSubmission.findMany({
      where: canViewAll ? undefined : { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({
      submissions,
      scope: canViewAll ? 'all' : 'own',
    })
  } catch (error) {
    console.error('[Contents INV] GET submissions error:', error)
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}

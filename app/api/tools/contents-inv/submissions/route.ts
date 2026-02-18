import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewAllContentsInvSubmissions } from '@/lib/contents-inv-access'

export const dynamic = 'force-dynamic'

// GET - List submissions: Employees see only their own; Estimating managers, Owner, Super Admin, and granted Access see all
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewAll = await canViewAllContentsInvSubmissions(
      session.user.id,
      session.user.role
    )

    // Employees (or non-Estimating managers) see own submissions + submissions assigned to them
    const where = canViewAll
      ? undefined
      : { OR: [{ userId: session.user.id }, { assignedToId: session.user.id }] }

    const submissions = await prisma.contentsInvSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
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

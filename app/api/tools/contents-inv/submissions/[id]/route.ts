import { NextRequest, NextResponse } from 'next/server'
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

// GET - Get one submission by id (only for users who can view master list)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const submission = await prisma.contentsInvSubmission.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('[Contents INV] GET submission error:', error)
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 })
  }
}

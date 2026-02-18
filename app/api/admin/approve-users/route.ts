import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error

    // Get pending approval users (Owner and Manager roles)
    const pendingUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['Owner', 'Manager']
        },
        isApproved: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ users: pendingUsers })
  } catch (error) {
    console.error('Error fetching pending users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error

    const { userId, approved } = await request.json()

    if (!userId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // Update user approval status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: approved },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
      }
    })

    return NextResponse.json({ 
      message: approved ? 'User approved successfully' : 'User approval revoked',
      user: updatedUser 
    })
  } catch (error) {
    console.error('Error updating user approval:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

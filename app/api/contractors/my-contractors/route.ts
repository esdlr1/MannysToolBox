import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Get all contractors created by the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contractors = await prisma.contractor.findMany({
      where: {
        createdById: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      contractors: contractors.map(contractor => ({
        id: contractor.id,
        name: contractor.name,
        email: contractor.email,
        phoneNumber: contractor.phoneNumber,
        city: contractor.city,
        state: contractor.state,
        zipcode: contractor.zipcode,
        company: contractor.company,
        specialty: contractor.specialty,
        notes: contractor.notes,
        createdAt: contractor.createdAt,
        updatedAt: contractor.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Get my contractors error:', error)
    return NextResponse.json(
      { error: 'Failed to get contractors' },
      { status: 500 }
    )
  }
}

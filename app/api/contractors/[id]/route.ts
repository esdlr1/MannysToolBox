import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Get a single contractor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!contractor) {
      return NextResponse.json(
        { error: 'Contractor not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      contractor: {
        id: contractor.id,
        name: contractor.name,
        email: contractor.email,
        phoneNumber: contractor.phoneNumber,
        location: contractor.location,
        company: contractor.company,
        specialty: contractor.specialty,
        notes: contractor.notes,
        createdBy: contractor.createdBy,
        createdAt: contractor.createdAt,
        updatedAt: contractor.updatedAt,
      },
    })
  } catch (error) {
    console.error('Get contractor error:', error)
    return NextResponse.json(
      { error: 'Failed to get contractor' },
      { status: 500 }
    )
  }
}

// PUT - Update a contractor (any authenticated user can edit)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, phoneNumber, location, company, specialty, notes } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Contractor name is required' },
        { status: 400 }
      )
    }

    const contractor = await prisma.contractor.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        location: location?.trim() || null,
        company: company?.trim() || null,
        specialty: specialty?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      contractor: {
        id: contractor.id,
        name: contractor.name,
        email: contractor.email,
        phoneNumber: contractor.phoneNumber,
        location: contractor.location,
        company: contractor.company,
        specialty: contractor.specialty,
        notes: contractor.notes,
        createdBy: contractor.createdBy,
        createdAt: contractor.createdAt,
        updatedAt: contractor.updatedAt,
      },
    })
  } catch (error) {
    console.error('Update contractor error:', error)
    return NextResponse.json(
      { error: 'Failed to update contractor' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a contractor (any authenticated user can delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.contractor.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Contractor deleted successfully',
    })
  } catch (error) {
    console.error('Delete contractor error:', error)
    return NextResponse.json(
      { error: 'Failed to delete contractor' },
      { status: 500 }
    )
  }
}

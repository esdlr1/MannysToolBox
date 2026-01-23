import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT - Update a contact
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Manager/Owner/Admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Manager/Owner access required' },
        { status: 403 }
      )
    }

    const { position, workLocation, phoneNumber, email } = await request.json()

    const contact = await prisma.employeeContact.update({
      where: { id: params.id },
      data: {
        ...(position !== undefined && { position: position || null }),
        ...(workLocation !== undefined && { workLocation: workLocation || null }),
        ...(phoneNumber !== undefined && { phoneNumber: phoneNumber || null }),
        ...(email !== undefined && { email: email || null }),
      },
      include: {
        user: {
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
      contact: {
        id: contact.id,
        userId: contact.userId,
        user: contact.user,
        position: contact.position,
        workLocation: contact.workLocation,
        phoneNumber: contact.phoneNumber,
        email: contact.email,
      },
    })
  } catch (error) {
    console.error('Update contact error:', error)
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    )
  }
}

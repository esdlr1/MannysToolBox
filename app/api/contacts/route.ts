import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope, parseTagsFromQuery } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

// GET - List all contacts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId') || undefined
    const managerIdParam = searchParams.get('managerId') || undefined
    const tags = parseTagsFromQuery(searchParams)

    let where: Record<string, unknown> = {}

    if (user?.role === 'Employee') {
      where.userId = session.user.id
    } else if (user?.role === 'Manager') {
      const employeeIds = await getEmployeeIdsForScope({
        managerId: session.user.id,
        departmentId,
        tags: tags.length ? tags : undefined,
      })
      where.userId = { in: employeeIds }
    } else if (user?.role === 'Owner' || user?.role === 'Super Admin') {
      const hasScope = departmentId || managerIdParam || (tags.length > 0)
      if (hasScope) {
        const employeeIds = await getEmployeeIdsForScope({
          departmentId,
          managerId: managerIdParam,
          tags: tags.length ? tags : undefined,
        })
        where.userId = { in: employeeIds }
      }
    }

    const contacts = await prisma.employeeContact.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    })

    return NextResponse.json({
      success: true,
      contacts: contacts.map(contact => ({
        id: contact.id,
        userId: contact.userId,
        user: contact.user,
        position: contact.position,
        workLocation: contact.workLocation,
        phoneNumber: contact.phoneNumber,
        email: contact.email,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Get contacts error:', error)
    return NextResponse.json(
      { error: 'Failed to get contacts' },
      { status: 500 }
    )
  }
}

// POST - Create a new contact
export async function POST(request: NextRequest) {
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

    const { userId, position, workLocation, phoneNumber, email } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if manager can create contact for this employee (must be in manager's subtree)
    if (user.role === 'Manager') {
      const allowedIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      if (!allowedIds.includes(userId)) {
        return NextResponse.json(
          { error: 'You can only create contacts for employees in your team' },
          { status: 403 }
        )
      }
    }

    const contact = await prisma.employeeContact.upsert({
      where: { userId },
      update: {
        position: position || null,
        workLocation: workLocation || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
      },
      create: {
        userId,
        position: position || null,
        workLocation: workLocation || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
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
    console.error('Create contact error:', error)
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}

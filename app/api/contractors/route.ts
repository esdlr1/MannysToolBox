import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope, parseTagsFromQuery } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

// GET - List contractors; Managers see those created by their reports; Owner/Super Admin can filter by scope
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId') || undefined
    const managerIdParam = searchParams.get('managerId') || undefined
    const tags = parseTagsFromQuery(searchParams)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const where: { createdById?: { in: string[] } } = {}
    if (user?.role === 'Manager') {
      const reportIds = await getEmployeeIdsForScope({
        managerId: session.user.id,
        departmentId,
        tags: tags.length ? tags : undefined,
      })
      where.createdById = { in: [session.user.id, ...reportIds] }
    } else if (user?.role === 'Owner' || user?.role === 'Super Admin') {
      const hasScope = departmentId || managerIdParam || tags.length > 0
      if (hasScope) {
        const employeeIds = await getEmployeeIdsForScope({
          departmentId,
          managerId: managerIdParam,
          tags: tags.length ? tags : undefined,
        })
        where.createdById = { in: employeeIds }
      }
    }

    const contractors = await prisma.contractor.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
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
        createdBy: contractor.createdBy,
        createdAt: contractor.createdAt,
        updatedAt: contractor.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Get contractors error:', error)
    return NextResponse.json(
      { error: 'Failed to get contractors' },
      { status: 500 }
    )
  }
}

// POST - Create a new contractor (any authenticated user can add)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, phoneNumber, city, state, zipcode, company, specialty, notes } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Contractor name is required' },
        { status: 400 }
      )
    }

    const contractor = await prisma.contractor.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zipcode: zipcode?.trim() || null,
        company: company?.trim() || null,
        specialty: specialty?.trim() || null,
        notes: notes?.trim() || null,
        createdById: session.user.id,
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
        city: contractor.city,
        state: contractor.state,
        zipcode: contractor.zipcode,
        company: contractor.company,
        specialty: contractor.specialty,
        notes: contractor.notes,
        createdBy: contractor.createdBy,
        createdAt: contractor.createdAt,
        updatedAt: contractor.updatedAt,
      },
    })
  } catch (error) {
    console.error('Create contractor error:', error)
    return NextResponse.json(
      { error: 'Failed to create contractor' },
      { status: 500 }
    )
  }
}

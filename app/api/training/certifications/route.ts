import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

// GET - Get certifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const courseId = searchParams.get('courseId')

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    // Build where clause based on role
    const where: any = {}
    
    if (user?.role === 'Employee') {
      // Employees can only see their own certifications
      where.employeeId = session.user.id
    } else if (user?.role === 'Manager') {
      // Managers can see certifications for everyone in their subtree (direct + indirect reports)
      const employeeIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      where.employeeId = { in: employeeIds }
    }
    // Owners/Admins can see all

    if (employeeId) {
      where.employeeId = employeeId
    }
    if (courseId) {
      where.courseId = courseId
    }

    const certifications = await prisma.certification.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: {
        issuedDate: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      certifications: certifications.map(cert => ({
        id: cert.id,
        employee: cert.employee,
        course: cert.course,
        name: cert.name,
        description: cert.description,
        issuedDate: cert.issuedDate,
        expiryDate: cert.expiryDate,
        issuer: cert.issuer,
        certificateUrl: cert.certificateUrl,
        isActive: cert.isActive,
        createdAt: cert.createdAt,
        updatedAt: cert.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Get certifications error:', error)
    return NextResponse.json(
      { error: 'Failed to get certifications' },
      { status: 500 }
    )
  }
}

// POST - Create a certification
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

    const { employeeId, courseId, name, description, issuedDate, expiryDate, issuer, certificateUrl } = await request.json()

    if (!employeeId || !name || !issuedDate) {
      return NextResponse.json(
        { error: 'Employee ID, name, and issued date are required' },
        { status: 400 }
      )
    }

    // Check if manager can create certification for this employee (must be in manager's subtree)
    if (user.role === 'Manager') {
      const allowedIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      if (!allowedIds.includes(employeeId)) {
        return NextResponse.json(
          { error: 'You can only create certifications for employees in your team' },
          { status: 403 }
        )
      }
    }

    const certification = await prisma.certification.create({
      data: {
        employeeId,
        courseId: courseId || null,
        name,
        description,
        issuedDate: new Date(issuedDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        issuer: issuer || null,
        certificateUrl: certificateUrl || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      certification: {
        id: certification.id,
        employee: certification.employee,
        course: certification.course,
        name: certification.name,
        description: certification.description,
        issuedDate: certification.issuedDate,
        expiryDate: certification.expiryDate,
        issuer: certification.issuer,
        certificateUrl: certification.certificateUrl,
        isActive: certification.isActive,
      },
    })
  } catch (error) {
    console.error('Create certification error:', error)
    return NextResponse.json(
      { error: 'Failed to create certification' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendFollowUpEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { getEmployeeIdsForScope } from '@/lib/daily-notepad'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true, email: true },
    })

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Manager/Owner access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { employeeId, note } = body

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, email: true, name: true, role: true },
    })

    if (!employee || employee.role !== 'Employee') {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    if (user.role === 'Manager') {
      const allowedIds = await getEmployeeIdsForScope({ managerId: session.user.id })
      if (!allowedIds.includes(employee.id)) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    await sendFollowUpEmail(
      { email: employee.email, name: employee.name },
      note
    )

    await createNotification({
      userId: employee.id,
      type: 'reminder',
      title: 'Follow-up: Daily Notepad Submission',
      message: note
        ? `Manager note: ${note}`
        : 'Please submit your daily notepad as soon as possible.',
      metadata: {
        managerId: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Follow-up error:', error)
    return NextResponse.json(
      { error: 'Failed to send follow-up' },
      { status: 500 }
    )
  }
}

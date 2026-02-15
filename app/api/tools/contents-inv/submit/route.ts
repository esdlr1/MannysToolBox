import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST - Submit a Contents INV form (client name, address, job code, answers as numbers)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clientName, address, customerJobCode, answers, notes } = body

    const clientNameTrimmed = typeof clientName === 'string' ? clientName.trim() : ''
    const addressTrimmed = typeof address === 'string' ? address.trim() : ''
    const jobCodeTrimmed = typeof customerJobCode === 'string' ? customerJobCode.trim() : ''

    if (!clientNameTrimmed || !addressTrimmed || !jobCodeTrimmed) {
      return NextResponse.json(
        { error: 'Client name, address, and customer job code are required' },
        { status: 400 }
      )
    }

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return NextResponse.json({ error: 'answers must be an object mapping item ids to numbers' }, { status: 400 })
    }

    // Validate all values are numbers
    const sanitized: Record<string, number> = {}
    for (const [key, value] of Object.entries(answers)) {
      if (typeof key !== 'string' || key.trim() === '') continue
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(num)) {
        return NextResponse.json({ error: `Answer for "${key}" must be a number` }, { status: 400 })
      }
      sanitized[key.trim()] = num
    }

    const notesTrimmed =
      typeof notes === 'string' ? notes.trim() || null : null

    const submission = await prisma.contentsInvSubmission.create({
      data: {
        userId: session.user.id,
        clientName: clientNameTrimmed,
        address: addressTrimmed,
        customerJobCode: jobCodeTrimmed,
        answers: sanitized as object,
        notes: notesTrimmed,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('[Contents INV] POST submit error:', error)
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 })
  }
}

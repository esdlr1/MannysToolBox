import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Mark as dynamic route since it uses getServerSession
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const savedWork = await prisma.savedWork.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(savedWork)
  } catch (error) {
    console.error('Saved work fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { toolId, title, description, data, files } = await request.json()

    if (!toolId || !title) {
      return NextResponse.json(
        { error: 'Tool ID and title are required' },
        { status: 400 }
      )
    }

    const savedWork = await prisma.savedWork.create({
      data: {
        userId: session.user.id,
        toolId,
        title,
        description: description || null,
        data: data || {},
        files: files || [],
      },
    })

    return NextResponse.json(savedWork)
  } catch (error) {
    console.error('Save work error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

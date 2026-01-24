import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

// GET - Get materials for a course
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      )
    }

    const materials = await prisma.trainingMaterial.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({
      success: true,
      materials,
    })
  } catch (error) {
    console.error('Get materials error:', error)
    return NextResponse.json(
      { error: 'Failed to get materials' },
      { status: 500 }
    )
  }
}

// POST - Add material to a course
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow any authenticated user to add materials to courses

    const formData = await request.formData()
    const courseId = formData.get('courseId') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const fileType = formData.get('fileType') as string
    const fileUrl = formData.get('fileUrl') as string | null
    const file = formData.get('file') as File | null

    if (!courseId || !title || !fileType) {
      return NextResponse.json(
        { error: 'Course ID, title, and file type are required' },
        { status: 400 }
      )
    }

    // Verify course exists
    const course = await prisma.trainingCourse.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      )
    }

    let finalFileUrl = fileUrl

    // Handle file upload if provided
    if (file && file.size > 0) {
      const uploadsDir = join(process.cwd(), 'uploads', 'training', courseId)
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      const timestamp = Date.now()
      const filename = `${timestamp}-${file.name}`
      const filepath = join(uploadsDir, filename)

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filepath, buffer)

      finalFileUrl = `/api/training/files/${courseId}/${filename}`
    }

    // Get the highest order number for this course
    const maxOrder = await prisma.trainingMaterial.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const newOrder = maxOrder ? maxOrder.order + 1 : 0

    const material = await prisma.trainingMaterial.create({
      data: {
        courseId,
        title,
        description: description || null,
        fileType,
        fileUrl: finalFileUrl,
        order: newOrder,
      },
    })

    return NextResponse.json({
      success: true,
      material,
    })
  } catch (error) {
    console.error('Add material error:', error)
    return NextResponse.json(
      { error: 'Failed to add material' },
      { status: 500 }
    )
  }
}

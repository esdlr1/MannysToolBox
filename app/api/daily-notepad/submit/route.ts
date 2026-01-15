import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { saveImageWithThumbnail } from '@/lib/image-utils'
import { getTodayDate, isBeforeDeadline, isWorkday } from '@/lib/daily-notepad'
import { sendSubmissionConfirmation } from '@/lib/email'
import { notifyManagersOnSubmission, createNotification } from '@/lib/notifications'
import { extractTextFromImage } from '@/lib/ocr'
import { createActivity } from '@/lib/activities'
import { randomUUID } from 'crypto'
import path from 'path'

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
      select: { id: true, email: true, name: true, role: true },
    })

    if (!user || user.role !== 'Employee') {
      return NextResponse.json(
        { error: 'Only employees can submit daily notepads' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Check if today is a workday
    const today = getTodayDate()
    if (!isWorkday(today)) {
      return NextResponse.json(
        { error: 'Submissions are only accepted on weekdays' },
        { status: 400 }
      )
    }

    // Get file buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const ext = path.extname(file.name)
    const filename = `${randomUUID()}${ext}`
    const relativePath = `daily-notepad/${filename}`

    // Save image with thumbnail
    const { imagePath, thumbnailPath, originalSize, optimizedSize } = 
      await saveImageWithThumbnail(buffer, filename)

    // Check if submission is on time
    const now = new Date()
    const isOnTime = isBeforeDeadline(now)

    // Extract OCR text (optional, async)
    let ocrText: string | null = null
    try {
      ocrText = await extractTextFromImage(imagePath)
    } catch (error) {
      console.error('OCR extraction error:', error)
      // Continue even if OCR fails
    }

    // Create submission
    const submission = await prisma.dailyNotepadSubmission.create({
      data: {
        userId: user.id,
        date: today,
        imageUrl: imagePath,
        thumbnailUrl: thumbnailPath,
        fileSize: originalSize,
        optimizedSize,
        imageOptimized: true,
        ocrText,
        isOnTime,
        submittedAt: now,
      },
    })

    // Send confirmation email to employee
    try {
      await sendSubmissionConfirmation(user, {
        submissionId: submission.id,
        submittedAt: now,
        isOnTime,
        imageUrl: imagePath,
      })
    } catch (error) {
      console.error('Error sending confirmation email:', error)
      // Continue even if email fails
    }

    // Notify managers/owners
    try {
      await notifyManagersOnSubmission(user.id, user.name, submission.id)
    } catch (error) {
      console.error('Error notifying managers:', error)
      // Continue even if notification fails
    }

    // Create in-app notification for employee
    try {
      await createNotification({
        userId: user.id,
        type: 'confirmation',
        title: 'Notepad Submitted Successfully',
        message: `Your daily notepad has been submitted${isOnTime ? ' on time' : ' (late)'}.`,
        metadata: { submissionId: submission.id },
      })
    } catch (error) {
      console.error('Error creating notification:', error)
    }

    // Log activity
    try {
      await createActivity({
        userId: user.id,
        type: 'notepad_submitted',
        action: 'Daily notepad submitted',
        metadata: {
          submissionId: submission.id,
          date: today.toISOString(),
          isOnTime,
        },
      })
    } catch (error) {
      console.error('Error logging activity:', error)
      // Continue even if activity logging fails
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        date: submission.date,
        submittedAt: submission.submittedAt,
        isOnTime: submission.isOnTime,
        imageUrl: `/api/files/daily-notepad/${path.basename(imagePath)}`,
        thumbnailUrl: `/api/files/daily-notepad/thumbnails/${path.basename(thumbnailPath)}`,
      },
    })
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: 'Failed to submit notepad' },
      { status: 500 }
    )
  }
}

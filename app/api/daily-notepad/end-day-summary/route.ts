import { NextRequest, NextResponse } from 'next/server'
import { getMissingSubmissions, getTodayDate, isWorkday } from '@/lib/daily-notepad'
import { sendEndOfDaySummary } from '@/lib/email'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// This route should be called by a cron job at end of day
// It sends summary emails to managers/owners

export async function POST(request: NextRequest) {
  try {
    // Optional: Add API key authentication for cron jobs
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const today = getTodayDate()

    if (!isWorkday(today)) {
      return NextResponse.json({
        success: true,
        message: 'Not a workday, skipping summary',
      })
    }

    // Get all managers/owners
    const managers = await prisma.user.findMany({
      where: {
        role: {
          in: ['Manager', 'Owner', 'Super Admin'],
        },
        isApproved: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    // Get statistics
    const totalEmployees = await prisma.user.count({
      where: { role: 'Employee' },
    })

    const submittedCount = await prisma.dailyNotepadSubmission.count({
      where: { date: today },
    })

    const missingCount = totalEmployees - submittedCount
    const submissionRate = totalEmployees > 0 ? (submittedCount / totalEmployees) * 100 : 0

    // Get missing employees
    const missing = await getMissingSubmissions(today)

    // Send summary emails to all managers
    for (const manager of managers) {
      try {
        await sendEndOfDaySummary(manager, {
          date: today,
          totalEmployees,
          submittedCount,
          missingCount,
          submissionRate,
          missingEmployees: missing.map(emp => ({
            name: emp.name,
            email: emp.email,
          })),
        })
      } catch (error) {
        console.error(`Error sending summary to ${manager.email}:`, error)
        // Continue with other managers even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      summariesSent: managers.length,
      stats: {
        totalEmployees,
        submittedCount,
        missingCount,
        submissionRate,
      },
    })
  } catch (error) {
    console.error('End of day summary error:', error)
    return NextResponse.json(
      { error: 'Failed to send end of day summary' },
      { status: 500 }
    )
  }
}

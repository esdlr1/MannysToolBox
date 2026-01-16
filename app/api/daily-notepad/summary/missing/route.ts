import { NextRequest, NextResponse } from 'next/server'
import { getMissingSubmissions, getTodayDate, isWorkday } from '@/lib/daily-notepad'
import { sendMissingSummary } from '@/lib/email'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Cron: 9:05 AM summary for managers
export async function POST(request: NextRequest) {
  try {
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

    const totalEmployees = await prisma.user.count({
      where: { role: 'Employee' },
    })

    const submittedCount = await prisma.dailyNotepadSubmission.count({
      where: { date: today },
    })

    const missingCount = Math.max(0, totalEmployees - submittedCount)
    const submissionRate = totalEmployees > 0 ? (submittedCount / totalEmployees) * 100 : 0
    const missing = await getMissingSubmissions(today)

    for (const manager of managers) {
      try {
        await sendMissingSummary(manager, {
          date: today,
          totalEmployees,
          submittedCount,
          missingCount,
          submissionRate,
          missingEmployees: missing.map((emp) => ({
            name: emp.name,
            email: emp.email,
          })),
        })
      } catch (error) {
        console.error(`Error sending missing summary to ${manager.email}:`, error)
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
    console.error('Missing summary error:', error)
    return NextResponse.json(
      { error: 'Failed to send missing summary' },
      { status: 500 }
    )
  }
}

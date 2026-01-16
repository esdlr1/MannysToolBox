import { NextRequest, NextResponse } from 'next/server'
import { getMissingSubmissions, getTodayDate, isWorkday, getEmployeeIdsForScope } from '@/lib/daily-notepad'
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
        role: 'Manager',
        isApproved: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    const owners = await prisma.user.findMany({
      where: {
        role: { in: ['Owner', 'Super Admin'] },
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

    // Send owner/super admin the global summary
    for (const owner of owners) {
      try {
        await sendMissingSummary(owner, {
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
        console.error(`Error sending missing summary to ${owner.email}:`, error)
      }
    }

    // Send manager-specific summaries
    for (const manager of managers) {
      try {
        const employeeIds = await getEmployeeIdsForScope({ managerId: manager.id })
        const scopedTotal = employeeIds.length
        const scopedSubmitted = scopedTotal > 0
          ? await prisma.dailyNotepadSubmission.count({
              where: { date: today, userId: { in: employeeIds } },
            })
          : 0
        const scopedMissing = scopedTotal > 0
          ? await getMissingSubmissions(today, { managerId: manager.id })
          : []
        const scopedMissingCount = scopedMissing.length
        const scopedRate = scopedTotal > 0 ? (scopedSubmitted / scopedTotal) * 100 : 0

        await sendMissingSummary(manager, {
          date: today,
          totalEmployees: scopedTotal,
          submittedCount: scopedSubmitted,
          missingCount: scopedMissingCount,
          submissionRate: scopedRate,
          missingEmployees: scopedMissing.map((emp) => ({
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
      summariesSent: managers.length + owners.length,
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

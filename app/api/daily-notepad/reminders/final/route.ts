import { NextRequest, NextResponse } from 'next/server'
import { getMissingSubmissions, getTodayDate, isWorkday } from '@/lib/daily-notepad'
import { sendReminderEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// Cron: 8:50 AM reminder
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
        message: 'Not a workday, skipping reminders',
      })
    }

    const missing = await getMissingSubmissions(today)

    for (const employee of missing) {
      try {
        await sendReminderEmail({
          email: employee.email,
          name: employee.name,
        })

        await createNotification({
          userId: employee.id,
          type: 'reminder',
          title: 'Final Reminder: Daily Notepad Submission Due',
          message: '8:50 AM reminder: your daily notepad submission is due by 9:00 AM.',
          metadata: { date: today.toISOString(), time: '08:50' },
        })
      } catch (error) {
        console.error(`Error sending reminder to ${employee.email}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      remindersSent: missing.length,
    })
  } catch (error) {
    console.error('Final reminders error:', error)
    return NextResponse.json(
      { error: 'Failed to send final reminders' },
      { status: 500 }
    )
  }
}

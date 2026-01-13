import { NextRequest, NextResponse } from 'next/server'
import { getMissingSubmissions, getTodayDate, isWorkday } from '@/lib/daily-notepad'
import { sendReminderEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// This route should be called by a cron job every 30 minutes after 9 AM
// It sends reminder emails to employees who haven't submitted

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
        message: 'Not a workday, skipping reminders',
      })
    }

    const missing = await getMissingSubmissions(today)

    // Send reminder emails
    for (const employee of missing) {
      try {
        await sendReminderEmail({
          email: employee.email,
          name: employee.name,
        })

        await createNotification({
          userId: employee.id,
          type: 'reminder',
          title: 'Reminder: Daily Notepad Submission Due',
          message: 'Your daily notepad submission is due by 9:00 AM. Please submit as soon as possible.',
          metadata: { date: today.toISOString() },
        })
      } catch (error) {
        console.error(`Error sending reminder to ${employee.email}:`, error)
        // Continue with other employees even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      remindersSent: missing.length,
    })
  } catch (error) {
    console.error('Send reminders error:', error)
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    )
  }
}

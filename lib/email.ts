import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@mannystoolbox.com'

interface EmailUser {
  email: string
  name?: string | null
}

interface SubmissionData {
  submissionId: string
  submittedAt: Date
  isOnTime: boolean
  imageUrl: string
}

/**
 * Send confirmation email to employee when they submit their notepad
 */
export async function sendSubmissionConfirmation(
  employee: EmailUser,
  submission: SubmissionData
): Promise<void> {
  const subject = 'Daily Notepad Submitted Successfully'
  const status = submission.isOnTime ? 'on time' : 'late'
  const timeStatus = submission.isOnTime
    ? 'before the 9 AM deadline'
    : 'after the 9 AM deadline'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .status { padding: 10px; border-radius: 5px; margin: 20px 0; }
        .on-time { background-color: #d1fae5; color: #065f46; }
        .late { background-color: #fee2e2; color: #991b1b; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Daily Notepad Submission Confirmed</h1>
        </div>
        <div class="content">
          <p>Hi ${employee.name || 'there'},</p>
          <p>Your daily notepad has been submitted successfully!</p>
          <div class="status ${submission.isOnTime ? 'on-time' : 'late'}">
            <strong>Status:</strong> Submitted ${status} (${timeStatus})
          </div>
          <p><strong>Submission Time:</strong> ${submission.submittedAt.toLocaleString()}</p>
          <p>Thank you for your submission. Have a productive day!</p>
        </div>
        <div class="footer">
          <p>This is an automated email from Manny's ToolBox</p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: employee.email,
      subject,
      html,
    })
  } catch (error) {
    console.error('Error sending submission confirmation email:', error)
    throw error
  }
}

/**
 * Send notification email to managers/owners when an employee submits
 */
export async function sendManagerNotification(
  manager: EmailUser,
  employee: EmailUser,
  submission: SubmissionData
): Promise<void> {
  const subject = `${employee.name || employee.email} Submitted Daily Notepad`
  const status = submission.isOnTime ? 'on time' : 'late'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Daily Notepad Submission</h1>
        </div>
        <div class="content">
          <p>Hi ${manager.name || 'there'},</p>
          <p><strong>${employee.name || employee.email}</strong> has submitted their daily notepad.</p>
          <div class="info">
            <p><strong>Employee:</strong> ${employee.name || employee.email}</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Submission Time:</strong> ${submission.submittedAt.toLocaleString()}</p>
          </div>
          <p>View all submissions in the dashboard.</p>
        </div>
        <div class="footer">
          <p>This is an automated email from Manny's ToolBox</p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: manager.email,
      subject,
      html,
    })
  } catch (error) {
    console.error('Error sending manager notification email:', error)
    throw error
  }
}

/**
 * Send reminder email to employee about missing submission
 */
export async function sendReminderEmail(employee: EmailUser): Promise<void> {
  const subject = 'Reminder: Daily Notepad Submission Due'
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .reminder { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reminder: Daily Notepad Submission</h1>
        </div>
        <div class="content">
          <p>Hi ${employee.name || 'there'},</p>
          <div class="reminder">
            <p><strong>Reminder:</strong> Your daily notepad submission is due by 9:00 AM.</p>
            <p>Please submit a photo of your yellow notepad as soon as possible.</p>
          </div>
          <p>You can submit your notepad through the Daily Notepad tool in Manny's ToolBox.</p>
          <p>Thank you!</p>
        </div>
        <div class="footer">
          <p>This is an automated email from Manny's ToolBox</p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: employee.email,
      subject,
      html,
    })
  } catch (error) {
    console.error('Error sending reminder email:', error)
    throw error
  }
}

/**
 * Send end of day summary email to managers
 */
export async function sendEndOfDaySummary(
  manager: EmailUser,
  summary: {
    date: Date
    totalEmployees: number
    submittedCount: number
    missingCount: number
    submissionRate: number
    missingEmployees: Array<{ name: string | null; email: string }>
  }
): Promise<void> {
  const subject = `Daily Notepad Summary - ${summary.date.toLocaleDateString()}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .stat-card { background-color: white; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #dc2626; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
        .missing-list { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .missing-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .missing-item:last-child { border-bottom: none; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Daily Notepad Summary</h1>
          <p>${summary.date.toLocaleDateString()}</p>
        </div>
        <div class="content">
          <p>Hi ${manager.name || 'there'},</p>
          <p>Here's the end of day summary for daily notepad submissions:</p>
          <div class="stats">
            <div class="stat-card">
              <div class="stat-value">${summary.submittedCount}</div>
              <div class="stat-label">Submitted</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.missingCount}</div>
              <div class="stat-label">Missing</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.totalEmployees}</div>
              <div class="stat-label">Total Employees</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.submissionRate.toFixed(1)}%</div>
              <div class="stat-label">Submission Rate</div>
            </div>
          </div>
          ${summary.missingCount > 0 ? `
            <div class="missing-list">
              <h3>Missing Submissions (${summary.missingCount}):</h3>
              ${summary.missingEmployees.map(emp => `
                <div class="missing-item">${emp.name || emp.email}</div>
              `).join('')}
            </div>
          ` : ''}
          <p>View detailed reports in the dashboard.</p>
        </div>
        <div class="footer">
          <p>This is an automated email from Manny's ToolBox</p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: manager.email,
      subject,
      html,
    })
  } catch (error) {
    console.error('Error sending end of day summary email:', error)
    throw error
  }
}

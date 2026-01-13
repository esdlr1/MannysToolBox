# Daily Yellow Notepad Tool - Setup Guide

## ✅ Implementation Complete!

All core phases of the Daily Notepad Tool have been implemented. This guide will help you set up and deploy the tool.

---

## 📋 Prerequisites

1. **Database Migration**
   - Run `npm run db:push` to apply the new schema
   - Run `npm run db:generate` to generate Prisma client

2. **Environment Variables**
   Add to your `.env` file:
   ```env
   # Email Service (Resend)
   RESEND_API_KEY="re_xxxxx"  # Get from https://resend.com
   EMAIL_FROM="noreply@mannystoolbox.com"  # Must be verified in Resend
   
   # Optional: Cron Job Authentication
   CRON_SECRET="your-secret-key-here"  # For securing cron endpoints
   ```

3. **Dependencies**
   Already installed:
   - `resend` - Email service
   - `sharp` - Image processing
   - `@types/sharp` - TypeScript types
   - `date-fns` - Date utilities

---

## 🗄️ Database Schema

The following models have been added:
- **DailyNotepadSubmission** - Tracks each submission
- **SubmissionComment** - Comments on submissions
- **Team** - Team/department grouping (future)
- **TeamMember** - Employee-team relationships
- **Notification** - In-app notifications

Run migrations:
```bash
npm run db:push
npm run db:generate
```

---

## 📧 Email Setup (Resend)

1. **Sign up for Resend**
   - Go to https://resend.com
   - Create an account (free tier available)

2. **Get API Key**
   - Go to API Keys section
   - Create a new API key
   - Copy the key (starts with `re_`)

3. **Verify Domain/Email**
   - Add your domain or use a test email
   - For testing, use Resend's test domain
   - Update `EMAIL_FROM` in `.env`

4. **Add to Environment**
   ```env
   RESEND_API_KEY="re_xxxxxxxxxxxxx"
   EMAIL_FROM="noreply@mannystoolbox.com"
   ```

---

## ⏰ Cron Jobs Setup

The tool requires scheduled jobs to:
1. Check for missing submissions (9 AM)
2. Send reminder emails (every 30 minutes after 9 AM)
3. Send end-of-day summary (end of day)

### Option 1: External Cron Service (Recommended)

Use services like:
- **cron-job.org** (free)
- **EasyCron** (free tier)
- **Cronitor**
- **UptimeRobot**

**Setup:**
1. Create a cron job
2. Set schedule:
   - **Check Missing**: `0 9 * * 1-5` (9 AM, weekdays)
   - **Send Reminders**: `*/30 9-17 * * 1-5` (Every 30 min, 9 AM-5 PM, weekdays)
   - **End of Day**: `0 17 * * 1-5` (5 PM, weekdays)
3. Set URL:
   - `POST https://your-domain.com/api/daily-notepad/check-missing`
   - `POST https://your-domain.com/api/daily-notepad/send-reminders`
   - `POST https://your-domain.com/api/daily-notepad/end-day-summary`
4. Add authentication header (if using CRON_SECRET):
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`

### Option 2: Railway Cron Jobs

If Railway supports cron jobs:
- Configure in Railway dashboard
- Use same URLs and schedules as above

### Option 3: Vercel Cron (if using Vercel)

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/daily-notepad/check-missing",
      "schedule": "0 9 * * 1-5"
    },
    {
      "path": "/api/daily-notepad/send-reminders",
      "schedule": "*/30 9-17 * * 1-5"
    },
    {
      "path": "/api/daily-notepad/end-day-summary",
      "schedule": "0 17 * * 1-5"
    }
  ]
}
```

---

## 🎯 Features Implemented

### ✅ Employee Features
- **Mobile-first upload interface**
- **Camera capture** (uses `capture="environment"` for mobile)
- **Drag & drop file upload**
- **Image preview before submission**
- **Today's submission status**
- **Personal submission history** (calendar/list view)
- **Submission confirmation** (email + in-app notification)

### ✅ Manager/Owner Features
- **Dashboard with statistics**
  - Total employees
  - Submissions today
  - Missing submissions
  - Submission rate
- **List view** with filters (date range, employee)
- **Submission detail view**
  - Full-size image
  - Employee information
  - Submission time/status
  - Comments system
- **Notifications** (email + in-app)
- **Missing employees list**
- **End-of-day summary email**

### ✅ System Features
- **Image optimization** (automatic compression)
- **Thumbnail generation**
- **Email notifications** (Resend)
- **In-app notifications**
- **Comments on submissions**
- **9 AM deadline tracking**
- **Weekday-only submissions**
- **Multiple submissions per day supported**

---

## 📱 Mobile Experience

The employee upload interface is optimized for mobile:
- Large camera button (easy to tap)
- Native camera access (`capture="environment"`)
- Touch-friendly interface
- Responsive design

**Camera Access:**
- On mobile devices, tapping "Take Photo" opens the native camera
- The `capture="environment"` attribute uses the back camera
- Images are automatically optimized after upload

---

## 🔒 Security & Permissions

**Role-Based Access:**
- **Employees**: Can submit and view their own submissions
- **Managers/Owners/Super Admins**: Can view all submissions, add comments, see stats

**File Access:**
- Image serving route includes authentication checks
- Users can only access their own images or images they have permission to view (managers)

**API Security:**
- All routes require authentication
- Manager routes check user role
- Cron job routes can use optional API key authentication

---

## 🧪 Testing

1. **Test Employee Submission:**
   - Log in as Employee
   - Navigate to Daily Notepad tool
   - Upload a test image
   - Verify confirmation email received

2. **Test Manager Dashboard:**
   - Log in as Manager/Owner
   - View dashboard statistics
   - View submissions list
   - Click on submission to view details
   - Add a comment

3. **Test Notifications:**
   - Submit as employee
   - Check manager receives notification (email + in-app)
   - Mark notification as read

---

## 📊 API Endpoints

### Employee Routes
- `POST /api/daily-notepad/submit` - Submit notepad photo
- `GET /api/daily-notepad/my-submissions` - Get employee's submissions

### Manager/Owner Routes
- `GET /api/daily-notepad/submissions` - Get all submissions (with filters)
- `GET /api/daily-notepad/submissions/[id]` - Get specific submission
- `GET /api/daily-notepad/stats` - Get statistics
- `GET /api/daily-notepad/missing` - Get missing submissions
- `POST /api/daily-notepad/comments` - Add comment

### Notification Routes
- `GET /api/notifications` - Get user's notifications
- `POST /api/notifications/[id]/read` - Mark as read
- `POST /api/notifications/read-all` - Mark all as read

### Scheduled Job Routes
- `POST /api/daily-notepad/check-missing` - Check for missing (9 AM)
- `POST /api/daily-notepad/send-reminders` - Send reminders (30 min)
- `POST /api/daily-notepad/end-day-summary` - End of day summary

---

## 🔮 Future Enhancements (Optional)

These features are designed but not yet implemented:
- **OCR Text Extraction** - Extract text from images for search
- **Export Reports** - CSV/PDF export functionality
- **Team Management UI** - Full team CRUD interface
- **Configurable Reminders** - Settings for reminder schedules
- **Calendar View** - Visual calendar for managers
- **Advanced Filters** - More filtering options

---

## 🐛 Troubleshooting

**Email not sending?**
- Check RESEND_API_KEY is set correctly
- Verify EMAIL_FROM is verified in Resend
- Check Resend dashboard for errors

**Images not displaying?**
- Check file serving route permissions
- Verify upload directory exists
- Check file paths in database

**Cron jobs not running?**
- Verify cron service is calling correct URLs
- Check authentication headers if using CRON_SECRET
- Test endpoints manually first

**Submissions not appearing?**
- Check database connection
- Verify user role (Employee vs Manager)
- Check browser console for errors

---

## 📝 Notes

- **Submissions are weekday-only** (Monday-Friday)
- **Deadline is 9 AM** (late submissions are allowed)
- **Multiple submissions per day** are supported (all shown)
- **All submissions are tracked** (not just the first one)
- **Image optimization** happens automatically (reduces file size)
- **Thumbnails** are generated for faster loading

---

## 🎉 Ready to Use!

The Daily Notepad Tool is now fully implemented and ready for testing. Follow the setup steps above to get started!

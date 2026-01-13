# Daily Yellow Notepad Tool - Implementation Plan

## Overview
A daily submission system where employees upload photos of their yellow notepad (daily planner) by 9 AM. Managers and Owners receive notifications about submissions and missing submissions. All submissions are tracked and viewable in dashboards.

## Requirements Summary

### Submission Rules
- **Deadline**: 9 AM (late submissions allowed)
- **Frequency**: Daily, weekdays only (no weekends/holidays)
- **Multiple Submissions**: Yes, all submissions are shown
- **Same rules for all employees**: Yes (with future team flexibility)

### Viewing & History
- **Managers/Owners**: Can view all submitted photos in dashboard
- **Employees**: Can view their own submission history
- **Managers**: See all employees, not just their team

### Notifications
- **Types**: Both email and in-app notifications
- **Reminders**: Every 30 minutes until submitted (starting after 9 AM deadline)
- **Confirmation**: Employees get confirmation emails on submission
- **Manager Notifications**: Notified when employee submits

### Mobile Experience
- **Critical**: Mobile-optimized interface
- **Camera Upload**: Direct camera upload in app

### Organization
- **Hierarchy**: Managers see all employees
- **Teams**: Future expansion - teams can be created and employees assigned to teams

---

## Database Schema

### Models Needed

1. **DailyNotepadSubmission**
   - Track each submission (image + metadata)
   - Support multiple submissions per day

2. **Team** (Future-proof)
   - Team name, description
   - Created/updated timestamps

3. **TeamMember**
   - Link employees to teams
   - Many-to-many relationship

4. **Notification**
   - In-app notifications
   - Read/unread status

---

## Technical Architecture

### 1. Email Service
**Option A: Nodemailer** (More control, requires SMTP)
- Use Gmail SMTP, SendGrid, or AWS SES
- More setup required

**Option B: Resend** (Recommended - Easy, modern API)
- Simple API, good free tier
- Modern, developer-friendly

**Recommendation**: Resend (easier setup, good for production)

### 2. Scheduled Jobs
**Challenge**: Next.js doesn't have built-in cron

**Options**:
1. **Vercel Cron** (if using Vercel)
2. **External Cron Service** (cron-job.org, EasyCron)
3. **Railway Cron Jobs** (if Railway supports)
4. **API Route + setInterval** (not recommended for production)

**Recommended Approach**:
- Create API routes for checking submissions
- Use external cron service to call these routes
- Or use Railway's cron job feature if available
- Alternative: Use `node-cron` with a separate worker process

**For Now**: Start with API routes that can be called by external cron service

### 3. File Storage
- Use existing file upload system
- Store images in `uploads/daily-notepad/` directory
- For production: Consider Railway Volumes or cloud storage

---

## Implementation Phases

### Phase 1: Database Schema & Models
- [ ] Add Prisma models: DailyNotepadSubmission, Team, TeamMember, Notification
- [ ] Run migrations
- [ ] Test relationships

### Phase 2: Email Service Setup
- [ ] Install email library (Resend recommended)
- [ ] Set up email templates
- [ ] Create email utility functions
- [ ] Test email sending

### Phase 3: Employee Upload Interface
- [ ] Mobile-first upload component
- [ ] Camera upload functionality
- [ ] Drag & drop support
- [ ] Image preview
- [ ] Submit API route
- [ ] Confirmation email on submit

### Phase 4: Manager/Owner Dashboard
- [ ] Dashboard layout
- [ ] View all submissions (calendar/list view)
- [ ] Filter by date, employee
- [ ] View submission images
- [ ] Missing submissions tracking
- [ ] Statistics/overview

### Phase 5: Employee History View
- [ ] Personal submission history
- [ ] Calendar view
- [ ] View own submissions
- [ ] Submission status indicators

### Phase 6: Notification System
- [ ] In-app notification model
- [ ] Notification API routes
- [ ] Notification display component
- [ ] Mark as read functionality

### Phase 7: Scheduled Reminders
- [ ] API route for checking missing submissions
- [ ] Send reminder emails (every 30 min)
- [ ] Set up cron job (external service or Railway)
- [ ] Stop reminders when submitted

### Phase 8: Team Management (Future-proof)
- [ ] Team CRUD API routes
- [ ] Team management UI (Super Admin/Owner only)
- [ ] Assign employees to teams
- [ ] Team filtering in dashboard (future use)

### Phase 9: Tool Registration
- [ ] Register tool in `lib/tools.ts`
- [ ] Create tool component structure
- [ ] Route configuration

---

## Database Schema Details

```prisma
model DailyNotepadSubmission {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date  // Date of submission (day)
  imageUrl    String   // Path/URL to uploaded image
  submittedAt DateTime @default(now())  // Timestamp of submission
  isOnTime    Boolean  // Submitted before 9 AM deadline
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([date])
  @@index([userId, date])
  @@map("daily_notepad_submissions")
}

model Team {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members TeamMember[]

  @@unique([name])
  @@map("teams")
}

model TeamMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  joinedAt  DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([userId])
  @@index([teamId])
  @@map("team_members")
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // "submission", "reminder", "confirmation", etc.
  title     String
  message   String
  read      Boolean  @default(false)
  metadata  Json?    // Additional data (submissionId, etc.)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, read])
  @@index([createdAt])
  @@map("notifications")
}
```

**Note**: Need to add relations to User model:
- `dailyNotepadSubmissions DailyNotepadSubmission[]`
- `teamMemberships TeamMember[]`
- `notifications Notification[]`

---

## API Routes Needed

### Employee Routes
- `POST /api/daily-notepad/submit` - Submit notepad photo
- `GET /api/daily-notepad/my-submissions` - Get employee's own submissions
- `GET /api/daily-notepad/today-status` - Check if today's submission exists

### Manager/Owner Routes
- `GET /api/daily-notepad/submissions` - Get all submissions (with filters)
- `GET /api/daily-notepad/missing` - Get list of employees who haven't submitted
- `GET /api/daily-notepad/stats` - Get statistics (submission rates, etc.)
- `GET /api/daily-notepad/submissions/:id` - Get specific submission

### Notification Routes
- `GET /api/notifications` - Get user's notifications
- `POST /api/notifications/:id/read` - Mark notification as read
- `POST /api/notifications/read-all` - Mark all as read

### Scheduled Job Routes (Called by cron)
- `POST /api/daily-notepad/check-missing` - Check for missing submissions (9 AM check)
- `POST /api/daily-notepad/send-reminders` - Send reminder emails (every 30 min)

### Team Management Routes (Future)
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create team
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team
- `POST /api/teams/:id/members` - Add member to team
- `DELETE /api/teams/:id/members/:userId` - Remove member from team

---

## Email Templates Needed

1. **Submission Confirmation** (to Employee)
   - Subject: "Daily Notepad Submitted Successfully"
   - Body: Confirmation message with submission time

2. **Manager Notification** (to Manager/Owner)
   - Subject: "[Employee Name] Submitted Daily Notepad"
   - Body: Notification with employee name and submission time

3. **Reminder Email** (to Employee)
   - Subject: "Reminder: Daily Notepad Submission Due"
   - Body: Reminder message about 9 AM deadline

---

## UI Components Needed

### Employee View
- **Upload Component**
  - Camera capture button
  - File upload (drag & drop)
  - Image preview
  - Submit button
  - Status indicator (submitted/not submitted today)

- **History Component**
  - Calendar view
  - List view
  - Image thumbnails
  - Date filters

### Manager/Owner View
- **Dashboard**
  - Overview statistics
  - Today's submissions grid
  - Missing submissions list
  - Calendar view

- **Submission Detail View**
  - Large image view
  - Employee info
  - Submission time
  - All submissions for that day

---

## Environment Variables Needed

```env
# Email Service (Resend)
RESEND_API_KEY="re_xxxxx"

# Or if using Nodemailer
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="noreply@mannystoolbox.com"

# Submission Settings
DAILY_NOTEPAD_DEADLINE_HOUR=9  # 9 AM
DAILY_NOTEPAD_REMINDER_INTERVAL_MINUTES=30
```

---

## Key Functions/Utilities Needed

1. **Email Service** (`lib/email.ts`)
   - `sendSubmissionConfirmation(user, submission)`
   - `sendManagerNotification(manager, employee, submission)`
   - `sendReminderEmail(employee)`

2. **Submission Helpers** (`lib/daily-notepad.ts`)
   - `isWorkday(date)` - Check if date is weekday
   - `isBeforeDeadline(date)` - Check if submission is before 9 AM
   - `getTodaysSubmissions(userId)`
   - `getMissingSubmissions(date)`
   - `getSubmissionStats(startDate, endDate)`

3. **Notification Helpers** (`lib/notifications.ts`)
   - `createNotification(userId, type, title, message, metadata)`
   - `getUnreadNotifications(userId)`
   - `markAsRead(notificationId)`

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1: Database Schema
3. Set up email service (Resend recommended)
4. Build employee upload interface
5. Build manager dashboard
6. Implement notification system
7. Set up scheduled reminders

---

## Additional Features (Included in Implementation)

### Dashboard for Managers/Owners
- **Overview Statistics**: Who submitted, who didn't, submission rate
- **Calendar View**: See submissions by date
- **Filtering**: By employee, department (teams), date range
- **Thumbnail Previews**: Image thumbnails in dashboard
- **Full-size View**: Click to view full-size images (VERY IMPORTANT)

### Employee View
- **Simple Upload Interface**: Drag & drop or camera (mobile-optimized)
- **Personal History/Calendar**: View own submissions in calendar format
- **Submission Status**: Show submitted, pending, missing status

### Notifications (Enhanced)
- **Email + In-App Notifications**: Both types implemented
- **Reminder Emails Before Deadline**: Configurable (optional)
- **Summary Email to Managers**: End of day summary email

### Image Handling
- **Automatic Image Optimization/Compression**: Compress images on upload
- **Thumbnail Generation**: Create thumbnails for dashboard previews
- **Full-size View**: Full-size image view on click (critical feature)
- **Image Storage**: Efficient storage with thumbnails

### Advanced Features
- **OCR (Optical Character Recognition)**: Extract text from notepad images for search
- **Comments/Notes on Submissions**: Managers/Owners can add notes/comments
- **Export Reports**: CSV/PDF export functionality for tracking

---

## Enhanced Database Schema

Add to `DailyNotepadSubmission`:
- `thumbnailUrl` - Thumbnail image path
- `ocrText` - Extracted text from image (for search)
- `comments` - Comments/notes on submission (JSON array)
- `imageOptimized` - Boolean flag for optimization status
- `fileSize` - Original file size
- `optimizedSize` - Optimized file size

Add new model `SubmissionComment`:
- Track comments on submissions
- Who commented, when, what

Add to environment variables:
- Image optimization settings
- OCR API key (if using external OCR service)

---

## Questions for Future Consideration

- Should there be approval/rejection workflow for submissions?
- Should there be different deadlines for different teams (future)?
- Should OCR be optional or required?

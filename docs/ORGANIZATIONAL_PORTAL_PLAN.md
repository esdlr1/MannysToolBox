# Organizational Portal Implementation Plan

## Overview
Transform Manny's ToolBox into a comprehensive organizational portal with announcements, activity tracking, employee directory, calendar, and role-based dashboards.

## Database Schema Updates ✅
- ✅ Added `Department` model
- ✅ Added `departmentId` to `User` model
- ✅ Added `Announcement` model (title, message, author, priority, category, pinned)
- ✅ Added `Activity` model (tracking tool usage, submissions, comparisons)
- ✅ Added `CalendarEvent` model
- ✅ Updated `Notification` model to support announcement notifications

## Implementation Phases

### Phase 1: Core Infrastructure (Priority)
1. **Database Migration**
   - Push schema changes to database
   - Create seed data for departments (if needed)

2. **Announcements System**
   - API routes: Create, List, Update, Delete, Get by ID
   - UI Components: Display list, Create/Edit form, Pinned items
   - Notifications: Email + in-app when new announcement created
   - Authorization: Super Admin, Owner, Manager can create

3. **Department Management**
   - Update user creation/signup to include department selection
   - Department CRUD (for admins)
   - Department filtering in announcements

### Phase 2: Dashboard & Homepage
1. **Role-Based Dashboards**
   - Employee Dashboard: Announcements (latest 3), Yellow Notepad priority, Quick tools, Own activity
   - Manager Dashboard: Announcements, Team activity, Team stats, Tools
   - Owner Dashboard: All announcements, All activity, Company stats, Tools

2. **Homepage Redesign**
   - Replace current landing page with dashboard
   - Equal distribution: Announcements + Tools + Activity
   - Yellow Notepad prominently displayed

### Phase 3: Activity Tracking
1. **Activity Logging**
   - Log tool usage (when tools are accessed)
   - Log notepad submissions (already tracked, enhance)
   - Log estimate comparisons
   - Create Activity service/helper functions

2. **Activity Dashboard**
   - Employee: See own activity
   - Manager: See team activity (filter by department)
   - Owner: See all activity (filter by department/employee)

### Phase 4: Employee Directory
1. **Directory Page**
   - List all employees with department, role, contact info
   - Filter by department
   - Search functionality

2. **Employee Profiles**
   - Profile page with activity summary
   - Department info
   - Recent submissions/activity

### Phase 5: Calendar & Events
1. **Calendar System**
   - Create/edit/delete events
   - Department-specific or company-wide
   - Calendar view component
   - Event notifications

## File Structure

```
app/
  api/
    announcements/
      route.ts (GET, POST)
      [id]/
        route.ts (GET, PUT, DELETE)
    departments/
      route.ts (GET, POST)
      [id]/
        route.ts (GET, PUT, DELETE)
    activities/
      route.ts (GET - filtered by role)
    calendar/
      events/
        route.ts (GET, POST)
        [id]/
          route.ts (GET, PUT, DELETE)
  dashboard/
    page.tsx (Role-based dashboard)
  directory/
    page.tsx (Employee directory)
    [id]/
      page.tsx (Employee profile)
  calendar/
    page.tsx (Calendar view)

lib/
  announcements.ts (Helper functions)
  activities.ts (Activity tracking)
  departments.ts (Department management)
  calendar.ts (Calendar/events)

components/
  announcements/
    AnnouncementList.tsx
    AnnouncementCard.tsx
    AnnouncementForm.tsx
  dashboard/
    EmployeeDashboard.tsx
    ManagerDashboard.tsx
    OwnerDashboard.tsx
    DashboardStats.tsx
    RecentActivity.tsx
  directory/
    EmployeeDirectory.tsx
    EmployeeCard.tsx
  calendar/
    CalendarView.tsx
    EventForm.tsx
```

## Key Features

### Announcements
- Create by: Super Admin, Owner, Manager
- Fields: Title, Message, Priority (low/normal/high/urgent), Category, Pinned
- Display: Latest 3 on dashboard, newest on top
- Notifications: Email + in-app when created
- No read/unread tracking

### Activity Tracking
- Track: Tool usage, Notepad submissions, Estimate comparisons
- View: Employees (own), Managers (team), Owners (all)
- Dashboard: Activity reports and summaries

### Departments
- Assign employees to departments during signup
- Filter announcements/activities by department
- Department pages (future)

### Calendar
- Create events (company-wide or department-specific)
- Calendar view
- Event notifications

## Next Steps
1. Push schema to database
2. Build Announcements API and UI
3. Create role-based dashboards
4. Implement activity tracking
5. Build employee directory
6. Add calendar system

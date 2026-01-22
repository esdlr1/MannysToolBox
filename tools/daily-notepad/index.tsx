'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRoleView } from '@/contexts/RoleViewContext'
import { Upload, Camera, CheckCircle2, X, Calendar, Clock, AlertCircle, FileImage, Users, TrendingUp, Filter, Search, ChevronLeft, ChevronRight, MessageSquare, Download, Eye, Loader2, Bell, BookOpen, GraduationCap, Award, Plus, Edit, Trash2, Play, FileText, Video, Link as LinkIcon } from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isWeekend, addDays, subDays, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'

interface Submission {
  id: string
  userId: string
  user?: {
    id: string
    email: string
    name: string | null
  }
  date: string
  submittedAt: string
  isOnTime: boolean
  imageUrl: string
  thumbnailUrl: string | null
  commentsCount?: number
  reviewStatus?: string | null
  reviewNote?: string | null
  reviewedAt?: string | null
  reviewedBy?: {
    id: string
    email: string
    name: string | null
  } | null
}

interface Stats {
  period: string
  startDate: string
  endDate: string
  totalEmployees: number
  today: {
    submitted: number
    missing: number
    submissionRate: number
  }
  missingEmployees: Array<{
    id: string
    email: string
    name: string | null
  }>
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  metadata?: any
  createdAt: string
}

interface EmployeeStats {
  streak: number
  monthlyCompliance: number
  submittedInMonth: number
  totalWorkdaysInMonth: number
}

export default function DailyNotepadTool() {
  const { data: session } = useSession()
  const { effectiveRole } = useRoleView()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  
  // View state
  const [view, setView] = useState<'employee' | 'manager'>('employee')
  const [currentView, setCurrentView] = useState<'upload' | 'history' | 'calendar'>('upload')
  const [managerView, setManagerView] = useState<'dashboard' | 'list' | 'calendar' | 'detail' | 'training' | 'contacts' | 'survey'>('dashboard')
  
  // Employee calendar state
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
  const [selectedSubmissionDate, setSelectedSubmissionDate] = useState<Submission | null>(null)
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  
  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [todaySubmission, setTodaySubmission] = useState<Submission | null>(null)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null)
  
  // Manager state
  const [stats, setStats] = useState<Stats | null>(null)
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [filterEmployee, setFilterEmployee] = useState<string>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const [filterTeam, setFilterTeam] = useState<string>('all')
  const [filterManager, setFilterManager] = useState<string>('all')
  const [managers, setManagers] = useState<Array<{
    id: string
    name: string | null
    email: string
    assignedEmployeesCount: number
    todaySubmissions: number
    missingToday: number
  }>>([])
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month'>('today')
  const [loadingStats, setLoadingStats] = useState(false)
  const [employees, setEmployees] = useState<Array<{ id: string; name: string | null; email: string }>>([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([])
  const [sendingFollowUpId, setSendingFollowUpId] = useState<string | null>(null)
  const [followUpNote, setFollowUpNote] = useState<string>('')
  const [reviewStatus, setReviewStatus] = useState<'ok' | 'needs_follow_up'>('ok')
  const [reviewNote, setReviewNote] = useState<string>('')
  const [savingReview, setSavingReview] = useState(false)
  const [showMissingPanel, setShowMissingPanel] = useState(false)
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  
  // Comments
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submissionComments, setSubmissionComments] = useState<any[]>([])
  
  // Training state
  const [courses, setCourses] = useState<Array<{
    id: string
    title: string
    description: string | null
    category: string | null
    duration: number | null
    isActive: boolean
    createdBy: { id: string; name: string | null; email: string }
    materialsCount: number
    assignmentsCount: number
    createdAt: string
    updatedAt: string
  }>>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Array<{
    id: string
    employee: { id: string; name: string | null; email: string }
    course: { id: string; title: string; category: string | null; duration: number | null }
    progress: number
    status: string
    dueDate: string | null
    startedAt: string | null
    completedAt: string | null
  }>>([])
  const [certifications, setCertifications] = useState<Array<{
    id: string
    employee: { id: string; name: string | null; email: string }
    course: { id: string; title: string } | null
    name: string
    issuedDate: string
    expiryDate: string | null
    isActive: boolean
  }>>([])
  const [loadingTraining, setLoadingTraining] = useState(false)
  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [newCourse, setNewCourse] = useState({ title: '', description: '', category: '', duration: '' })
  
  // Error state
  const [error, setError] = useState('')

  // Determine view based on effective role (uses view-as role if set, otherwise actual role)
  useEffect(() => {
    if (effectiveRole && ['Manager', 'Owner', 'Super Admin'].includes(effectiveRole)) {
      setView('manager')
    } else {
      setView('employee')
    }
  }, [effectiveRole])

  // Load today's submission for employee
  useEffect(() => {
    if (view === 'employee' && session?.user?.id) {
      loadTodaySubmission()
      loadEmployeeSubmissions()
      loadEmployeeStats()
    }
  }, [view, session])

  // Load stats and submissions for manager
  useEffect(() => {
    if (view === 'manager' && session?.user?.id) {
      loadStats()
      loadAllSubmissions()
      loadNotifications()
      loadEmployees()
      loadDepartments()
      loadTeams()
      // Only Owners can see all managers
      if (effectiveRole === 'Owner' || effectiveRole === 'Super Admin') {
        loadManagers()
      }
    }
  }, [view, session, filterDateRange, filterEmployee, filterTeam, filterDepartment, filterManager, effectiveRole])

  useEffect(() => {
    if (filterEmployee !== 'all') {
      setFilterEmployee('all')
    }
  }, [filterTeam, filterDepartment, filterManager])

  const loadTodaySubmission = async () => {
    try {
      const response = await fetch('/api/daily-notepad/my-submissions?date=' + format(new Date(), 'yyyy-MM-dd'))
      if (response.ok) {
        const data = await response.json()
        if (data.submissions && data.submissions.length > 0) {
          setTodaySubmission(data.submissions[0])
        } else {
          setTodaySubmission(null)
        }
      }
    } catch (error) {
      console.error('Error loading today submission:', error)
    }
  }

  const loadEmployeeSubmissions = async () => {
    setLoadingSubmissions(true)
    try {
      const startDate = startOfMonth(new Date())
      const endDate = endOfMonth(new Date())
      const response = await fetch(`/api/daily-notepad/my-submissions?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`)
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions || [])
      }
    } catch (error) {
      console.error('Error loading submissions:', error)
    } finally {
      setLoadingSubmissions(false)
    }
  }

  const loadEmployeeStats = async () => {
    try {
      const response = await fetch('/api/daily-notepad/my-stats')
      if (response.ok) {
        const data = await response.json()
        setEmployeeStats(data.stats || null)
      }
    } catch (error) {
      console.error('Error loading employee stats:', error)
    }
  }

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const params = new URLSearchParams({
        period: filterDateRange,
      })
      if (filterTeam !== 'all') params.set('teamId', filterTeam)
      if (filterDepartment !== 'all') params.set('departmentId', filterDepartment)
      if (filterManager !== 'all' && (effectiveRole === 'Owner' || effectiveRole === 'Super Admin')) {
        params.set('managerId', filterManager)
      }
      const response = await fetch(`/api/daily-notepad/stats?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const loadAllSubmissions = async () => {
    try {
      let url = '/api/daily-notepad/submissions?'
      if (filterDateRange === 'today') {
        url += `date=${format(new Date(), 'yyyy-MM-dd')}`
      } else if (filterDateRange === 'week') {
        const start = startOfWeek(new Date())
        const end = endOfWeek(new Date())
        url += `startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(end, 'yyyy-MM-dd')}`
      } else {
        const start = startOfMonth(new Date())
        const end = endOfMonth(new Date())
        url += `startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(end, 'yyyy-MM-dd')}`
      }
      if (filterEmployee !== 'all') {
        url += `&userId=${filterEmployee}`
      }
      if (filterTeam !== 'all') {
        url += `&teamId=${filterTeam}`
      }
      if (filterDepartment !== 'all') {
        url += `&departmentId=${filterDepartment}`
      }
      if (filterManager !== 'all' && (effectiveRole === 'Owner' || effectiveRole === 'Super Admin')) {
        url += `&managerId=${filterManager}`
      }
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAllSubmissions(data.submissions || [])
      }
    } catch (error) {
      console.error('Error loading all submissions:', error)
    }
  }

  const loadEmployees = async () => {
    try {
      const params = new URLSearchParams()
      if (filterTeam !== 'all') params.set('teamId', filterTeam)
      if (filterDepartment !== 'all') params.set('departmentId', filterDepartment)
      if (filterManager !== 'all' && (effectiveRole === 'Owner' || effectiveRole === 'Super Admin')) {
        params.set('managerId', filterManager)
      }
      const response = await fetch(`/api/daily-notepad/employees?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/daily-notepad/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/daily-notepad/teams')
      if (response.ok) {
        const data = await response.json()
        setTeams(data.teams || [])
      }
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const loadManagers = async () => {
    try {
      const response = await fetch('/api/daily-notepad/managers')
      if (response.ok) {
        const data = await response.json()
        setManagers(data.managers || [])
      }
    } catch (error) {
      console.error('Error loading managers:', error)
    }
  }

  const loadCourses = async () => {
    setLoadingTraining(true)
    try {
      const response = await fetch('/api/training/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data.courses || [])
      }
    } catch (error) {
      console.error('Error loading courses:', error)
    } finally {
      setLoadingTraining(false)
    }
  }

  const loadAssignments = async () => {
    try {
      const response = await fetch('/api/training/assignments')
      if (response.ok) {
        const data = await response.json()
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
    }
  }

  const loadCertifications = async () => {
    try {
      const response = await fetch('/api/training/certifications')
      if (response.ok) {
        const data = await response.json()
        setCertifications(data.certifications || [])
      }
    } catch (error) {
      console.error('Error loading certifications:', error)
    }
  }

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim()) {
      setError('Course title is required')
      return
    }

    setLoadingTraining(true)
    try {
      const response = await fetch('/api/training/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse),
      })

      if (response.ok) {
        const data = await response.json()
        setCourses([data.course, ...courses])
        setNewCourse({ title: '', description: '', category: '', duration: '' })
        setShowCreateCourse(false)
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create course')
      }
    } catch (error) {
      console.error('Error creating course:', error)
      setError('Failed to create course')
    } finally {
      setLoadingTraining(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?unreadOnly=true')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    setSelectedFile(file)
    setError('')
    setUploadSuccess(false)
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select an image')
      return
    }

    setUploading(true)
    setError('')
    setUploadSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/daily-notepad/submit', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadSuccess(true)
      setSelectedFile(null)
      setPreview(null)
      setTodaySubmission(data.submission)
      loadEmployeeSubmissions()
      
      // Reset after 3 seconds
      setTimeout(() => {
        setUploadSuccess(false)
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload notepad')
    } finally {
      setUploading(false)
    }
  }

  const loadSubmissionDetail = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/daily-notepad/submissions/${submissionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.submission) {
          setSelectedSubmission(data.submission)
          setSubmissionComments(data.submission.comments || [])
          setReviewStatus(data.submission.reviewStatus || 'ok')
          setReviewNote(data.submission.reviewNote || '')
          setManagerView('detail')
        }
      }
    } catch (error) {
      console.error('Error loading submission detail:', error)
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedSubmission) return

    setSubmittingComment(true)
    try {
      const response = await fetch('/api/daily-notepad/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          comment: commentText,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSubmissionComments(prev => [...prev, data.comment])
        setCommentText('')
        loadAllSubmissions() // Refresh to update comment count
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleSendFollowUp = async (employeeId: string) => {
    setSendingFollowUpId(employeeId)
    try {
      const response = await fetch('/api/daily-notepad/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          note: followUpNote.trim() || null,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send follow-up')
      }
      setFollowUpNote('')
    } catch (error) {
      console.error('Error sending follow-up:', error)
    } finally {
      setSendingFollowUpId(null)
    }
  }

  const handleSaveReview = async () => {
    if (!selectedSubmission) return
    setSavingReview(true)
    try {
      const response = await fetch(`/api/daily-notepad/submissions/${selectedSubmission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewStatus,
          reviewNote: reviewNote.trim() || null,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setSelectedSubmission((prev) =>
          prev
            ? {
                ...prev,
                reviewStatus: data.submission.reviewStatus,
                reviewNote: data.submission.reviewNote,
                reviewedAt: data.submission.reviewedAt,
                reviewedBy: data.submission.reviewedBy,
              }
            : prev
        )
      }
    } catch (error) {
      console.error('Error saving review:', error)
    } finally {
      setSavingReview(false)
    }
  }

  const markNotificationRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      })
      loadNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const getReportUrl = (formatType: 'csv' | 'pdf') => {
    const params = new URLSearchParams({ format: formatType })
    if (filterTeam !== 'all') params.set('teamId', filterTeam)
    if (filterDepartment !== 'all') params.set('departmentId', filterDepartment)
    return `/api/daily-notepad/reports?${params.toString()}`
  }

  const handleViewSubmittedToday = () => {
    setFilterDateRange('today')
    setFilterEmployee('all')
    setManagerView('list')
  }

  const handleViewMissingToday = () => {
    setFilterDateRange('today')
    setShowMissingPanel(true)
    setManagerView('dashboard')
  }

  // Employee View
  if (view === 'employee') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl shadow-lg shadow-yellow-500/20">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Daily Yellow Notepad
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                  Submit your daily planner photo by 9:00 AM
                </p>
              </div>
            </div>
          </div>

          {/* Employee Stats */}
          {employeeStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Streak</span>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {employeeStats.streak} day{employeeStats.streak !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Consecutive workdays submitted
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Compliance</span>
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {employeeStats.monthlyCompliance.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {employeeStats.submittedInMonth} of {employeeStats.totalWorkdaysInMonth} workdays
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex space-x-2 mb-8 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl">
            <button
              onClick={() => setCurrentView('upload')}
              className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                currentView === 'upload'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md transform scale-[1.02]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                currentView === 'history'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md transform scale-[1.02]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setCurrentView('calendar')}
              className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                currentView === 'calendar'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md transform scale-[1.02]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Calendar
            </button>
          </div>

          {/* Upload View */}
          {currentView === 'upload' && (
            <div className="space-y-6">
              {/* Status Card */}
              {todaySubmission && (
                <div className="relative overflow-hidden rounded-2xl border backdrop-blur-sm bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-300/50 dark:border-green-800/50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
                          Submitted Today {todaySubmission.isOnTime ? '(On Time)' : '(Late)'}
                        </h3>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Submitted at: {format(new Date(todaySubmission.submittedAt), 'PPp')}
                        </p>
                      </div>
                    </div>
                    <img
                      src={todaySubmission.thumbnailUrl || todaySubmission.imageUrl}
                      alt="Today's submission"
                      className="w-full max-w-md mx-auto rounded-xl border-2 border-green-200 dark:border-green-800 shadow-md"
                    />
                  </div>
                </div>
              )}

              {/* Upload Area */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8">
                {!uploadSuccess ? (
                  <>
                    {preview ? (
                      <div className="space-y-6">
                        <div className="relative group">
                          <div className="relative overflow-hidden rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-lg">
                            <img
                              src={preview}
                              alt="Preview"
                              className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                          <button
                            onClick={() => {
                              setPreview(null)
                              setSelectedFile(null)
                            }}
                            className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-lg hover:scale-110 active:scale-95"
                            title="Remove image"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <button
                          onClick={handleUpload}
                          disabled={uploading}
                          className="w-full py-4 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              Submit Notepad
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Camera Button (Mobile-first) */}
                        <button
                          onClick={handleCameraClick}
                          className="group relative w-full py-16 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-4 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm group-hover:bg-white/30 transition-all">
                            <Camera className="w-14 h-14" />
                          </div>
                          <div className="text-center">
                            <span className="text-xl font-bold block mb-1">Take Photo</span>
                            <span className="text-sm opacity-90 font-normal">Use your camera to capture your notepad</span>
                          </div>
                        </button>
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />

                        {/* Divider */}
                        <div className="flex items-center gap-4">
                          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                          <span className="px-4 py-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full">OR</span>
                          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                        </div>

                        {/* File Upload */}
                        <label
                          htmlFor="file-upload"
                          className="group relative w-full py-16 px-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:border-red-400 dark:hover:border-red-600 hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100/50 dark:hover:from-gray-800/50 dark:hover:to-gray-700/30 transition-all duration-200 flex flex-col items-center justify-center gap-4 hover:shadow-lg"
                        >
                          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl group-hover:bg-red-50 dark:group-hover:bg-red-950/30 transition-all">
                            <FileImage className="w-14 h-14 text-gray-400 dark:text-gray-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                          </div>
                          <div className="text-center">
                            <span className="text-xl font-bold text-gray-700 dark:text-gray-300 block mb-1 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Choose from Gallery</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">Select an image from your device</span>
                          </div>
                        </label>
                        <input
                          id="file-upload"
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </div>
                    )}
                    
                    {error && (
                      <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full shadow-lg mb-6">
                      <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Submission Successful!</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">Your daily notepad has been submitted successfully.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calendar View */}
          {currentView === 'calendar' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/20">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Submission Calendar</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => setCalendarMonth(new Date())}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center">
                    {format(calendarMonth, 'MMMM yyyy')}
                  </h3>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-px mb-4 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div
                      key={day}
                      className="bg-gray-50 dark:bg-gray-800 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-2 uppercase tracking-wide"
                    >
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {(() => {
                    const monthStart = startOfMonth(calendarMonth)
                    const monthEnd = endOfMonth(calendarMonth)
                    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
                    const startDay = monthStart.getDay()
                    const endDay = monthEnd.getDay()

                    // Empty cells before month starts
                    const emptyStart = Array.from({ length: startDay }, (_, i) => (
                      <div key={`empty-start-${i}`} className="aspect-square bg-white dark:bg-gray-900"></div>
                    ))

                    // Month days
                    const monthDays = daysInMonth.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd')
                      const submission = submissions.find((s) => format(new Date(s.date), 'yyyy-MM-dd') === dayStr)
                      const isCurrentDay = isToday(day)
                      const isWeekendDay = isWeekend(day)

                      return (
                        <button
                          key={dayStr}
                          onClick={() => {
                            if (submission) {
                              setSelectedSubmissionDate(submission)
                            }
                          }}
                          className={`aspect-square p-2 transition-all duration-200 relative min-h-[3rem] bg-white dark:bg-gray-900 ${
                            submission
                              ? 'ring-2 ring-green-400 dark:ring-green-700 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer'
                              : isCurrentDay
                              ? 'ring-2 ring-red-400 dark:ring-red-700 bg-red-50 dark:bg-red-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          } ${isWeekendDay ? 'opacity-60' : ''}`}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span
                              className={`text-sm font-semibold ${
                                submission
                                  ? 'text-green-700 dark:text-green-300'
                                  : isCurrentDay
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {format(day, 'd')}
                            </span>
                            {submission && (
                              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })

                    // Empty cells after month ends to complete the last week
                    // Calculate how many cells needed to complete the week (7 days total)
                    const daysAfterMonthEnd = (6 - endDay + 7) % 7
                    const emptyEnd = daysAfterMonthEnd > 0 
                      ? Array.from({ length: daysAfterMonthEnd }, (_, i) => (
                          <div key={`empty-end-${i}`} className="aspect-square bg-white dark:bg-gray-900"></div>
                        ))
                      : []

                    return [...emptyStart, ...monthDays, ...emptyEnd]
                  })()}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-green-400 bg-green-50 dark:bg-green-900/20"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Submitted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-red-400 bg-red-50 dark:bg-red-900/20"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
                  </div>
                </div>

                {/* Submission Detail Modal */}
                {selectedSubmissionDate && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {format(new Date(selectedSubmissionDate.date), 'EEEE, MMMM d, yyyy')}
                        </h3>
                        <button
                          onClick={() => setSelectedSubmissionDate(null)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          aria-label="Close"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="p-6">
                        <div className="mb-6 flex items-center gap-4">
                          <div
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                              selectedSubmissionDate.isOnTime
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                            }`}
                          >
                            {selectedSubmissionDate.isOnTime ? '✓ Submitted On Time' : '⚠ Submitted Late'}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>Submitted at {format(new Date(selectedSubmissionDate.submittedAt), 'PPp')}</span>
                          </div>
                        </div>
                        <div className="relative group">
                          <img
                            src={selectedSubmissionDate.imageUrl}
                            alt={`Submission for ${format(new Date(selectedSubmissionDate.date), 'PP')}`}
                            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-lg"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                        </div>
                        {selectedSubmissionDate.reviewStatus && (
                          <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  selectedSubmissionDate.reviewStatus === 'ok'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                }`}
                              >
                                {selectedSubmissionDate.reviewStatus === 'ok' ? 'Reviewed: OK' : 'Reviewed: Follow-up'}
                              </span>
                              {selectedSubmissionDate.reviewedAt && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {format(new Date(selectedSubmissionDate.reviewedAt), 'PPp')}
                                </span>
                              )}
                            </div>
                            {selectedSubmissionDate.reviewNote && (
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {selectedSubmissionDate.reviewNote}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History View */}
          {currentView === 'history' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Submission History</h2>
                </div>
                
                {loadingSubmissions ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Loading submissions...</p>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-800 mb-4">
                      <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No submissions found</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Your submission history will appear here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                      >
                        {submission.thumbnailUrl && (
                          <div className="relative overflow-hidden">
                            <img
                              src={submission.thumbnailUrl}
                              alt={`Submission ${format(new Date(submission.date), 'PP')}`}
                              className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                        )}
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {format(new Date(submission.date), 'PP')}
                            </span>
                            {submission.isOnTime ? (
                              <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
                                On Time
                              </span>
                            ) : (
                              <span className="px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">
                                Late
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{format(new Date(submission.submittedAt), 'p')}</span>
                          </div>
                          {submission.reviewStatus && (
                            <div className="mt-3 text-xs">
                              <span
                                className={`px-2 py-1 rounded-full font-semibold ${
                                  submission.reviewStatus === 'ok'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                }`}
                              >
                                {submission.reviewStatus === 'ok' ? 'Reviewed: OK' : 'Reviewed: Follow-up'}
                              </span>
                              {submission.reviewNote && (
                                <p className="mt-2 text-gray-600 dark:text-gray-400 line-clamp-2">
                                  {submission.reviewNote}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Manager/Owner View
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Daily Notepad Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Monitor employee daily notepad submissions</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => setManagerView('dashboard')}
                className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            <a
              href={getReportUrl('csv')}
              className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              Export CSV
            </a>
            <a
              href={getReportUrl('pdf')}
              className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              Export PDF
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
          <button
            onClick={() => setManagerView('dashboard')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              managerView === 'dashboard'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setManagerView('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              managerView === 'list'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Submissions
          </button>
          <button
            onClick={() => setManagerView('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              managerView === 'calendar'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setManagerView('training')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              managerView === 'training'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Training
          </button>
          <button
            onClick={() => setManagerView('contacts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              managerView === 'contacts'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Contacts
          </button>
          <button
            onClick={() => setManagerView('survey')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              managerView === 'survey'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Survey
          </button>
        </div>

        {/* Dashboard View */}
        {managerView === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {loadingStats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              </div>
            ) : stats && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {effectiveRole === 'Manager' ? 'Assigned Employees' : 'Total Employees'}
                      </span>
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalEmployees}</p>
                  </div>
                  <button
                    onClick={handleViewSubmittedToday}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Submitted Today</span>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.today.submitted}</p>
                  </button>
                  <button
                    onClick={handleViewMissingToday}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Missing Today</span>
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.today.missing}</p>
                  </button>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Submission Rate</span>
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.today.submissionRate.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Missing Employees */}
                {(stats.missingEmployees.length > 0 || showMissingPanel) && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Missing Submissions ({stats.missingEmployees.length})</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Follow-up note (optional)
                      </label>
                      <input
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        placeholder="Add a quick note to include in follow-ups"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                    {stats.missingEmployees.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No missing submissions for today.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {stats.missingEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{emp.name || emp.email}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{emp.email}</p>
                            </div>
                            <button
                              onClick={() => handleSendFollowUp(emp.id)}
                              disabled={sendingFollowUpId === emp.id}
                              className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {sendingFollowUpId === emp.id ? 'Sending...' : 'Follow up'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Filter Controls */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <select
                        value={filterDateRange}
                        onChange={(e) => setFilterDateRange(e.target.value as 'today' | 'week' | 'month')}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                      </select>
                    </div>
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterTeam}
                      onChange={(e) => setFilterTeam(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Teams</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* List View */}
        {managerView === 'list' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterDateRange}
                    onChange={(e) => setFilterDateRange(e.target.value as 'today' | 'week' | 'month')}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="all">All Teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="all">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submissions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  onClick={() => loadSubmissionDetail(submission.id)}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                >
                  {submission.thumbnailUrl && (
                    <img
                      src={submission.thumbnailUrl}
                      alt={`${submission.user?.name || submission.user?.email} - ${format(new Date(submission.date), 'PP')}`}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {submission.user?.name || submission.user?.email}
                      </p>
                      {submission.isOnTime ? (
                        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
                          On Time
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">
                          Late
                        </span>
                      )}
                    </div>
                    {submission.reviewStatus && (
                      <div className="mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            submission.reviewStatus === 'ok'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}
                        >
                          {submission.reviewStatus === 'ok' ? 'Reviewed: OK' : 'Reviewed: Follow-up'}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {format(new Date(submission.date), 'PP')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(submission.submittedAt), 'p')}
                    </p>
                    {(submission.commentsCount ?? 0) > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <MessageSquare className="w-3 h-3" />
                        {submission.commentsCount ?? 0} comment{(submission.commentsCount ?? 0) !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {allSubmissions.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No submissions found
              </div>
            )}
          </div>
        )}

        {/* Calendar View */}
        {managerView === 'calendar' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {format(selectedDate, 'MMMM yyyy')}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Today
                </button>
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Calendar view - Coming soon
            </div>
          </div>
        )}

        {/* Training View */}
        {managerView === 'training' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Training Center</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Manage training materials, courses, and employee certifications
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Training Materials</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Upload and organize training documents</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Course Management</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Create and assign training courses</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Certifications</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Track employee certifications and compliance</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-8 italic">
                Training features coming soon...
              </p>
            </div>
          </div>
        )}

        {/* Contacts View */}
        {managerView === 'contacts' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Employee Contacts</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Quick access to employee contact information and directories
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Employee Directory</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">View all employee contact details</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Emergency Contacts</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Access emergency contact information</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Department Contacts</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Organize contacts by department</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-8 italic">
                Contact management features coming soon...
              </p>
            </div>
          </div>
        )}

        {/* Survey View */}
        {managerView === 'survey' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Surveys & Feedback</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Create surveys, collect feedback, and analyze employee responses
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Create Survey</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Design and publish employee surveys</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Response Analytics</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">View and analyze survey responses</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Feedback Management</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage employee feedback and suggestions</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-8 italic">
                Survey features coming soon...
              </p>
            </div>
          </div>
        )}

        {/* Training View */}
        {managerView === 'training' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Training Center</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Manage training materials, courses, and employee certifications
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Training Materials</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Upload and organize training documents</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Course Management</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Create and assign training courses</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Certifications</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Track employee certifications and compliance</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-8 italic">
                Training features coming soon...
              </p>
            </div>
          </div>
        )}

        {/* Contacts View */}
        {managerView === 'contacts' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Employee Contacts</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Quick access to employee contact information and directories
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Employee Directory</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">View all employee contact details</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Emergency Contacts</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Access emergency contact information</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Department Contacts</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Organize contacts by department</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-8 italic">
                Contact management features coming soon...
              </p>
            </div>
          </div>
        )}

        {/* Survey View */}
        {managerView === 'survey' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Surveys & Feedback</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Create surveys, collect feedback, and analyze employee responses
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Create Survey</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Design and publish employee surveys</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Response Analytics</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">View and analyze survey responses</p>
                </div>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Feedback Management</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage employee feedback and suggestions</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-8 italic">
                Survey features coming soon...
              </p>
            </div>
          </div>
        )}

        {/* Detail View */}
        {managerView === 'detail' && selectedSubmission && (
          <div className="space-y-6">
            <button
              onClick={() => setManagerView('list')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Submissions
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedSubmission.user?.name || selectedSubmission.user?.email}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {format(new Date(selectedSubmission.date), 'PP')}
                    </p>
                  </div>
                  {selectedSubmission.isOnTime ? (
                    <span className="px-4 py-2 text-sm font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
                      Submitted On Time
                    </span>
                  ) : (
                    <span className="px-4 py-2 text-sm font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">
                      Submitted Late
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {format(new Date(selectedSubmission.submittedAt), 'PPp')}
                  </div>
                </div>
              </div>

              {/* Image */}
              <div className="p-6 bg-gray-50 dark:bg-gray-900">
                <img
                  src={selectedSubmission.imageUrl}
                  alt={`${selectedSubmission.user?.name || selectedSubmission.user?.email} - ${format(new Date(selectedSubmission.date), 'PP')}`}
                  className="w-full max-w-4xl mx-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
                />
              </div>

              {/* Review Section */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Manager Review
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Status
                    </label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value as 'ok' | 'needs_follow_up')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="ok">OK</option>
                      <option value="needs_follow_up">Needs Follow-up</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Last Reviewed
                    </label>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedSubmission.reviewedAt
                        ? format(new Date(selectedSubmission.reviewedAt), 'PPp')
                        : 'Not reviewed yet'}
                    </div>
                    {selectedSubmission.reviewedBy && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        By {selectedSubmission.reviewedBy.name || selectedSubmission.reviewedBy.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Note
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add a short note (optional)"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>
                <button
                  onClick={handleSaveReview}
                  disabled={savingReview}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingReview ? 'Saving...' : 'Save Review'}
                </button>
              </div>

              {/* Comments Section */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Comments ({submissionComments.length})
                </h3>

                {/* Comments List */}
                <div className="space-y-4 mb-6">
                  {submissionComments.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No comments yet</p>
                  ) : (
                    submissionComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {comment.user?.name || comment.user?.email}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(comment.createdAt), 'PPp')}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Form */}
                <div className="space-y-3">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || submittingComment}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submittingComment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4" />
                        Add Comment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

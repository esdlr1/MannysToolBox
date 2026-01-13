'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Upload, Camera, CheckCircle2, X, Calendar, Clock, AlertCircle, FileImage, Users, TrendingUp, Filter, Search, ChevronLeft, ChevronRight, MessageSquare, Download, Eye, Loader2, Bell } from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isWeekend, addDays, subDays, startOfMonth, endOfMonth } from 'date-fns'

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

export default function DailyNotepadTool() {
  const { data: session } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  
  // View state
  const [view, setView] = useState<'employee' | 'manager'>('employee')
  const [currentView, setCurrentView] = useState<'upload' | 'history'>('upload')
  const [managerView, setManagerView] = useState<'dashboard' | 'list' | 'calendar' | 'detail'>('dashboard')
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  
  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [todaySubmission, setTodaySubmission] = useState<Submission | null>(null)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  
  // Manager state
  const [stats, setStats] = useState<Stats | null>(null)
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [filterEmployee, setFilterEmployee] = useState<string>('all')
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month'>('today')
  const [loadingStats, setLoadingStats] = useState(false)
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  
  // Comments
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submissionComments, setSubmissionComments] = useState<any[]>([])
  
  // Error state
  const [error, setError] = useState('')

  // Determine view based on user role
  useEffect(() => {
    if (session?.user?.role && ['Manager', 'Owner', 'Super Admin'].includes(session.user.role)) {
      setView('manager')
    } else {
      setView('employee')
    }
  }, [session])

  // Load today's submission for employee
  useEffect(() => {
    if (view === 'employee' && session?.user?.id) {
      loadTodaySubmission()
      loadEmployeeSubmissions()
    }
  }, [view, session])

  // Load stats and submissions for manager
  useEffect(() => {
    if (view === 'manager' && session?.user?.id) {
      loadStats()
      loadAllSubmissions()
      loadNotifications()
    }
  }, [view, session, filterDateRange, filterEmployee])

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

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const response = await fetch(`/api/daily-notepad/stats?period=${filterDateRange}`)
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
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAllSubmissions(data.submissions || [])
      }
    } catch (error) {
      console.error('Error loading all submissions:', error)
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

  // Employee View
  if (view === 'employee') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Daily Yellow Notepad</h1>
            <p className="text-gray-600 dark:text-gray-400">Submit your daily planner photo by 9:00 AM</p>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setCurrentView('upload')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'upload'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'history'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              History
            </button>
          </div>

          {/* Upload View */}
          {currentView === 'upload' && (
            <div className="space-y-6">
              {/* Status Card */}
              {todaySubmission && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                      Submitted Today {todaySubmission.isOnTime ? '(On Time)' : '(Late)'}
                    </h3>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                    Submitted at: {format(new Date(todaySubmission.submittedAt), 'PPp')}
                  </p>
                  <img
                    src={todaySubmission.thumbnailUrl || todaySubmission.imageUrl}
                    alt="Today's submission"
                    className="w-full max-w-md mx-auto rounded-lg border border-green-200 dark:border-green-800"
                  />
                </div>
              )}

              {/* Upload Area */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
                {!uploadSuccess ? (
                  <>
                    {preview ? (
                      <div className="space-y-4">
                        <div className="relative">
                          <img
                            src={preview}
                            alt="Preview"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                          <button
                            onClick={() => {
                              setPreview(null)
                              setSelectedFile(null)
                            }}
                            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={handleUpload}
                          disabled={uploading}
                          className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                      <div className="space-y-4">
                        {/* Camera Button (Mobile-first) */}
                        <button
                          onClick={handleCameraClick}
                          className="w-full py-12 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex flex-col items-center justify-center gap-3 shadow-lg"
                        >
                          <Camera className="w-12 h-12" />
                          <span className="text-lg">Take Photo</span>
                          <span className="text-sm opacity-90">Use your camera to capture your notepad</span>
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
                          <span className="text-sm text-gray-500 dark:text-gray-400">OR</span>
                          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                        </div>

                        {/* File Upload */}
                        <label
                          htmlFor="file-upload"
                          className="w-full py-12 px-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-red-400 dark:hover:border-red-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex flex-col items-center justify-center gap-3"
                        >
                          <FileImage className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                          <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Choose from Gallery</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Select an image from your device</span>
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
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Submission Successful!</h3>
                    <p className="text-gray-600 dark:text-gray-400">Your daily notepad has been submitted successfully.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History View */}
          {currentView === 'history' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Submission History</h2>
                
                {loadingSubmissions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No submissions found
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {submission.thumbnailUrl && (
                          <img
                            src={submission.thumbnailUrl}
                            alt={`Submission ${format(new Date(submission.date), 'PP')}`}
                            className="w-full h-48 object-cover"
                          />
                        )}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {format(new Date(submission.date), 'PP')}
                            </span>
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
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(submission.submittedAt), 'p')}
                          </p>
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
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Employees</span>
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalEmployees}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Submitted Today</span>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.today.submitted}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Missing Today</span>
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.today.missing}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Submission Rate</span>
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.today.submissionRate.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Missing Employees */}
                {stats.missingEmployees.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Missing Submissions ({stats.missingEmployees.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stats.missingEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{emp.name || emp.email}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{emp.email}</p>
                        </div>
                      ))}
                    </div>
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {format(new Date(submission.date), 'PP')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(submission.submittedAt), 'p')}
                    </p>
                    {submission.commentsCount > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <MessageSquare className="w-3 h-3" />
                        {submission.commentsCount} comment{submission.commentsCount !== 1 ? 's' : ''}
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

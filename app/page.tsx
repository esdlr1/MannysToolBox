'use client'

import { getTools } from '@/lib/tools'
import Image from 'next/image'
import Link from 'next/link'
import { ToolDropdown } from '@/components/ui/tool-dropdown'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Pin, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  message: string
  author: {
    name: string | null
    email: string
  }
  priority: 'low' | 'normal' | 'high' | 'urgent'
  category?: string | null
  pinned: boolean
  createdAt: string
}

export default function Home() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([])

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements?limit=3')
      if (response.ok) {
        const data = await response.json()
        console.log('Announcements fetched:', data)
        setAnnouncements(data.announcements || [])
      } else {
        console.error('Failed to fetch announcements:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = (id: string) => {
    setDismissedAnnouncements((prev) => [...prev, id])
  }

  const priorityConfig = {
    urgent: {
      icon: AlertCircle,
      color: 'text-red-300',
      bg: 'from-red-600/20 to-red-800/20',
      border: 'border-red-500/50',
    },
    high: {
      icon: AlertTriangle,
      color: 'text-orange-300',
      bg: 'from-orange-600/20 to-orange-800/20',
      border: 'border-orange-500/50',
    },
    normal: {
      icon: Info,
      color: 'text-blue-300',
      bg: 'from-blue-600/20 to-blue-800/20',
      border: 'border-blue-500/50',
    },
    low: {
      icon: Info,
      color: 'text-gray-300',
      bg: 'from-gray-600/20 to-gray-800/20',
      border: 'border-gray-500/50',
    },
  }

  const visibleAnnouncements = announcements.filter(
    (ann) => !dismissedAnnouncements.includes(ann.id)
  )
  const latestAnnouncement = visibleAnnouncements[0]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal Navigation Bar */}
      <nav className="w-full py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-end">
          {/* Auth Links */}
          <div className="flex items-center space-x-4">
            <Link
              href="/auth/signin"
              className="text-sm text-gray-700 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Google-like Search Area with Grid Background */}
      <main className="flex-1 flex items-center justify-center px-4 pb-32 relative overflow-hidden">
        {/* Orthogonal Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-gray-900 dark:text-white"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-2xl mx-auto">
          {/* Debug Info - Remove after testing */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded text-xs">
              <p>Loading: {loading ? 'Yes' : 'No'}</p>
              <p>Announcements count: {announcements.length}</p>
              <p>Latest announcement: {latestAnnouncement ? 'Yes' : 'No'}</p>
            </div>
          )}

          {/* Announcements Section - Above Logo */}
          {!loading && latestAnnouncement ? (
            <div className="mb-8">
              <Link
                href="/announcements"
                className="group relative block overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 rounded-2xl p-5 shadow-xl border border-gray-700/50 dark:border-gray-700/30 hover:shadow-2xl transition-all duration-300"
              >
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}></div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-start gap-4">
                    {/* Priority Icon */}
                    <div className="flex-shrink-0">
                      {(() => {
                        const config = priorityConfig[latestAnnouncement.priority] || priorityConfig.normal
                        const Icon = config.icon
                        return (
                          <div className={`w-12 h-12 bg-gradient-to-br ${config.bg} backdrop-blur-sm rounded-xl flex items-center justify-center border ${config.border} shadow-lg`}>
                            <Icon className={`w-6 h-6 ${config.color}`} />
                          </div>
                        )
                      })()}
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {latestAnnouncement.pinned && (
                          <Pin className="w-4 h-4 text-red-500 fill-current" />
                        )}
                        <h3 className="text-lg font-bold text-white truncate group-hover:text-red-100 transition-colors">
                          {latestAnnouncement.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                        {latestAnnouncement.message}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{latestAnnouncement.author.name || latestAnnouncement.author.email}</span>
                        <span>•</span>
                        <span>{format(new Date(latestAnnouncement.createdAt), 'MMM d, yyyy')}</span>
                        {latestAnnouncement.category && (
                          <>
                            <span>•</span>
                            <span>{latestAnnouncement.category}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDismiss(latestAnnouncement.id)
                      }}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                      aria-label="Dismiss announcement"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Shine effect on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              </Link>
            </div>
          ) : !loading && announcements.length === 0 ? (
            <div className="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No announcements yet. Check the browser console for API errors.
            </div>
          ) : null}

          {/* Logo in center */}
          <div className="flex justify-center mb-12">
            <div className="relative flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Manny's ToolBox"
                width={500}
                height={167}
                className="object-contain w-auto h-auto max-w-[600px] max-h-[200px] md:max-w-[800px] md:max-h-[250px]"
                priority
                sizes="(max-width: 768px) 400px, 800px"
              />
            </div>
          </div>

          {/* Beautiful Animated Dropdown */}
          <ToolDropdown tools={getTools()} placeholder="Pick your tool" />

          {/* Yellow Notepad & Activities Section */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-start w-full">
            {/* Yellow Notepad - Left */}
            <Link
              href="/tools/daily-notepad"
              className="group relative overflow-hidden bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 dark:from-yellow-500 dark:via-yellow-600 dark:to-yellow-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex-1 max-w-sm w-full"
            >
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg group-hover:bg-white/30 transition-all duration-300">
                      <svg
                        className="w-7 h-7 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-yellow-50 transition-colors">
                      Daily Yellow Notepad
                    </h3>
                    <p className="text-sm text-white/90 mb-2">
                      Submit your daily planner photo
                    </p>
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Due by 9:00 AM</span>
                    </div>
                  </div>

                  {/* Arrow Icon */}
                  <div className="flex-shrink-0 self-center">
                    <svg
                      className="w-5 h-5 text-white/80 group-hover:text-white group-hover:translate-x-1 transition-all duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </Link>

            {/* Activities - Right */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-800 dark:from-red-700 dark:via-red-800 dark:to-red-900 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 flex-1 max-w-sm w-full">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  {/* Icon */}
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg group-hover:bg-white/30 transition-all duration-300">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white mb-0.5 group-hover:text-red-50 transition-colors">
                      Recent Activity
                    </h3>
                    <p className="text-xs text-white/80">
                      Your latest actions
                    </p>
                  </div>
                </div>

                {/* Activity Items - Only 2 items */}
                <div className="space-y-3">
                  {/* Activity Item 1 */}
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 truncate">
                        Tool used: Estimate Comparison
                      </p>
                      <p className="text-xs text-white/70">2 hours ago</p>
                    </div>
                  </div>

                  {/* Activity Item 2 */}
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-white/80"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 truncate">
                        Notepad submitted
                      </p>
                      <p className="text-xs text-white/70">Yesterday</p>
                    </div>
                  </div>
                </div>

                {/* View All Link */}
                <div className="mt-4 pt-4 border-t border-white/20">
                  <Link
                    href="/history"
                    className="flex items-center justify-between text-sm text-white/80 hover:text-white transition-colors group/link"
                  >
                    <span>View all activity</span>
                    <svg
                      className="w-4 h-4 group-hover/link:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

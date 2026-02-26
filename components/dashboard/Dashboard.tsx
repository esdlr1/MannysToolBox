'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import AnnouncementList from '@/components/announcements/AnnouncementList'
import AnnouncementForm from '@/components/announcements/AnnouncementForm'
import { Plus, ClipboardList, BarChart3, Users } from 'lucide-react'
import Link from 'next/link'
import { getTools } from '@/lib/tools'
import { canCreateAnnouncement as canCreate } from '@/lib/announcements'
import { useRoleView } from '@/contexts/RoleViewContext'

interface DashboardProps {
  role: string | null | undefined
}

export default function Dashboard({ role: propRole }: DashboardProps) {
  const { data: session } = useSession()
  const { effectiveRole } = useRoleView()
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const tools = getTools()

  // Use effectiveRole if available, otherwise fall back to propRole
  const role = effectiveRole || propRole
  const canCreateAnnouncement = canCreate(role)

  const handleAnnouncementSuccess = () => {
    setRefreshKey((prev) => prev + 1)
  }

  // Get Daily Notepad tool
  const dailyNotepadTool = tools.find((t) => t.id === 'daily-notepad')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back, {session?.user?.name || 'User'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {role === 'Employee'
              ? 'Your organizational portal'
              : role === 'Manager'
              ? 'Team management dashboard'
              : 'Company overview dashboard'}
          </p>
        </div>

        {/* Yellow Notepad Priority Section */}
        {dailyNotepadTool && (
          <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  Daily Yellow Notepad
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Submit your daily notepad photo by 9 AM
                </p>
                <Link
                  href={`/tools/${dailyNotepadTool.id}`}
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                >
                  Go to Daily Notepad
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Announcements */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Announcements
                </h2>
                {canCreateAnnouncement && (
                  <button
                    onClick={() => setShowAnnouncementForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New Announcement
                  </button>
                )}
              </div>
              <AnnouncementList
                key={refreshKey}
                limit={3}
                showActions={canCreateAnnouncement}
                currentUserId={session?.user?.id}
                currentUserRole={role}
              />
              <div className="mt-4 text-center">
                <Link
                  href="/announcements"
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  View all announcements →
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Tools & Stats */}
          <div className="space-y-6">
            {/* Quick Tools */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Quick Tools
              </h2>
              <div className="space-y-2">
                {tools.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/tools/${tool.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {tool.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {tool.category}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Stats Placeholder */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Stats
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Activity tracking coming soon...
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Announcement Form Modal */}
      {showAnnouncementForm && (
        <AnnouncementForm
          onClose={() => setShowAnnouncementForm(false)}
          onSuccess={handleAnnouncementSuccess}
        />
      )}
    </div>
  )
}

'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import AnnouncementList from '@/components/announcements/AnnouncementList'
import AnnouncementForm from '@/components/announcements/AnnouncementForm'
import { Plus, Megaphone } from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { canCreateAnnouncement as canCreate } from '@/lib/announcements'

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const canCreateAnnouncement = canCreate(session?.user?.role)

  const handleAnnouncementSuccess = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-500/20">
                <Megaphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Announcements
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                  Stay updated with company news and updates
                </p>
              </div>
            </div>
            {canCreateAnnouncement && (
              <button
                onClick={() => setShowAnnouncementForm(true)}
                className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-xl shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                <span>New Announcement</span>
              </button>
            )}
          </div>

          {/* Announcements List */}
          <AnnouncementList
            key={refreshKey}
            showActions={canCreateAnnouncement}
            currentUserId={session?.user?.id}
            currentUserRole={session?.user?.role}
          />

          {/* Announcement Form Modal */}
          {showAnnouncementForm && (
            <AnnouncementForm
              onClose={() => setShowAnnouncementForm(false)}
              onSuccess={handleAnnouncementSuccess}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

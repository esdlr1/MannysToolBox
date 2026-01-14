'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import AnnouncementList from '@/components/announcements/AnnouncementList'
import AnnouncementForm from '@/components/announcements/AnnouncementForm'
import { Plus } from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const canCreateAnnouncement =
    session?.user?.role === 'Super Admin' ||
    session?.user?.role === 'Owner' ||
    session?.user?.role === 'Manager'

  const handleAnnouncementSuccess = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Company Announcements
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Stay updated with company news and updates
                </p>
              </div>
              {canCreateAnnouncement && (
                <button
                  onClick={() => setShowAnnouncementForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  New Announcement
                </button>
              )}
            </div>

            <AnnouncementList
              key={refreshKey}
              showActions={canCreateAnnouncement}
              currentUserId={session?.user?.id}
              currentUserRole={session?.user?.role}
            />
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
    </ProtectedRoute>
  )
}

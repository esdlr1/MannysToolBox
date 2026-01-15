'use client'

import { useEffect, useState } from 'react'
import AnnouncementCard from './AnnouncementCard'
import { Loader2, AlertCircle, Megaphone } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  message: string
  author: {
    id: string
    name: string | null
    email: string
  }
  priority: 'low' | 'normal' | 'high' | 'urgent'
  category?: string | null
  pinned: boolean
  createdAt: string
}

interface AnnouncementListProps {
  limit?: number
  showActions?: boolean
  currentUserId?: string
  currentUserRole?: string | null
}

export default function AnnouncementList({
  limit,
  showActions = false,
  currentUserId,
  currentUserRole,
}: AnnouncementListProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnnouncements()
  }, [limit])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      setError(null)
      const url = limit
        ? `/api/announcements?limit=${limit}`
        : '/api/announcements'
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        // If it's a database error, show a helpful message
        if (data.error?.includes('database') || data.error?.includes('connection') || data.error?.includes('credentials')) {
          setError('Database connection issue. Please check your database configuration.')
        } else {
          setError(data.error || 'Failed to fetch announcements')
        }
        // Still set empty array to prevent crashes
        setAnnouncements([])
        return
      }

      setAnnouncements(data.announcements || [])
    } catch (err: any) {
      console.error('Error fetching announcements:', err)
      setError('Unable to connect to the server. Please check your connection.')
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (id: string) => {
    // TODO: Open edit modal/form
    console.log('Edit announcement:', id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return
    }

    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete announcement')
      }

      // Refresh list
      fetchAnnouncements()
    } catch (err: any) {
      alert('Failed to delete announcement: ' + err.message)
    }
  }

  const canManage = (announcement: Announcement): boolean => {
    if (!showActions || !currentUserRole) return false
    
    // Super Admin and Owner can manage all
    if (['Super Admin', 'Owner'].includes(currentUserRole)) {
      return true
    }
    
    // Managers can manage their own
    if (currentUserRole === 'Manager' && announcement.author.id === currentUserId) {
      return true
    }
    
    return false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 dark:text-red-400" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading announcements...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Unable to Load Announcements
            </h3>
            <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
            {error.includes('Database') && (
              <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Solution:</strong> Please check your database connection settings in your environment variables.
                  Make sure your <code className="bg-red-200 dark:bg-red-900/50 px-1 rounded">DATABASE_URL</code> is correctly configured.
                </p>
              </div>
            )}
            <button
              onClick={fetchAnnouncements}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (announcements.length === 0) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/50 dark:to-gray-800/30 border border-gray-200 dark:border-gray-800 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-800 mb-4">
          <Megaphone className="w-8 h-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No announcements yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          When announcements are posted, they'll appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          id={announcement.id}
          title={announcement.title}
          message={announcement.message}
          author={announcement.author}
          priority={announcement.priority}
          category={announcement.category}
          pinned={announcement.pinned}
          createdAt={new Date(announcement.createdAt)}
          canEdit={canManage(announcement)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}

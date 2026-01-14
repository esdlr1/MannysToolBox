'use client'

import { useEffect, useState } from 'react'
import AnnouncementCard from './AnnouncementCard'
import { Loader2 } from 'lucide-react'

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
      const url = limit
        ? `/api/announcements?limit=${limit}`
        : '/api/announcements'
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch announcements')
      }

      const data = await response.json()
      setAnnouncements(data.announcements || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load announcements')
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-red-600 dark:text-red-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No announcements yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
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

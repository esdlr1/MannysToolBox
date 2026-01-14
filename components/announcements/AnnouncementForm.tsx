'use client'

import { useState, FormEvent } from 'react'
import { X, Send } from 'lucide-react'

interface AnnouncementFormProps {
  onClose: () => void
  onSuccess: () => void
  initialData?: {
    id: string
    title: string
    message: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
    category?: string | null
    pinned: boolean
  }
}

export default function AnnouncementForm({
  onClose,
  onSuccess,
  initialData,
}: AnnouncementFormProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [message, setMessage] = useState(initialData?.message || '')
  const [priority, setPriority] = useState<
    'low' | 'normal' | 'high' | 'urgent'
  >(initialData?.priority || 'normal')
  const [category, setCategory] = useState(initialData?.category || '')
  const [pinned, setPinned] = useState(initialData?.pinned || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!initialData

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !message.trim()) {
      setError('Title and message are required')
      return
    }

    setLoading(true)

    try {
      const url = isEditing
        ? `/api/announcements/${initialData.id}`
        : '/api/announcements'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority,
          category: category.trim() || null,
          pinned,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save announcement')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save announcement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Announcement' : 'Create Announcement'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              placeholder="Announcement title"
            />
          </div>

          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Message *
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              placeholder="Announcement message"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="priority"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value as 'low' | 'normal' | 'high' | 'urgent'
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Category (optional)
              </label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., General, HR, Operations"
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="pinned"
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <label
              htmlFor="pinned"
              className="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              Pin this announcement (appears at top)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

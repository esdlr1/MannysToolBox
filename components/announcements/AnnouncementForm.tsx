'use client'

import { useState, FormEvent } from 'react'
import { X, Send, AlertCircle } from 'lucide-react'

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
        const errorMessage = data.error || 'Failed to save announcement'
        
        // Provide more helpful error messages
        if (errorMessage.includes('Database') || errorMessage.includes('connection') || errorMessage.includes('credentials')) {
          throw new Error('Database connection failed. Please check your database configuration and try again.')
        } else if (response.status === 401) {
          throw new Error('You are not authorized to create announcements. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error('You do not have permission to create announcements.')
        } else {
          throw new Error(errorMessage)
        }
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error saving announcement:', err)
      setError(err.message || 'Failed to save announcement. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800 transform transition-all duration-200 scale-100">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-800 px-6 py-5 flex items-center justify-between backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Announcement' : 'Create Announcement'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-700 dark:text-red-400 text-sm font-medium mb-1">{error}</p>
                  {error.includes('Database') && (
                    <p className="text-red-600 dark:text-red-300 text-xs mt-2">
                      Make sure your <code className="bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded">DATABASE_URL</code> environment variable is correctly set.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white transition-all placeholder:text-gray-400"
              placeholder="Enter announcement title"
            />
          </div>

          <div>
            <label
              htmlFor="message"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white transition-all resize-none placeholder:text-gray-400"
              placeholder="Enter announcement message"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="priority"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white transition-all"
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
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Category <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white transition-all placeholder:text-gray-400"
                placeholder="e.g., General, HR, Operations"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <input
              id="pinned"
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
            />
            <label
              htmlFor="pinned"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
            >
              Pin this announcement (appears at top)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 transform hover:scale-[1.02] active:scale-[0.98]"
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

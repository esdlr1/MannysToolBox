'use client'

import { format } from 'date-fns'
import { Pin, AlertCircle, Info, AlertTriangle } from 'lucide-react'

interface AnnouncementCardProps {
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
  createdAt: Date
  canEdit?: boolean
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

const priorityConfig = {
  urgent: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Urgent',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    label: 'High Priority',
  },
  normal: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Normal',
  },
  low: {
    icon: Info,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    label: 'Low Priority',
  },
}

export default function AnnouncementCard({
  id,
  title,
  message,
  author,
  priority,
  category,
  pinned,
  createdAt,
  canEdit = false,
  onEdit,
  onDelete,
}: AnnouncementCardProps) {
  const config = priorityConfig[priority] || priorityConfig.normal
  const PriorityIcon = config.icon

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 transition-all
        ${config.borderColor}
        ${config.bgColor}
        ${pinned ? 'ring-2 ring-red-500 dark:ring-red-400' : ''}
        hover:shadow-md
      `}
    >
      {pinned && (
        <div className="absolute top-2 right-2">
          <Pin className="w-5 h-5 text-red-600 dark:text-red-400 fill-current" />
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PriorityIcon className={`w-4 h-4 ${config.color}`} />
            <span className={`text-xs font-semibold ${config.color}`}>
              {config.label}
            </span>
            {category && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                • {category}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>
        </div>
      </div>

      <div className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
        {message}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>By {author.name || author.email}</span>
          <span>•</span>
          <span>{format(new Date(createdAt), 'MMM d, yyyy h:mm a')}</span>
        </div>

        {canEdit && (onEdit || onDelete) && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(id)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(id)}
                className="text-red-600 dark:text-red-400 hover:underline text-xs"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

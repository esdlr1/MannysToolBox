'use client'

import { format } from 'date-fns'
import { Pin, AlertCircle, Info, AlertTriangle, Edit2, Trash2, User } from 'lucide-react'

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
    gradient: 'from-red-500 to-red-600',
    bgGradient: 'from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20',
    borderColor: 'border-red-300/50 dark:border-red-800/50',
    badgeBg: 'bg-red-500/10 dark:bg-red-500/20',
    badgeText: 'text-red-700 dark:text-red-400',
    label: 'Urgent',
    glow: 'shadow-red-500/20',
  },
  high: {
    icon: AlertTriangle,
    gradient: 'from-orange-500 to-orange-600',
    bgGradient: 'from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20',
    borderColor: 'border-orange-300/50 dark:border-orange-800/50',
    badgeBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    badgeText: 'text-orange-700 dark:text-orange-400',
    label: 'High Priority',
    glow: 'shadow-orange-500/20',
  },
  normal: {
    icon: Info,
    gradient: 'from-blue-500 to-blue-600',
    bgGradient: 'from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20',
    borderColor: 'border-blue-300/50 dark:border-blue-800/50',
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    badgeText: 'text-blue-700 dark:text-blue-400',
    label: 'Normal',
    glow: 'shadow-blue-500/20',
  },
  low: {
    icon: Info,
    gradient: 'from-gray-500 to-gray-600',
    bgGradient: 'from-gray-50 to-gray-100/50 dark:from-gray-900/50 dark:to-gray-800/30',
    borderColor: 'border-gray-300/50 dark:border-gray-700/50',
    badgeBg: 'bg-gray-500/10 dark:bg-gray-500/20',
    badgeText: 'text-gray-700 dark:text-gray-400',
    label: 'Low Priority',
    glow: 'shadow-gray-500/10',
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
        group relative overflow-hidden rounded-2xl border backdrop-blur-sm
        bg-gradient-to-br ${config.bgGradient}
        ${config.borderColor}
        ${pinned ? 'ring-2 ring-red-500/50 dark:ring-red-400/50 shadow-lg shadow-red-500/10' : ''}
        shadow-md hover:shadow-xl transition-all duration-300
        hover:scale-[1.01] hover:-translate-y-1
        ${config.glow}
      `}
    >
      {/* Pinned Badge */}
      {pinned && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-lg">
            <Pin className="w-3.5 h-3.5 text-white fill-current" />
            <span className="text-xs font-semibold text-white">Pinned</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {/* Priority Badge */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${config.badgeBg} ${config.badgeText} text-xs font-semibold`}>
                <PriorityIcon className="w-3.5 h-3.5" />
                <span>{config.label}</span>
              </div>
              {category && (
                <span className="px-3 py-1 bg-gray-200/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                  {category}
                </span>
              )}
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight pr-8">
              {title}
            </h3>
          </div>
        </div>

        {/* Message */}
        <div className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap leading-relaxed">
          {message}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="p-1.5 bg-gray-200/50 dark:bg-gray-800/50 rounded-lg">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium">{author.name || author.email}</span>
            </div>
            <span className="text-gray-400 dark:text-gray-500">•</span>
            <span className="text-gray-500 dark:text-gray-400">
              {format(new Date(createdAt), 'MMM d, yyyy')}
            </span>
            <span className="text-gray-400 dark:text-gray-500">•</span>
            <span className="text-gray-500 dark:text-gray-400">
              {format(new Date(createdAt), 'h:mm a')}
            </span>
          </div>

          {/* Action Buttons */}
          {canEdit && (onEdit || onDelete) && (
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(id)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors group/edit"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4 group-hover/edit:scale-110 transition-transform" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors group/delete"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 group-hover/delete:scale-110 transition-transform" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Decorative gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`} />
    </div>
  )
}

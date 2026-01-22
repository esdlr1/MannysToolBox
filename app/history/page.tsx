'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { FileText, Download, Eye, CheckCircle2, Clock, File, ExternalLink } from 'lucide-react'

interface UsageHistoryItem {
  id: string
  toolId: string
  action: string
  metadata: any
  createdAt: string
}

interface SavedWorkItem {
  id: string
  toolId: string
  title: string
  description: string | null
  data: any
  createdAt: string
  updatedAt: string
}

interface FileItem {
  id: string
  toolId: string | null
  originalName: string
  filename: string
  size: number
  createdAt: string
}

export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [history, setHistory] = useState<UsageHistoryItem[]>([])
  const [savedWork, setSavedWork] = useState<SavedWorkItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'reports' | 'files' | 'activity'>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session) {
      fetchHistory()
    }
  }, [session, status, router])

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history')
      if (response.ok) {
        const data = await response.json()
        setHistory(data.history || [])
        setSavedWork(data.savedWork || [])
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getToolName = (toolId: string): string => {
    const toolNames: Record<string, string> = {
      'estimate-comparison': 'Estimate Comparison',
      'estimate-audit': 'Estimate Completeness Audit',
      'daily-notepad': 'Yellow Notepad',
    }
    return toolNames[toolId] || toolId
  }

  const handleViewReport = (savedItem: SavedWorkItem) => {
    // Navigate to the tool with the saved data
    if (savedItem.toolId === 'estimate-comparison') {
      router.push(`/tools/${savedItem.toolId}?saved=${savedItem.id}`)
    } else if (savedItem.toolId === 'estimate-audit') {
      router.push(`/tools/${savedItem.toolId}?saved=${savedItem.id}`)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        <span className="text-red-600 dark:text-red-400">Usage History</span>
      </h1>

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No usage history yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tool
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {item.toolId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {item.action.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.metadata ? JSON.stringify(item.metadata) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

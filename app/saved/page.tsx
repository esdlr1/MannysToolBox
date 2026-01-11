'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'

interface SavedWorkItem {
  id: string
  toolId: string
  title: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export default function SavedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [savedWork, setSavedWork] = useState<SavedWorkItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session) {
      fetchSavedWork()
    }
  }, [session, status, router])

  const fetchSavedWork = async () => {
    try {
      const response = await fetch('/api/saved')
      if (response.ok) {
        const data = await response.json()
        setSavedWork(data)
      }
    } catch (error) {
      console.error('Error fetching saved work:', error)
    } finally {
      setLoading(false)
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
        <span className="text-red-600 dark:text-red-400">Saved Work</span>
      </h1>

      {savedWork.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
          No saved work yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedWork.map((item) => (
            <Link
              key={item.id}
              href={`/tools/${item.toolId}?saved=${item.id}`}
              className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-500">
                <p>Tool: {item.toolId}</p>
                <p>Updated: {format(new Date(item.updatedAt), 'MMM dd, yyyy')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

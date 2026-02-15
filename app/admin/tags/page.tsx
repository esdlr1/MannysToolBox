'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminTagsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/users?tab=tags')
  }, [router])
  return null
}

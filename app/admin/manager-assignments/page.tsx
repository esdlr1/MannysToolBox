'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ManagerAssignmentsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/users?tab=managers')
  }, [router])
  return null
}

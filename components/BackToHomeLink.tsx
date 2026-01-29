'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackToHomeLinkProps {
  href: string
}

export function BackToHomeLink({ href }: BackToHomeLinkProps) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent) => {
    if (href.startsWith('http')) {
      window.location.href = href
      return
    }
    e.preventDefault()
    router.push(href)
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors group cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
      <span className="font-medium">Back to Home</span>
    </a>
  )
}

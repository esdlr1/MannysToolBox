'use client'

import { getTools } from '@/lib/tools'
import Image from 'next/image'
import Link from 'next/link'
import { ToolDropdown } from '@/components/ui/tool-dropdown'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal Navigation Bar */}
      <nav className="w-full py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-end">
          {/* Auth Links */}
          <div className="flex items-center space-x-4">
            <Link
              href="/auth/signin"
              className="text-sm text-gray-700 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Google-like Search Area with Grid Background */}
      <main className="flex-1 flex items-center justify-center px-4 pb-32 relative overflow-hidden">
        {/* Orthogonal Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-gray-900 dark:text-white"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-2xl">
          {/* Logo in center */}
          <div className="flex justify-center mb-12">
            <div className="relative flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Manny's ToolBox"
                width={500}
                height={167}
                className="object-contain w-auto h-auto max-w-[600px] max-h-[200px] md:max-w-[800px] md:max-h-[250px]"
                priority
                sizes="(max-width: 768px) 400px, 800px"
              />
            </div>
          </div>

          {/* Beautiful Animated Dropdown */}
          <ToolDropdown tools={getTools()} placeholder="Pick your tool" />
        </div>
      </main>
    </div>
  )
}

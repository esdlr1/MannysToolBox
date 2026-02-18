'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { getToolsByCategory, getCategories } from '@/lib/tools'
import { useRoleView } from '@/contexts/RoleViewContext'
import Link from 'next/link'
import Image from 'next/image'
import { Eye } from 'lucide-react'

// Get current subdomain
function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname
  const parts = hostname.split('.')
  
  // Handle localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const subdomainMatch = hostname.match(/^([^.]+)\.localhost/)
    if (subdomainMatch) {
      return subdomainMatch[1]
    }
    return null
  }
  
  // Production: extract subdomain
  if (parts.length >= 3) {
    const subdomain = parts[0]
    if (subdomain !== 'www' && subdomain !== 'mannystoolbox') {
      return subdomain
    }
  }
  
  return null
}

// Get tool URL based on environment
function getToolUrl(toolSubdomain: string, toolId?: string): string {
  if (typeof window === 'undefined') return '#'
  
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const port = window.location.port ? `:${window.location.port}` : ''
  
  // Development: use direct path instead of subdomain (easier for local testing)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Use direct path access: /tools/estimate-comparison
    return toolId ? `${protocol}//${hostname}${port}/tools/${toolId}` : `${protocol}//${hostname}${port}/tools/${toolSubdomain}`
  }
  
  // Production: use subdomain.mannystoolbox.com
  return `${protocol}//${toolSubdomain}.mannystoolbox.com`
}

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { viewAsRole, setViewAsRole, effectiveRole, isViewingAs } = useRoleView()
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentSubdomain, setCurrentSubdomain] = useState<string | null>(null)
  const toolMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  const categorizedTools = getToolsByCategory()
  const categories = getCategories()

  useEffect(() => {
    setCurrentSubdomain(getCurrentSubdomain())
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolMenuRef.current && !toolMenuRef.current.contains(event.target as Node)) {
        setIsToolMenuOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setIsRoleMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleToolSelect = (toolSubdomain: string, toolId?: string) => {
    const toolUrl = getToolUrl(toolSubdomain, toolId)
    window.location.href = toolUrl
    setIsToolMenuOpen(false)
    setIsMobileMenuOpen(false)
  }

  const isMainDomain = !currentSubdomain
  const isHomePage = pathname === '/'

  // On subdomain pages, show minimal navigation
  if (!isMainDomain || !isHomePage) {
    return (
      <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Manny's ToolBox"
                width={120}
                height={40}
                className="h-auto w-auto max-h-10 object-contain"
                priority
                sizes="120px"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Tabs Section */}
              {session && (
                <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto mr-4">
                  <Link
                    href="/training"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      pathname === '/training'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Training
                  </Link>
                  <Link
                    href="/contacts"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      pathname === '/contacts'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Contacts
                  </Link>
                  <Link
                    href="/contractors"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      pathname === '/contractors'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Contractors
                  </Link>
                  <Link
                    href="/survey"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      pathname === '/survey'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Survey
                  </Link>
                </div>
              )}
              {/* Pick your tool dropdown */}
              <div className="relative" ref={toolMenuRef}>
                <button
                  onClick={() => setIsToolMenuOpen(!isToolMenuOpen)}
                  className="flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-red-50 dark:hover:bg-gray-700 hover:border-red-300 dark:hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                >
                  <span>Pick your tool</span>
                  <svg
                    className={`ml-2 w-5 h-5 transition-transform ${isToolMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isToolMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-scroll overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: '#dc2626 #f1f1f1' }}>
                    <div className="py-2">
                      {categories.length > 0 ? (
                        categories.map((category) => (
                          <div key={category} className="mb-2">
                            <div className="px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900">
                              {category}
                            </div>
                            {categorizedTools[category]?.map((tool) => (
                              <button
                                key={tool.id}
                                onClick={() => handleToolSelect(tool.subdomain || tool.id, tool.id)}
                                className="w-full text-left px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                <div className="font-medium">{tool.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{tool.description}</div>
                              </button>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                          No tools available yet
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Back to Main Site - Only show on subdomains */}
              {!isMainDomain && (
                <Link
                  href="/"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  ← Back to Main Site
                </Link>
              )}

              {/* Auth Buttons / User Menu */}
              {status === 'loading' ? (
                <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              ) : session ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <span>{session.user?.name || session.user?.email}</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl z-50">
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link
                        href="/teach-logic"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Teach the logic
                      </Link>
                      {(session.user?.role === 'Super Admin' || session.user?.role === 'Owner') && (
                        <>
                          <Link
                            href="/admin/users"
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            Users
                          </Link>
                          {session.user?.role === 'Super Admin' && (
                            <Link
                              href="/admin/settings"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              Settings
                            </Link>
                          )}
                          <hr className="my-1 border-gray-300 dark:border-gray-700" />
                          <div className="relative" ref={roleMenuRef}>
                            <button
                              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                              className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                                isViewingAs
                                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                                  : 'text-gray-700 dark:text-gray-200'
                              } hover:bg-red-50 dark:hover:bg-gray-700 transition-colors`}
                            >
                              <span className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                View As
                              </span>
                              <svg
                                className={`w-4 h-4 transition-transform ${isRoleMenuOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {isRoleMenuOpen && (
                              <div className="absolute left-full ml-2 top-0 w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl z-50">
                                <button
                                  onClick={() => {
                                    setViewAsRole(null)
                                    setIsRoleMenuOpen(false)
                                    setIsUserMenuOpen(false)
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm ${
                                    !isViewingAs
                                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium'
                                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  } transition-colors`}
                                >
                                  Super Admin (Actual)
                                </button>
                                {['Employee', 'Manager', 'Owner', 'Super Admin'].map((role) => (
                                  <button
                                    key={role}
                                    onClick={() => {
                                      setViewAsRole(role as any)
                                      setIsRoleMenuOpen(false)
                                      setIsUserMenuOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm ${
                                      viewAsRole === role
                                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium'
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    } transition-colors`}
                                  >
                                    {role}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {isViewingAs && (
                            <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
                              Viewing as: <span className="font-semibold">{viewAsRole}</span>
                            </div>
                          )}
                        </>
                      )}
                      <Link
                        href="/announcements"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Announcements
                      </Link>
                      <Link
                        href="/history"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Usage History
                      </Link>
                      <Link
                        href="/saved"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Saved Work
                      </Link>
                      <hr className="my-1 border-gray-300 dark:border-gray-700" />
                      <button
                        onClick={() => {
                          signOut({ callbackUrl: '/' })
                          setIsUserMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    href="/auth/signin"
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="space-y-2">
                {/* Mobile Tabs */}
                {session && (
                  <>
                    <div className="px-4 py-2">
                      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
                        <Link
                          href="/training"
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                            pathname === '/training'
                              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Training
                        </Link>
                        <Link
                          href="/contacts"
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                            pathname === '/contacts'
                              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Contacts
                        </Link>
                        <Link
                          href="/contractors"
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                            pathname === '/contractors'
                              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Contractors
                        </Link>
                        <Link
                          href="/survey"
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                            pathname === '/survey'
                              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Survey
                        </Link>
                      </div>
                    </div>
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                  </>
                )}
                {categories.map((category) => (
                  <div key={category} className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 uppercase">
                      {category}
                    </div>
                    {categorizedTools[category]?.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolSelect(tool.subdomain || tool.id, tool.id)}
                        className="w-full text-left px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700"
                      >
                        {tool.name}
                      </button>
                    ))}
                  </div>
                ))}
                {!isMainDomain && (
                  <Link
                    href="/"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200"
                  >
                    ← Back to Main Site
                  </Link>
                )}
                <hr className="my-2 border-gray-200 dark:border-gray-700" />
                {session ? (
                  <>
                    <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">Profile</Link>
                    <Link href="/teach-logic" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">Teach the logic</Link>
                    {(session.user?.role === 'Super Admin' || session.user?.role === 'Owner') && (
                      <Link href="/admin/users" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">Users</Link>
                    )}
                    {session.user?.role === 'Super Admin' && (
                      <Link href="/admin/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">Settings</Link>
                    )}
                    <Link href="/announcements" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">Announcements</Link>
                    <Link href="/history" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">History</Link>
                    <Link href="/saved" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">Saved Work</Link>
                    {session.user?.role === 'Super Admin' && (
                      <>
                        <hr className="my-2 border-gray-200 dark:border-gray-700" />
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">View As</div>
                        <button
                          onClick={() => {
                            setViewAsRole(null)
                            setIsMobileMenuOpen(false)
                          }}
                          className={`w-full text-left px-4 py-2 text-sm ${
                            !isViewingAs
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium'
                              : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          Super Admin (Actual)
                        </button>
                        {['Employee', 'Manager', 'Owner', 'Super Admin'].map((role) => (
                          <button
                            key={role}
                            onClick={() => {
                              setViewAsRole(role as any)
                              setIsMobileMenuOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2 text-sm ${
                              viewAsRole === role
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                        {isViewingAs && (
                          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                            Viewing as: <span className="font-semibold">{viewAsRole}</span>
                          </div>
                        )}
                      </>
                    )}
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/signin" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200">Sign In</Link>
                    <Link href="/auth/signup" className="block px-4 py-2 text-sm text-white bg-red-600 rounded-lg">Sign Up</Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>
    )
  }

  // On home page, don't render navigation (handled in page.tsx)
  return null
}

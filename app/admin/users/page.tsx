'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Shield, UserCheck, Tag, UserPlus, Building2, Loader2, UserCog } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ApprovalsSection from './ApprovalsSection'
import ManagerAssignmentsSection from './ManagerAssignmentsSection'
import TagsSection from './TagsSection'
import CreateUserSection from './CreateUserSection'
import DepartmentsSection from './DepartmentsSection'
import AssignUserSection from './AssignUserSection'

type TabId = 'assign' | 'approvals' | 'managers' | 'tags' | 'departments' | 'create'

const TABS: { id: TabId; label: string; icon: typeof Shield; superAdminOnly?: boolean; ownerOrSuperAdmin?: boolean }[] = [
  { id: 'assign', label: 'Assign user', icon: UserCog, superAdminOnly: true },
  { id: 'approvals', label: 'User Approvals', icon: Shield, superAdminOnly: true },
  { id: 'managers', label: 'Manager Assignments', icon: UserCheck, ownerOrSuperAdmin: true },
  { id: 'tags', label: 'Tags', icon: Tag, superAdminOnly: true },
  { id: 'departments', label: 'Departments', icon: Building2, superAdminOnly: true },
  { id: 'create', label: 'Create user', icon: UserPlus, superAdminOnly: true },
]

function normalizeRole(role: string | null | undefined): string | null {
  const r = (role ?? '').trim()
  return r === '' ? null : r
}

function AdminUsersPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabId>('approvals')
  const [fetchedRole, setFetchedRole] = useState<string | null | undefined>(undefined)

  const sessionRole = normalizeRole(session?.user?.role as string | null | undefined)
  const effectiveRole = sessionRole ?? (fetchedRole !== undefined ? fetchedRole : null)
  const isSuperAdmin = effectiveRole === 'Super Admin' || effectiveRole === 'SuperAdmin'
  const isOwner = effectiveRole === 'Owner'
  const canAccess = isSuperAdmin || isOwner
  const roleKnown = sessionRole != null || fetchedRole !== undefined

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    if (sessionRole == null && session.user?.id && fetchedRole === undefined) {
      fetch('/api/profile', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setFetchedRole(data?.role != null ? normalizeRole(data.role) : null))
        .catch(() => setFetchedRole(null))
    }
  }, [session, status, sessionRole, fetchedRole])

  useEffect(() => {
    if (status === 'loading' || !session) return
    if (roleKnown && !canAccess) router.push('/')
  }, [session, status, canAccess, roleKnown, router])

  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null
    if (t && ['assign', 'approvals', 'managers', 'tags', 'departments', 'create'].includes(t)) {
      if ((t === 'assign' || t === 'tags' || t === 'approvals' || t === 'departments' || t === 'create') && !isSuperAdmin) return
      setTab(t)
    }
  }, [searchParams, isSuperAdmin])

  const visibleTabs = TABS.filter(
    (x) =>
      (x.ownerOrSuperAdmin && (isOwner || isSuperAdmin)) ||
      (x.superAdminOnly && isSuperAdmin)
  )
  useEffect(() => {
    if (!canAccess || visibleTabs.length === 0) return
    const currentVisible = visibleTabs.some((x) => x.id === tab)
    if (!currentVisible) setTab(visibleTabs[0].id)
  }, [canAccess, tab, visibleTabs])

  const setTabAndUrl = (t: TabId) => {
    setTab(t)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', t)
    window.history.replaceState({}, '', url.pathname + url.search)
  }

  if (status === 'loading' || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!canAccess) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Users</h1>
        </div>
        <p className="text-muted-foreground">
          User approvals, manager assignments, employee tags, and everything user-related.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTabAndUrl(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              tab === id
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {TABS.find((t) => t.id === tab)?.label ?? tab}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tab === 'assign' && isSuperAdmin && <AssignUserSection />}
          {tab === 'approvals' && <ApprovalsSection />}
          {tab === 'managers' && <ManagerAssignmentsSection />}
          {tab === 'tags' && isSuperAdmin && <TagsSection />}
          {tab === 'departments' && isSuperAdmin && <DepartmentsSection />}
          {tab === 'create' && isSuperAdmin && <CreateUserSection />}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AdminUsersPageContent />
    </Suspense>
  )
}

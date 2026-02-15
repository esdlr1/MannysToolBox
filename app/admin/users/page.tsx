'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Shield, UserCheck, Tag, UserPlus, Building2, Loader2, UsersRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ApprovalsSection from './ApprovalsSection'
import ManagerAssignmentsSection from './ManagerAssignmentsSection'
import TagsSection from './TagsSection'
import CreateUserSection from './CreateUserSection'
import DepartmentsSection from './DepartmentsSection'
import TeamsSection from './TeamsSection'

type TabId = 'approvals' | 'managers' | 'tags' | 'departments' | 'teams' | 'create'

const TABS: { id: TabId; label: string; icon: typeof Shield; superAdminOnly?: boolean; ownerOrSuperAdmin?: boolean }[] = [
  { id: 'approvals', label: 'User Approvals', icon: Shield, superAdminOnly: true },
  { id: 'managers', label: 'Manager Assignments', icon: UserCheck, ownerOrSuperAdmin: true },
  { id: 'tags', label: 'Employee Tags', icon: Tag, superAdminOnly: true },
  { id: 'departments', label: 'Departments', icon: Building2, superAdminOnly: true },
  { id: 'teams', label: 'Teams', icon: UsersRound, ownerOrSuperAdmin: true },
  { id: 'create', label: 'Create user', icon: UserPlus, superAdminOnly: true },
]

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabId>('approvals')

  const isSuperAdmin = session?.user?.role === 'Super Admin'
  const isOwner = session?.user?.role === 'Owner'
  const canAccess = isSuperAdmin || isOwner

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    if (!canAccess) {
      router.push('/')
      return
    }
  }, [session, status, canAccess, router])

  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null
    if (t && ['approvals', 'managers', 'tags', 'departments', 'teams', 'create'].includes(t)) {
      if ((t === 'tags' || t === 'approvals' || t === 'departments' || t === 'create') && !isSuperAdmin) return
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
          {tab === 'approvals' && <ApprovalsSection />}
          {tab === 'managers' && <ManagerAssignmentsSection />}
          {tab === 'tags' && isSuperAdmin && <TagsSection />}
          {tab === 'departments' && isSuperAdmin && <DepartmentsSection />}
          {tab === 'teams' && <TeamsSection />}
          {tab === 'create' && isSuperAdmin && <CreateUserSection />}
        </CardContent>
      </Card>
    </div>
  )
}

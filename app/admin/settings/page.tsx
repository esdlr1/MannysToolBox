'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, MapPin, Shield, Loader2, Plus, Pencil, Trash2, Users, ChevronRight, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface HierarchyNode {
  id: string
  name: string | null
  email: string
  role: string | null
  children: HierarchyNode[]
}

function HierarchyTree({ node, depth }: { node: HierarchyNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  return (
    <li className="list-none">
      <div
        className={`flex items-center gap-2 py-1.5 pr-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 ${depth > 0 ? 'border-l-2 border-gray-200 dark:border-gray-700 ml-2 pl-3' : ''}`}
        style={{ marginLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-5 inline-block" />
        )}
        <span className="font-medium text-gray-900 dark:text-gray-100">{node.name || node.email}</span>
        {node.name && <span className="text-muted-foreground truncate max-w-[12rem]">{node.email}</span>}
        {node.role && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted-foreground">
            {node.role}
          </span>
        )}
      </div>
      {hasChildren && open && (
        <ul className="space-y-0 mt-0">
          {node.children.map((child) => (
            <HierarchyTree node={child} depth={depth + 1} key={child.id} />
          ))}
        </ul>
      )}
    </li>
  )
}

type TabId = 'locations' | 'roles'

interface StateRow {
  id: string
  name: string
  description: string | null
}

interface BranchRow {
  id: string
  stateId: string
  name: string
  description: string | null
  state?: { id: string; name: string }
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('locations')
  const [states, setStates] = useState<StateRow[]>([])
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [selectedStateId, setSelectedStateId] = useState<string>('')

  // Branch locations form (per state)
  const [branchName, setBranchName] = useState('')
  const [branchDescription, setBranchDescription] = useState('')
  const [branchSubmitting, setBranchSubmitting] = useState(false)
  const [branchEditingId, setBranchEditingId] = useState<string | null>(null)
  const [branchEditName, setBranchEditName] = useState('')
  const [branchEditDescription, setBranchEditDescription] = useState('')

  const [hierarchyRoots, setHierarchyRoots] = useState<HierarchyNode[]>([])
  const [hierarchyLoading, setHierarchyLoading] = useState(false)

  const sessionRole = (session?.user?.role as string | undefined)?.trim() ?? null
  const isSuperAdminFromSession = sessionRole === 'Super Admin' || sessionRole === 'SuperAdmin'
  const [fetchedRole, setFetchedRole] = useState<string | null | undefined>(undefined)
  const effectiveSuperAdmin = isSuperAdminFromSession || (fetchedRole !== undefined && (fetchedRole === 'Super Admin' || fetchedRole === 'SuperAdmin'))

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    if (!isSuperAdminFromSession && session.user?.id && fetchedRole === undefined) {
      fetch('/api/profile', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setFetchedRole(data?.role != null ? (data.role as string).trim() : null))
        .catch(() => setFetchedRole(null))
    }
  }, [session, status, isSuperAdminFromSession, fetchedRole])

  useEffect(() => {
    if (status === 'loading' || !session) return
    const roleKnown = isSuperAdminFromSession || fetchedRole !== undefined
    if (roleKnown && !effectiveSuperAdmin) router.push('/')
  }, [session, status, effectiveSuperAdmin, isSuperAdminFromSession, fetchedRole, router])

  useEffect(() => {
    if (!effectiveSuperAdmin) return
    fetchStates().finally(() => setLoading(false))
  }, [effectiveSuperAdmin])

  const fetchStates = async () => {
    try {
      const res = await fetch('/api/admin/settings/states')
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const list = data.states || []
        setStates(list)
        if (list.length > 0 && !selectedStateId) setSelectedStateId(list[0].id)
      } else {
        setError(data.detail ? `${data.error}: ${data.detail}` : (data.error || 'Failed to load states'))
      }
    } catch {
      setError('Failed to load states')
    }
  }

  const fetchBranches = async (stateId?: string) => {
    try {
      const url = stateId
        ? `/api/admin/settings/branches?stateId=${encodeURIComponent(stateId)}`
        : '/api/admin/settings/branches'
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setBranches(data.branches || [])
      } else {
        setError(data.detail ? `${data.error}: ${data.detail}` : (data.error || 'Failed to load branches'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches')
    }
  }

  useEffect(() => {
    if (tab === 'locations' && selectedStateId) fetchBranches(selectedStateId)
  }, [tab, selectedStateId])

  const fetchHierarchy = async () => {
    setHierarchyLoading(true)
    try {
      const res = await fetch('/api/admin/manager-assignments/hierarchy')
      const data = await res.json().catch(() => ({}))
      if (res.ok) setHierarchyRoots(data.hierarchy || [])
    } finally {
      setHierarchyLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'roles') fetchHierarchy()
  }, [tab])

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const name = branchName.trim()
    if (!name) return
    if (!selectedStateId) {
      setError('Select a state first.')
      return
    }
    setBranchSubmitting(true)
    try {
      const res = await fetch('/api/admin/settings/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateId: selectedStateId,
          name,
          description: branchDescription.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create branch')
        return
      }
      setSuccess('Branch added.')
      setBranchName('')
      setBranchDescription('')
      await fetchBranches(selectedStateId)
    } catch {
      setError('Something went wrong.')
    } finally {
      setBranchSubmitting(false)
    }
  }

  const handleUpdateBranch = async (id: string) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/settings/branches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchEditName.trim(),
          description: branchEditDescription.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update')
        return
      }
      await fetchBranches(selectedStateId)
      setBranchEditingId(null)
      setSuccess('Branch updated.')
    } catch {
      setError('Something went wrong.')
    }
  }

  const handleDeleteBranch = async (id: string) => {
    if (!confirm('Delete this branch?')) return
    setError('')
    try {
      const res = await fetch(`/api/admin/settings/branches/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Failed to delete (may be in use).')
        return
      }
      await fetchBranches(selectedStateId)
      setSuccess('Branch deleted.')
    } catch {
      setError('Something went wrong.')
    }
  }

  const roleDetermined = isSuperAdminFromSession || fetchedRole !== undefined
  if (status === 'loading' || !session || (roleDetermined && !effectiveSuperAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }
  if (!effectiveSuperAdmin) {
    return null
  }

  const tabs: { id: TabId; label: string; icon: typeof MapPin; description: string }[] = [
    { id: 'locations', label: 'Branch locations', icon: MapPin, description: 'Select a state and add branch locations. Use these to assign people and managers.' },
    { id: 'roles', label: 'Roles', icon: Shield, description: 'Custom roles and permissions (coming later).' },
  ]
  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col md:flex-row max-w-6xl mx-auto">
        {/* Sidebar */}
        <aside className="w-full md:w-56 md:min-h-[calc(100vh-4rem)] shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 md:sticky md:top-0 md:self-start">
          <div className="px-4 py-5 md:py-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h1>
            </div>
            <p className="text-xs text-muted-foreground mb-4 hidden md:block">Super Admin only</p>
            <nav className="space-y-0.5" aria-label="Settings sections">
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Organization</p>
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setTab(id); setError(''); setSuccess(''); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                    tab === id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <header className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{activeTab.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{activeTab.description}</p>
          </header>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 px-4 py-3 text-sm border border-green-500/20">
              {success}
            </div>
          )}

          {tab === 'locations' && (
            <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Branch locations</CardTitle>
                <p className="text-sm text-muted-foreground">
                  These are the branches inside each state. Use them to assign people and managers. Some states may have more than one branch.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="branch-state">State (51 US states)</Label>
                  <select
                    id="branch-state"
                    value={selectedStateId}
                    onChange={(e) => { setSelectedStateId(e.target.value); setError(''); setSuccess(''); }}
                    className="w-56 h-9 px-3 rounded-md border bg-background text-sm"
                  >
                    <option value="">Select a state</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <form onSubmit={handleAddBranch} className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch-name">Branch name</Label>
                    <Input
                      id="branch-name"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="e.g. Birmingham Main"
                      className="w-48"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch-desc">Description (optional)</Label>
                    <Input
                      id="branch-desc"
                      value={branchDescription}
                      onChange={(e) => setBranchDescription(e.target.value)}
                      placeholder="Short description"
                      className="w-48"
                    />
                  </div>
                  <Button type="submit" disabled={branchSubmitting}>
                    {branchSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Add branch
                  </Button>
                </form>
                <div>
                  <h3 className="font-medium text-sm mb-2">
                    {selectedStateId
                      ? `Branches in ${states.find((s) => s.id === selectedStateId)?.name ?? 'this state'}`
                      : 'Branches'}
                  </h3>
                  {!selectedStateId ? (
                    <p className="text-sm text-muted-foreground">Select a state above to view and add branch locations.</p>
                  ) : branches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None yet. Add one above.</p>
                  ) : (
                    <ul className="space-y-2">
                      {branches.map((br) => (
                        <li
                          key={br.id}
                          className="flex items-center justify-between gap-2 p-2 rounded border bg-card"
                        >
                          {branchEditingId === br.id ? (
                            <>
                              <Input
                                value={branchEditName}
                                onChange={(e) => setBranchEditName(e.target.value)}
                                className="max-w-[12rem]"
                              />
                              <Input
                                value={branchEditDescription}
                                onChange={(e) => setBranchEditDescription(e.target.value)}
                                placeholder="Description"
                                className="max-w-[12rem]"
                              />
                              <Button size="sm" onClick={() => handleUpdateBranch(br.id)}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setBranchEditingId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <span className="font-medium">{br.name}</span>
                              {br.description && <span className="text-muted-foreground text-sm">— {br.description}</span>}
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setBranchEditingId(br.id)
                                    setBranchEditName(br.name)
                                    setBranchEditDescription(br.description || '')
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteBranch(br.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'roles' && (
            <>
            <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Roles</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Built-in roles control access and who can approve. Assign who reports to who to build your org chart.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Built-in roles</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong className="text-gray-700 dark:text-gray-300">Super Admin</strong> — Full access; can manage settings, users, and manager assignments.</li>
                    <li><strong className="text-gray-700 dark:text-gray-300">Owner</strong> — Same as Manager plus org-wide visibility; can approve Managers.</li>
                    <li><strong className="text-gray-700 dark:text-gray-300">Manager</strong> — Can have direct reports; sees their team’s activity (e.g. daily notepad); requires approval.</li>
                    <li><strong className="text-gray-700 dark:text-gray-300">Employee</strong> — Standard user; can be assigned to one or more managers.</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  Visibility and approvals are driven by these roles and by the reporting structure below. Use tags (branch, location, etc.) to filter and assign people to locations.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 dark:border-gray-800 shadow-sm mt-6">
              <CardHeader className="pb-4 flex flex-row items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base">Reporting structure</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Who reports to who. This is the spiderweb hierarchy used for approvals and visibility.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/users?tab=managers">
                    <Users className="w-4 h-4 mr-2" />
                    Manage who reports to who
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {hierarchyLoading ? (
                  <div className="flex items-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading hierarchy…</span>
                  </div>
                ) : hierarchyRoots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No reporting structure yet. Go to <Link href="/admin/users?tab=managers" className="text-primary underline">Manage who reports to who</Link> to promote users to Manager and assign employees to managers.
                  </p>
                ) : (
                  <ul className="space-y-0 text-sm">
                    {hierarchyRoots.map((node) => (
                      <HierarchyTree node={node} depth={0} key={node.id} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import { Loader2, User, Users, Tag, Save, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string | null
  departmentId: string | null
  tags: Array<{ key: string; value: string }>
}

interface Department {
  id: string
  name: string
  description: string | null
}

interface Manager {
  id: string
  name: string | null
  email: string
}

const ROLES = ['Super Admin', 'Owner', 'Manager', 'Employee']

export default function AssignUserSection() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [assignments, setAssignments] = useState<Array<{ managerId: string; employeeId: string }>>([])
  const [tagOptions, setTagOptions] = useState<Record<string, string[]>>({})

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [role, setRole] = useState<string>('')
  const [departmentId, setDepartmentId] = useState<string>('')
  const [reportsToManagerIds, setReportsToManagerIds] = useState<Set<string>>(new Set())
  const [tagBranchLocation, setTagBranchLocation] = useState<string>('')
  const [tagPosition, setTagPosition] = useState<string>('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [managerSaving, setManagerSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedId), [users, selectedId])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.name?.toLowerCase().includes(q)) ||
        (u.email?.toLowerCase().includes(q))
    )
  }, [users, searchQuery])

  useEffect(() => {
    loadInitial()
  }, [])

  const loadInitial = async () => {
    setLoading(true)
    setError('')
    try {
      const [usersRes, deptRes, assignRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/departments'),
        fetch('/api/admin/manager-assignments'),
      ])
      if (!usersRes.ok) throw new Error('Failed to load users')
      const usersData = await usersRes.json()
      setUsers(usersData.users || [])

      if (deptRes.ok) {
        const d = await deptRes.json()
        setDepartments(d.departments || [])
      }
      if (assignRes.ok) {
        const a = await assignRes.json()
        setManagers(a.managers || [])
        setAssignments(a.assignments || [])
      }

      const [branchRes, positionRes] = await Promise.all([
        fetch('/api/admin/users/tag-options?key=branch'),
        fetch('/api/admin/users/tag-options?key=position'),
      ])
      const branchData = branchRes.ok ? await branchRes.json() : {}
      const positionData = positionRes.ok ? await positionRes.json() : {}
      setTagOptions({
        branch: branchData.values || [],
        position: positionData.values || [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedId || !selectedUser) {
      setRole('')
      setDepartmentId('')
      setReportsToManagerIds(new Set())
      setTagBranchLocation('')
      setTagPosition('')
      return
    }
    setRole(selectedUser.role || '')
    setDepartmentId(selectedUser.departmentId || '')
    const managerIds = new Set(assignments.filter((a) => a.employeeId === selectedId).map((a) => a.managerId))
    setReportsToManagerIds(managerIds)
    const branchOrLocation = selectedUser.tags.find((t) => t.key === 'branch')?.value
      ?? selectedUser.tags.find((t) => t.key === 'location')?.value ?? ''
    setTagBranchLocation(branchOrLocation)
    setTagPosition(selectedUser.tags.find((t) => t.key === 'position')?.value ?? '')
  }, [selectedId, selectedUser, assignments])

  const toggleManager = async (managerId: string) => {
    if (!selectedId) return
    const assigned = reportsToManagerIds.has(managerId)
    setManagerSaving(managerId)
    setError('')
    try {
      const res = await fetch('/api/admin/manager-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId, employeeId: selectedId, assigned: !assigned }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
      setReportsToManagerIds((prev) => {
        const next = new Set(prev)
        if (assigned) next.delete(managerId)
        else next.add(managerId)
        return next
      })
      setAssignments((prev) => {
        if (assigned) return prev.filter((a) => !(a.managerId === managerId && a.employeeId === selectedId))
        return [...prev, { managerId, employeeId: selectedId }]
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update manager')
    } finally {
      setManagerSaving(null)
    }
  }

  const saveAll = async () => {
    if (!selectedId) return
    setSaving(true)
    setError('')
    try {
      const branchLocationValue = tagBranchLocation.trim()
      const tags = [
        ...selectedUser!.tags.filter((t) => !['branch', 'location', 'position'].includes(t.key)),
        ...(branchLocationValue ? [
          { key: 'branch', value: branchLocationValue },
          { key: 'location', value: branchLocationValue },
        ] : []),
        ...(tagPosition.trim() ? [{ key: 'position', value: tagPosition.trim() }] : []),
      ]

      const [userRes, tagsRes] = await Promise.all([
        fetch(`/api/admin/users/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: role || null, departmentId: departmentId || null }),
        }),
        fetch(`/api/admin/users/${selectedId}/tags`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags }),
        }),
      ])

      if (!userRes.ok) {
        const d = await userRes.json()
        throw new Error(d.error || 'Failed to update user')
      }
      if (!tagsRes.ok) {
        const d = await tagsRes.json()
        throw new Error(d.error || 'Failed to update tags')
      }

      const userData = await userRes.json()
      const tagsData = await tagsRes.json()
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedId
            ? {
                ...u,
                role: userData.user?.role ?? u.role,
                departmentId: userData.user?.departmentId ?? u.departmentId,
                tags: tagsData.tags ?? u.tags,
              }
            : u
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Pick a user and set their role, department, who they report to, and tags (branch location, position)—all in one place.
      </p>
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm placeholder:text-muted-foreground"
            aria-label="Search users"
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2 min-w-[220px]">
            <Label htmlFor="assign-user-select">User</Label>
            <select
              id="assign-user-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">Select a user</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} ({u.email})
                </option>
              ))}
            </select>
            {searchQuery.trim() && (
              <p className="text-xs text-muted-foreground">
                {filteredUsers.length} of {users.length} users
              </p>
            )}
          </div>
        </div>
      </div>

      {!selectedId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Select a user above to edit their role, department, hierarchy, and tags.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {selectedUser?.name || selectedUser?.email}
            </CardTitle>
            <CardDescription>
              Role, department, reports to, and tags in one form. Change anything and click Save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="">—</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Reports to (managers)
              </Label>
              <p className="text-xs text-muted-foreground">Toggle to assign or remove this person’s manager. Saves immediately.</p>
              <div className="flex flex-wrap gap-2">
                {managers.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No managers yet. Promote someone in Manager Assignments.</span>
                ) : (
                  managers.map((m) => {
                    const assigned = reportsToManagerIds.has(m.id)
                    const isSelf = m.id === selectedId
                    return (
                      <Button
                        key={m.id}
                        type="button"
                        variant={assigned ? 'default' : 'outline'}
                        size="sm"
                        disabled={isSelf || managerSaving === m.id}
                        onClick={() => toggleManager(m.id)}
                        title={isSelf ? 'Cannot report to themselves' : undefined}
                      >
                        {managerSaving === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {m.name || m.email} {assigned ? '✓' : ''}
                      </Button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Branch location &amp; position
              </Label>
              <p className="text-xs text-muted-foreground">
                Branch location is State + name (e.g. Texas – Dallas). Same value is saved as both branch and location. Position is separate.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Branch location (State – name)</span>
                  <select
                    value={tagBranchLocation}
                    onChange={(e) => setTagBranchLocation(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                  >
                    <option value="">—</option>
                    {(tagOptions.branch || []).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Position</span>
                  {(tagOptions.position?.length ?? 0) > 0 ? (
                    <select
                      value={tagPosition}
                      onChange={(e) => setTagPosition(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                    >
                      <option value="">—</option>
                      {(tagOptions.position || []).map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={tagPosition}
                      onChange={(e) => setTagPosition(e.target.value)}
                      placeholder="e.g. Estimator"
                      className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={saveAll} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save role, department &amp; tags
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, X, UserCheck } from 'lucide-react'

type TagRecord = { key: string; value: string }

interface UserWithTags {
  id: string
  email: string
  name: string | null
  role: string | null
  departmentId: string | null
  tags: TagRecord[]
}

interface Assignment {
  managerId: string
  employeeId: string
}

interface Manager {
  id: string
  name: string | null
  email: string
}

export default function TagsSection() {
  const [users, setUsers] = useState<UserWithTags[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTags, setEditTags] = useState<TagRecord[]>([])
  const [saving, setSaving] = useState(false)

  const employeeToManagerName = useMemo(() => {
    const map = new Map<string, string>()
    const managerById = new Map(managers.map((m) => [m.id, m.name || m.email]))
    for (const a of assignments) {
      const name = managerById.get(a.managerId) ?? 'Unknown'
      map.set(a.employeeId, name)
    }
    return map
  }, [assignments, managers])

  const sortedUsers = useMemo(() => {
    const employees = users.filter((u) => u.role === 'Employee')
    const others = users.filter((u) => u.role !== 'Employee')
    return [...employees, ...others]
  }, [users])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const [usersRes, assignmentsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/manager-assignments'),
      ])
      if (!usersRes.ok) throw new Error('Failed to load users')
      const usersData = await usersRes.json()
      setUsers(usersData.users || [])
      if (assignmentsRes.ok) {
        const assignData = await assignmentsRes.json()
        setAssignments(assignData.assignments || [])
        setManagers(assignData.managers || [])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (u: UserWithTags) => {
    setEditingId(u.id)
    setEditTags([...u.tags])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTags([])
  }

  const addTag = () => {
    setEditTags((prev) => [...prev, { key: '', value: '' }])
  }

  const updateTag = (index: number, field: 'key' | 'value', val: string) => {
    setEditTags((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }

  const removeTag = (index: number) => {
    setEditTags((prev) => prev.filter((_, i) => i !== index))
  }

  const saveTags = async () => {
    if (!editingId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${editingId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: editTags.filter((t) => t.key.trim() !== '').map((t) => ({ key: t.key.trim(), value: t.value.trim() })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      const data = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === editingId ? { ...u, tags: data.tags } : u)))
      cancelEdit()
    } catch (e: any) {
      setError(e?.message || 'Failed to save tags')
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
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Assign tags (branch, location, position, etc.) to control what each user can see across tools.
        Employees are listed first with their manager. Click Edit tags to add key-value pairs (e.g. branch=North, location=NYC).
      </p>
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="w-4 h-4" />
            Employees & users with tags
          </CardTitle>
          <CardDescription>
            All employees are listed with their manager. Other roles follow. Click Edit tags to set branch, location, position, or any key-value.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedUsers.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-card"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate text-sm">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email} · {u.role ?? '—'}
                    {u.role === 'Employee' && (
                      <span className="ml-1">
                        · Manager: {employeeToManagerName.get(u.id) ?? '—'}
                      </span>
                    )}
                  </p>
                  {u.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {u.tags.map((t) => (
                        <span
                          key={`${t.key}-${t.value}`}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary"
                        >
                          {t.key}={t.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {editingId === u.id ? (
                  <div className="w-full mt-2 space-y-2 border-t pt-3">
                    {editTags.map((t, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={t.key}
                          onChange={(e) => updateTag(i, 'key', e.target.value)}
                          placeholder="e.g. branch"
                          className="flex-1 min-w-0 max-w-[8rem] px-2 py-1.5 text-sm border rounded dark:bg-gray-900 dark:border-gray-700"
                        />
                        <input
                          type="text"
                          value={t.value}
                          onChange={(e) => updateTag(i, 'value', e.target.value)}
                          placeholder="e.g. North"
                          className="flex-1 min-w-0 max-w-[10rem] px-2 py-1.5 text-sm border rounded dark:bg-gray-900 dark:border-gray-700"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTag(i)} aria-label="Remove tag">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addTag}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add tag
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={saveTags} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save tags'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(u)}>
                    Edit tags
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UsersRound, Loader2, Plus, Pencil, Check, X } from 'lucide-react'

interface Team {
  id: string
  name: string
  description: string | null
  _count?: { members: number }
}

interface User {
  id: string
  name: string | null
  email: string
}

export default function TeamsSection() {
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editMemberIds, setEditMemberIds] = useState<string[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/admin/teams')
      if (!res.ok) throw new Error('Failed to load teams')
      const data = await res.json()
      setTeams(data.teams || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load teams')
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/teams/available-users')
      if (!res.ok) return
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchTeams(), fetchUsers()]).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Team name is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: description.trim() || undefined, memberIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create team')
        return
      }
      setSuccess(`Team "${data.team?.name ?? trimmed}" created.`)
      setName('')
      setDescription('')
      setMemberIds([])
      setTeams((prev) => [...prev, data.team].filter(Boolean))
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = async (team: Team) => {
    setEditingId(team.id)
    setEditName(team.name)
    setEditDescription(team.description || '')
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`)
      if (!res.ok) return
      const data = await res.json()
      setEditMemberIds((data.team?.members || []).map((m: { userId: string }) => m.userId))
    } catch {
      setEditMemberIds([])
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
    setEditMemberIds([])
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/teams/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          memberIds: editMemberIds,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update team')
        return
      }
      await fetchTeams()
      cancelEdit()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleMember = (userId: string, inEdit: boolean) => {
    if (inEdit) {
      setEditMemberIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      )
    } else {
      setMemberIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      )
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
        Create teams and assign members. Use the Daily Notepad (and other tools) to filter by team.
      </p>
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-2 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-4 max-w-md">
        <div>
          <Label htmlFor="team-name">Team name *</Label>
          <Input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. North Region"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="team-desc">Description (optional)</Label>
          <Input
            id="team-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="mb-2 block">Members (optional)</Label>
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={memberIds.includes(u.id)}
                  onChange={() => toggleMember(u.id, false)}
                  className="rounded"
                />
                <span className="text-sm truncate">{u.name || u.email}</span>
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          Create team
        </Button>
      </form>

      <div>
        <h3 className="font-medium text-sm text-muted-foreground mb-2">Existing teams</h3>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet. Create one above.</p>
        ) : (
          <ul className="space-y-3">
            {teams.map((team) => (
              <li
                key={team.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-card"
              >
                {editingId === team.id ? (
                  <div className="w-full space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Team name"
                      className="max-w-xs"
                    />
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      className="max-w-xs"
                    />
                    <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                      {users.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editMemberIds.includes(u.id)}
                            onChange={() => toggleMember(u.id, true)}
                            className="rounded"
                          />
                          <span className="text-sm truncate">{u.name || u.email}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                        {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={savingEdit}>
                        <X className="w-4 h-4" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <UsersRound className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{team.name}</span>
                      {team.description && (
                        <span className="text-muted-foreground text-sm">— {team.description}</span>
                      )}
                      <span className="text-muted-foreground text-xs">
                        ({team._count?.members ?? 0} members)
                      </span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(team)}>
                      <Pencil className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

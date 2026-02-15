'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Loader2, Plus } from 'lucide-react'

interface Department {
  id: string
  name: string
  description: string | null
}

export default function DepartmentsSection() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/departments')
      if (!res.ok) throw new Error('Failed to load departments')
      const data = await res.json()
      setDepartments(data.departments || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: description.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create department')
        return
      }
      setSuccess(`Created "${data.department?.name ?? trimmed}". You can now assign users to it on the Create user tab (refresh that page if the dropdown doesn’t show it yet).`)
      setName('')
      setDescription('')
      setDepartments((prev) => [...prev, data.department].filter(Boolean))
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
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
        Create departments here. Then assign users to a department when you create or edit them (Create user tab).
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

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="dept-name">Department name *</Label>
          <Input
            id="dept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Estimating"
            className="w-48"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dept-desc">Description (optional)</Label>
          <Input
            id="dept-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="w-56"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          Create department
        </Button>
      </form>

      <div>
        <h3 className="font-medium text-sm text-muted-foreground mb-2">Existing departments</h3>
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments yet. Create one above.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <li
                key={d.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-sm"
              >
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{d.name}</span>
                {d.description && (
                  <span className="text-muted-foreground">— {d.description}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

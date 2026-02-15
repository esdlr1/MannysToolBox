'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react'

const ROLES = ['Employee', 'Manager', 'Owner', 'Super Admin'] as const

interface Department {
  id: string
  name: string
}

export default function CreateUserSection() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<string>('')
  const [departmentId, setDepartmentId] = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingDepts, setLoadingDepts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/daily-notepad/departments')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.departments) setDepartments(data.departments)
      })
      .finally(() => setLoadingDepts(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          password,
          role: role || undefined,
          departmentId: departmentId && departmentId !== '__none__' ? departmentId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create user')
        return
      }
      setSuccess(`User created: ${data.email}`)
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setRole('')
      setDepartmentId('')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Create a new user account. They can sign in with the email and password you set.
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
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <Label htmlFor="create-name">Name (optional)</Label>
          <Input
            id="create-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="create-email">Email *</Label>
          <Input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1"
            required
          />
        </div>
        <div className="relative">
          <Label htmlFor="create-password">Password *</Label>
          <Input
            id="create-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            className="mt-1 pr-10"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-2 top-9 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div>
          <Label htmlFor="create-confirm">Confirm password *</Label>
          <Input
            id="create-confirm"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="create-role">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="create-role" className="mt-1">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="create-department">Department (optional)</Label>
          <Select value={departmentId || '__none__'} onValueChange={(v) => setDepartmentId(v === '__none__' ? '' : v)} disabled={loadingDepts}>
            <SelectTrigger id="create-department" className="mt-1">
              <SelectValue placeholder={loadingDepts ? 'Loading...' : 'None'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Create user
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

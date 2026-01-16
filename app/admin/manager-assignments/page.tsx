'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Manager {
  id: string
  name: string | null
  email: string
}

interface Employee {
  id: string
  name: string | null
  email: string
}

interface Assignment {
  managerId: string
  employeeId: string
}

export default function ManagerAssignmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [managers, setManagers] = useState<Manager[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeManagerId, setActiveManagerId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!['Owner', 'Super Admin'].includes(session.user?.role || '')) {
      router.push('/')
      return
    }

    fetchAssignments()
  }, [session, status, router])

  const fetchAssignments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/manager-assignments')
      if (!response.ok) {
        throw new Error('Failed to load assignments')
      }
      const data = await response.json()
      setManagers(data.managers || [])
      setEmployees(data.employees || [])
      setAssignments(data.assignments || [])
      if (!activeManagerId && data.managers?.length) {
        setActiveManagerId(data.managers[0].id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const assignedEmployeeIds = useMemo(() => {
    if (!activeManagerId) return new Set<string>()
    return new Set(
      assignments
        .filter((a) => a.managerId === activeManagerId)
        .map((a) => a.employeeId)
    )
  }, [assignments, activeManagerId])

  const updateAssignment = async (employeeId: string, assigned: boolean) => {
    if (!activeManagerId) return
    try {
      setSaving(employeeId)
      setError('')
      const response = await fetch('/api/admin/manager-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: activeManagerId,
          employeeId,
          assigned,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update assignment')
      }

      setAssignments((prev) => {
        const filtered = prev.filter(
          (a) => !(a.managerId === activeManagerId && a.employeeId === employeeId)
        )
        return assigned
          ? [...filtered, { managerId: activeManagerId, employeeId }]
          : filtered
      })
    } catch (err: any) {
      setError(err.message || 'Failed to update assignment')
    } finally {
      setSaving(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Manager Assignments</h1>
        </div>
        <p className="text-muted-foreground">
          Assign employees to managers. Owners and Super Admins can see all employees.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Managers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {managers.length === 0 && (
              <p className="text-sm text-muted-foreground">No managers found.</p>
            )}
            {managers.map((manager) => (
              <button
                key={manager.id}
                onClick={() => setActiveManagerId(manager.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  activeManagerId === manager.id
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{manager.name || manager.email}</div>
                <div className="text-xs text-gray-500">{manager.email}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Employees {activeManagerId ? '(Assigned)' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {employees.length === 0 && (
                <p className="text-sm text-muted-foreground">No employees found.</p>
              )}
              {employees.map((employee) => {
                const assigned = assignedEmployeeIds.has(employee.id)
                return (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">
                        {employee.name || employee.email}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {employee.email}
                      </div>
                    </div>
                    <Button
                      onClick={() => updateAssignment(employee.id, !assigned)}
                      disabled={!activeManagerId || saving === employee.id}
                      className={assigned ? 'bg-red-600 hover:bg-red-700' : ''}
                      variant={assigned ? 'default' : 'outline'}
                    >
                      {saving === employee.id
                        ? 'Saving...'
                        : assigned
                        ? 'Unassign'
                        : 'Assign'}
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

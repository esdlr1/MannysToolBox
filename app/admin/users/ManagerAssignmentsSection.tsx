'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, UserPlus, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Manager {
  id: string
  name: string | null
  email: string
  role: string
  isApproved: boolean
}

interface Employee {
  id: string
  name: string | null
  email: string
}

interface PotentialManager {
  id: string
  name: string | null
  email: string
  role: string
  isApproved: boolean
}

interface Assignment {
  managerId: string
  employeeId: string
}

export default function ManagerAssignmentsSection() {
  const [loading, setLoading] = useState(true)
  const [managers, setManagers] = useState<Manager[]>([])
  const [potentialManagers, setPotentialManagers] = useState<PotentialManager[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeManagerId, setActiveManagerId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [showPotentialManagers, setShowPotentialManagers] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAssignments()
  }, [])

  const fetchAssignments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/manager-assignments')
      if (!response.ok) throw new Error('Failed to load assignments')
      const data = await response.json()
      setManagers(data.managers || [])
      setPotentialManagers(data.potentialManagers || [])
      setEmployees(data.employees || [])
      setAssignments(data.assignments || [])
      if (!activeManagerId && data.managers?.length) {
        setActiveManagerId(data.managers[0].id)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load assignments')
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
        body: JSON.stringify({ managerId: activeManagerId, employeeId, assigned }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update assignment')
      }
      setAssignments((prev) => {
        const filtered = prev.filter(
          (a) => !(a.managerId === activeManagerId && a.employeeId === employeeId)
        )
        return assigned ? [...filtered, { managerId: activeManagerId, employeeId }] : filtered
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to update assignment')
    } finally {
      setSaving(null)
    }
  }

  const promoteToManager = async (userId: string) => {
    try {
      setPromoting(userId)
      setError('')
      const response = await fetch('/api/admin/manager-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'promote' }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to promote user to manager')
      }
      await fetchAssignments()
    } catch (err: any) {
      setError(err?.message || 'Failed to promote user to manager')
    } finally {
      setPromoting(null)
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
        Promote users to Manager and assign employees to managers.
      </p>
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Managers</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPotentialManagers(!showPotentialManagers)}
              >
                {showPotentialManagers ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!showPotentialManagers ? (
                <>
                  {managers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No managers found.</p>
                  )}
                  {managers.map((manager) => (
                    <button
                      key={manager.id}
                      onClick={() => setActiveManagerId(manager.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        activeManagerId === manager.id
                          ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="font-medium text-sm">{manager.name || manager.email}</div>
                      <div className="text-xs text-gray-500 truncate">{manager.email}</div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium mb-2">Promote to Manager</p>
                  {potentialManagers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No users available to promote.</p>
                  )}
                  {potentialManagers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {user.name || user.email}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {user.email} · {user.role || 'No role'}
                        </div>
                      </div>
                      <Button
                        onClick={() => promoteToManager(user.id)}
                        disabled={promoting === user.id}
                        size="sm"
                        className="ml-2"
                      >
                        {promoting === user.id ? 'Promoting...' : 'Promote'}
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
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
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {employee.name || employee.email}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{employee.email}</div>
                    </div>
                    <Button
                      onClick={() => updateAssignment(employee.id, !assigned)}
                      disabled={!activeManagerId || saving === employee.id}
                      className={assigned ? 'bg-red-600 hover:bg-red-700' : ''}
                      variant={assigned ? 'default' : 'outline'}
                      size="sm"
                    >
                      {saving === employee.id ? 'Saving...' : assigned ? 'Unassign' : 'Assign'}
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

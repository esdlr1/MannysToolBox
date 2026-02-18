'use client'

import { useState, useEffect } from 'react'
import { Filter } from 'lucide-react'

export interface ScopeFiltersValues {
  departmentId: string
  location: string
  branch: string
  business: string
  managerId: string
}

const defaultValues: ScopeFiltersValues = {
  departmentId: 'all',
  location: 'all',
  branch: 'all',
  business: 'all',
  managerId: 'all',
}

export interface ScopeFiltersProps {
  effectiveRole: string
  values: ScopeFiltersValues
  onChange: (values: ScopeFiltersValues) => void
  /** Include Manager dropdown (only shown for Owner / Super Admin) */
  showManager?: boolean
  /** Optional class for the wrapper */
  className?: string
}

export function ScopeFilters({
  effectiveRole,
  values,
  onChange,
  showManager = true,
  className = '',
}: ScopeFiltersProps) {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [locationOptions, setLocationOptions] = useState<string[]>([])
  const [branchOptions, setBranchOptions] = useState<string[]>([])
  const [businessOptions, setBusinessOptions] = useState<string[]>([])
  const [managers, setManagers] = useState<Array<{
    id: string
    name: string | null
    email: string
    assignedEmployeesCount: number
  }>>([])

  const canFilter = ['Manager', 'Owner', 'Super Admin'].includes(effectiveRole)
  const showManagerDropdown = showManager && (effectiveRole === 'Owner' || effectiveRole === 'Super Admin')

  useEffect(() => {
    if (!canFilter) return
    const load = async () => {
      try {
        const [deptRes, locRes, branchRes, bizRes, mgrRes] = await Promise.all([
          fetch('/api/daily-notepad/departments'),
          fetch('/api/admin/users/tag-options?key=location'),
          fetch('/api/admin/users/tag-options?key=branch'),
          fetch('/api/admin/users/tag-options?key=business'),
          showManagerDropdown ? fetch('/api/daily-notepad/managers') : Promise.resolve(null),
        ])
        if (deptRes.ok) {
          const d = await deptRes.json()
          setDepartments(d.departments || [])
        }
        if (locRes.ok) {
          const l = await locRes.json()
          setLocationOptions(l.values || [])
        }
        if (branchRes.ok) {
          const b = await branchRes.json()
          setBranchOptions(b.values || [])
        }
        if (bizRes.ok) {
          const b = await bizRes.json()
          setBusinessOptions(b.values || [])
        }
        if (showManagerDropdown && mgrRes?.ok) {
          const m = await mgrRes.json()
          setManagers(m.managers || [])
        }
      } catch (e) {
        console.error('Error loading scope filter options:', e)
      }
    }
    load()
  }, [canFilter, showManagerDropdown])

  if (!canFilter) return null

  const update = (key: keyof ScopeFiltersValues, value: string) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Filter by</span>
        </div>
        <select
          value={values.departmentId}
          onChange={(e) => update('departmentId', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
        <select
          value={values.location}
          onChange={(e) => update('location', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="all">All Locations</option>
          {locationOptions.map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
        <select
          value={values.branch}
          onChange={(e) => update('branch', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="all">All Branches</option>
          {branchOptions.map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
        <select
          value={values.business}
          onChange={(e) => update('business', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="all">All Business</option>
          {businessOptions.map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
        {showManagerDropdown && (
          <select
            value={values.managerId}
            onChange={(e) => update('managerId', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value="all">All Managers</option>
            {managers.map((mgr) => (
              <option key={mgr.id} value={mgr.id}>
                {mgr.name || mgr.email} ({mgr.assignedEmployeesCount ?? 0})
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

export function buildScopeQueryParams(values: ScopeFiltersValues): string {
  const params = new URLSearchParams()
  if (values.departmentId !== 'all') params.set('departmentId', values.departmentId)
  if (values.managerId !== 'all') params.set('managerId', values.managerId)
  const tags: string[] = []
  if (values.location !== 'all') tags.push(`location:${values.location}`)
  if (values.branch !== 'all') tags.push(`branch:${values.branch}`)
  if (values.business !== 'all') tags.push(`business:${values.business}`)
  if (tags.length) params.set('tags', tags.join(','))
  return params.toString()
}

export { defaultValues as defaultScopeFiltersValues }

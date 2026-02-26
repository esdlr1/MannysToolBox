'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, DollarSign, Calendar, Loader2, FileText, Hash, Building2, Edit2, Trash2 } from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks } from 'date-fns'

interface EstimateDiaryEntry {
  id: string
  clientName: string
  jobNumber: string
  totalAmount: number
  weekStartDate: string
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
}

export default function EstimateDiaryTool() {
  const { data: session } = useSession()
  const [entries, setEntries] = useState<EstimateDiaryEntry[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [jobNumber, setJobNumber] = useState('')
  const [totalAmountInput, setTotalAmountInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [selectedWeek, setSelectedWeek] = useState<Date | null>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const loadEntries = useCallback(async () => {
    if (!session?.user?.id) return

    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedWeek) {
        params.append('weekStart', format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      }
      const res = await fetch(`/api/tools/estimate-diary?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load entries')
      const data = await res.json()
      setEntries(data.entries || [])
      setTotalAmount(data.totalAmount ?? 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, selectedWeek])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const resetForm = () => {
    setClientName('')
    setJobNumber('')
    setTotalAmountInput('')
    setEditingId(null)
  }

  const handleEdit = (entry: EstimateDiaryEntry) => {
    setClientName(entry.clientName)
    setJobNumber(entry.jobNumber || '')
    setTotalAmountInput(entry.totalAmount.toString())
    setEditingId(entry.id)
    setError('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    setDeletingId(id)
    setError('')
    try {
      const res = await fetch(`/api/tools/estimate-diary/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      if (editingId === id) resetForm()
      setSuccess('Entry deleted.')
      await loadEntries()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete entry')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return

    const amount = parseFloat(totalAmountInput.replace(/[,$]/g, ''))
    if (!clientName.trim() || isNaN(amount) || amount < 0) {
      setError('Please fill in client name and a valid total amount ($).')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const weekStart = selectedWeek
        ? format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

      if (editingId) {
        const res = await fetch(`/api/tools/estimate-diary/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: clientName.trim(),
            jobNumber: jobNumber.trim() || '',
            totalAmount: amount,
            weekStartDate: weekStart,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to update entry')
        }
        setSuccess('Entry updated successfully.')
      } else {
        const res = await fetch('/api/tools/estimate-diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: clientName.trim(),
            jobNumber: jobNumber.trim() || '',
            totalAmount: amount,
            weekStartDate: weekStart,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to save entry')
        }
        setSuccess('Entry added successfully.')
      }
      resetForm()
      await loadEntries()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save entry')
    } finally {
      setSubmitting(false)
    }
  }

  const availableWeeks = eachWeekOfInterval(
    { start: subWeeks(new Date(), 12), end: new Date() },
    { weekStartsOn: 1 }
  ).reverse()

  if (!session) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Sign in to use Estimate Diary.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Estimate Diary
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track estimates written weekly. Enter client name, job number, and total amount ($).
            </p>
          </div>
        </div>
      </div>

      {/* Totals box - always visible */}
      <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total amount this week</span>
        </div>
        <p className="text-2xl font-bold text-emerald-900 dark:text-white tabular-nums">
          ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {!loading && selectedWeek && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
            {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')} – {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </p>
        )}
      </div>

      {/* Week selector */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <Calendar className="w-5 h-5 text-gray-500" />
        <label htmlFor="estimate-diary-week" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Week
        </label>
        <select
          id="estimate-diary-week"
          value={selectedWeek ? format(selectedWeek, 'yyyy-MM-dd') : ''}
          onChange={(e) => setSelectedWeek(e.target.value ? new Date(e.target.value) : null)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
        >
          {availableWeeks.map((week) => {
            const weekStart = startOfWeek(week, { weekStartsOn: 1 })
            const weekEnd = endOfWeek(week, { weekStartsOn: 1 })
            return (
              <option key={weekStart.toISOString()} value={format(weekStart, 'yyyy-MM-dd')}>
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
              </option>
            )
          })}
        </select>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {editingId ? 'Edit estimate' : 'Add estimate'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="clientName"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. ABC Restoration"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="jobNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="jobNumber"
                type="text"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                placeholder="e.g. 12345"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total amount ($)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="totalAmount"
                type="text"
                inputMode="decimal"
                value={totalAmountInput}
                onChange={(e) => setTotalAmountInput(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update entry' : 'Add entry'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm">
          {success}
        </div>
      )}

      {/* List + weekly total */}
      <div className="p-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Entries for this week
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm py-6">
            No entries yet for this week. Add one above.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600 text-left text-gray-600 dark:text-gray-400">
                    <th className="pb-2 font-medium">Client</th>
                    <th className="pb-2 font-medium">Job #</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2 text-gray-900 dark:text-white">{entry.clientName}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-300">{entry.jobNumber || '—'}</td>
                      <td className="py-2 text-right font-medium text-gray-900 dark:text-white">
                        ${entry.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(entry)}
                            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex justify-end">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Sum of amounts above: ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

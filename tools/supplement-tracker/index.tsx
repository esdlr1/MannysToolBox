'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, Edit2, Download, DollarSign, TrendingUp, Calendar, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks } from 'date-fns'

interface SupplementEntry {
  id: string
  customerName: string
  claimNumber: string
  originalAmount: number
  supplementAmount: number
  finalAmount: number
  weekStartDate: string
  notes: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface SupplementData {
  entries: SupplementEntry[]
  totals: {
    totalOriginal: number
    totalSupplement: number
    totalFinal: number
  }
}

export default function SupplementTrackerTool() {
  const { data: session } = useSession()
  const [entries, setEntries] = useState<SupplementEntry[]>([])
  const [totals, setTotals] = useState({ totalOriginal: 0, totalSupplement: 0, totalFinal: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [claimNumber, setClaimNumber] = useState('')
  const [originalAmount, setOriginalAmount] = useState('')
  const [amountAfterSupplement, setAmountAfterSupplement] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Week filter
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null)

  const loadEntries = useCallback(async () => {
    if (!session?.user?.id) return

    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedWeek) {
        params.append('weekStart', format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      }

      const res = await fetch(`/api/tools/supplement-tracker?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load entries')
      const data: SupplementData = await res.json()
      setEntries(data.entries || [])
      setTotals(data.totals || { totalOriginal: 0, totalSupplement: 0, totalFinal: 0 })
    } catch (e: any) {
      setError(e?.message || 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, selectedWeek])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const resetForm = () => {
    setCustomerName('')
    setClaimNumber('')
    setOriginalAmount('')
    setAmountAfterSupplement('')
    setNotes('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return

    const orig = parseFloat(originalAmount)
    const afterSupp = parseFloat(amountAfterSupplement)

    if (!customerName.trim() || !claimNumber.trim() || isNaN(orig) || isNaN(afterSupp)) {
      setError('Please fill in all required fields with valid numbers')
      return
    }

    if (orig < 0 || afterSupp < 0) {
      setError('Amounts must be non-negative')
      return
    }

    if (afterSupp < orig) {
      setError('Amount after supplement cannot be less than original amount')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const url = editingId ? `/api/tools/supplement-tracker/${editingId}` : '/api/tools/supplement-tracker'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          claimNumber: claimNumber.trim(),
          originalAmount: orig,
          finalAmount: afterSupp,
          notes: notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save entry')
      }

      setSuccess(editingId ? 'Entry updated successfully' : 'Entry added successfully')
      resetForm()
      await loadEntries()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e?.message || 'Failed to save entry')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplement entry?')) return

    try {
      const res = await fetch(`/api/tools/supplement-tracker/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      await loadEntries()
      setSuccess('Entry deleted successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e?.message || 'Failed to delete entry')
    }
  }

  const handleEdit = (entry: SupplementEntry) => {
    setCustomerName(entry.customerName)
    setClaimNumber(entry.claimNumber)
    setOriginalAmount(entry.originalAmount.toString())
    setAmountAfterSupplement(entry.finalAmount.toString())
    setNotes(entry.notes || '')
    setEditingId(entry.id)
    setShowForm(true)
  }

  const handleExportPDF = async () => {
    setError('')
    setExportingPdf(true)
    try {
      const params = new URLSearchParams()
      if (selectedWeek) {
        params.append('weekStart', format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      }

      const res = await fetch(`/api/tools/supplement-tracker/export?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const contentType = res.headers.get('content-type')
        const isJson = contentType?.includes('application/json')
        const body = isJson ? await res.json().catch(() => ({})) : {}
        const message = (body as { error?: string })?.error || res.statusText || 'Failed to generate PDF'
        throw new Error(message)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Supplement_Tracker_${selectedWeek ? format(selectedWeek, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e: any) {
      setError(e?.message || 'Failed to export PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  // Get available weeks (last 12 weeks)
  const availableWeeks = eachWeekOfInterval(
    {
      start: subWeeks(new Date(), 12),
      end: new Date(),
    },
    { weekStartsOn: 1 }
  ).reverse()

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Sign in to use Supplement Tracker</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-500/20">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Supplement Tracker
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                Track estimate supplements and changes weekly. Export reports to show your production.
              </p>
            </div>
          </div>
        </div>

        {/* Week Filter */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6 flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-500" />
          <select
            value={selectedWeek ? format(selectedWeek, 'yyyy-MM-dd') : ''}
            onChange={(e) => setSelectedWeek(e.target.value ? new Date(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Weeks</option>
            {availableWeeks.map((week) => {
              const weekStart = startOfWeek(week, { weekStartsOn: 1 })
              const weekEnd = endOfWeek(week, { weekStartsOn: 1 })
              return (
                <option key={weekStart.toISOString()} value={format(weekStart, 'yyyy-MM-dd')}>
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </option>
              )
            })}
          </select>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
          </div>
        )}

        {/* Totals Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Original</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${totals.totalOriginal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Actual Supplement</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              ${totals.totalSupplement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total After Supplement</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${totals.totalFinal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Add Entry Button */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Supplement Entries</h2>
          <div className="flex gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={exportingPdf}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2"
              >
                {exportingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export PDF
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Edit Entry' : 'Add New Entry'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Claim Number *
                  </label>
                  <input
                    type="text"
                    value={claimNumber}
                    onChange={(e) => setClaimNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Original Amount (Before Supplement) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount After Supplement *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountAfterSupplement}
                    onChange={(e) => setAmountAfterSupplement(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
              {originalAmount && amountAfterSupplement && !isNaN(parseFloat(originalAmount)) && !isNaN(parseFloat(amountAfterSupplement)) && parseFloat(amountAfterSupplement) >= parseFloat(originalAmount) && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Actual Supplement (difference):</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${(parseFloat(amountAfterSupplement) - parseFloat(originalAmount)).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {editingId ? 'Update Entry' : 'Add Entry'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No supplement entries yet. Add your first entry to get started.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Claim #
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Original
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actual Supplement
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      After Supplement
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{entry.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{entry.claimNumber}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                        ${entry.originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 font-medium">
                        ${entry.supplementAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 font-bold">
                        ${entry.finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

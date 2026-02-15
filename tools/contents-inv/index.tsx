'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRoleView } from '@/contexts/RoleViewContext'
import { FileText, List, Loader2, AlertCircle, CheckCircle2, MapPin, Hash, MessageSquare, Settings2, Save } from 'lucide-react'
import { format } from 'date-fns'

interface FormItem {
  id: string
  label: string
  sortOrder: number
  xactimateCode?: string | null
  xactimateCat?: string | null
  xactimateSel?: string | null
  unit?: string | null
  customUnitPrice?: number | string | null
}

interface Submission {
  id: string
  clientName: string
  address: string
  customerJobCode: string
  answers: Record<string, number>
  notes: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
}

export default function ContentsInvTool() {
  const { data: session } = useSession()
  const { effectiveRole } = useRoleView()
  const [formItems, setFormItems] = useState<FormItem[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionsScope, setSubmissionsScope] = useState<'all' | 'own'>('all')
  const [view, setView] = useState<'form' | 'list' | 'codes'>('form')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [clientName, setClientName] = useState('')
  const [address, setAddress] = useState('')
  const [customerJobCode, setCustomerJobCode] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [labelEdits, setLabelEdits] = useState<Record<string, string>>({})
  const [catEdits, setCatEdits] = useState<Record<string, string>>({})
  const [selEdits, setSelEdits] = useState<Record<string, string>>({})
  const [unitEdits, setUnitEdits] = useState<Record<string, string>>({})
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({})
  const [savingCodes, setSavingCodes] = useState(false)
  const [seedingDefaults, setSeedingDefaults] = useState(false)
  const [splittingMattress, setSplittingMattress] = useState(false)

  const loadFormItems = useCallback(async () => {
    if (!session?.user?.id) return
    setError('')
    try {
      const res = await fetch('/api/tools/contents-inv/form-items', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load form items')
      const items = data.items || []
      setFormItems(items)
      setLabelEdits((prev) => {
        const next = { ...prev }
        for (const item of items) {
          next[item.id] = item.label ?? ''
        }
        return next
      })
      setCatEdits((prev) => {
        const next = { ...prev }
        for (const item of items) {
          next[item.id] = item.xactimateCat ?? ''
        }
        return next
      })
      setSelEdits((prev) => {
        const next = { ...prev }
        for (const item of items) {
          next[item.id] = item.xactimateSel ?? ''
        }
        return next
      })
      setUnitEdits((prev) => {
        const next = { ...prev }
        for (const item of items) {
          next[item.id] = item.unit ?? ''
        }
        return next
      })
      setPriceEdits((prev) => {
        const next = { ...prev }
        for (const item of items) {
          const p = item.customUnitPrice
          next[item.id] = p === null || p === undefined ? '' : String(p)
        }
        return next
      })
      setAnswers((prev) => {
        const next = { ...prev }
        for (const item of items) {
          if (next[item.id] === undefined) next[item.id] = ''
        }
        return next
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to load form')
    }
  }, [session?.user?.id])

  const loadSubmissions = useCallback(async () => {
    if (!session?.user?.id) return
    setLoadingSubmissions(true)
    setError('')
    try {
      const res = await fetch('/api/tools/contents-inv/submissions', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load submissions')
      const data = await res.json()
      setSubmissions(data.submissions || [])
      setSubmissionsScope(data.scope === 'own' ? 'own' : 'all')
    } catch (e: any) {
      setSubmissions([])
      setSubmissionsScope('all')
    } finally {
      setLoadingSubmissions(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      await loadFormItems()
      if (cancelled) return
      await loadSubmissions()
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [session?.user?.id, loadFormItems, loadSubmissions])

  // When viewing as non–Super Admin, leave the codes tab so we don't show a blank state
  useEffect(() => {
    if (effectiveRole !== 'Super Admin' && view === 'codes') {
      setView('form')
    }
  }, [effectiveRole, view])

  const handleSeedDefaults = async () => {
    if (!session?.user?.id || session.user.role !== 'Super Admin') return
    setSeedingDefaults(true)
    setError('')
    try {
      const res = await fetch('/api/tools/contents-inv/form-items/seed', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load defaults')
      setFormItems(data.items || [])
      setLabelEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.label ?? ''
        }
        return next
      })
      setCatEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.xactimateCat ?? ''
        }
        return next
      })
      setSelEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.xactimateSel ?? ''
        }
        return next
      })
      setUnitEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.unit ?? ''
        }
        return next
      })
      setPriceEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          const p = item.customUnitPrice
          next[item.id] = p === null || p === undefined ? '' : String(p)
        }
        return next
      })
      setSuccess(data.message || 'Default line items loaded.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setError(e?.message || 'Failed to load default line items')
    } finally {
      setSeedingDefaults(false)
    }
  }

  const handleSplitMattressBlankets = async () => {
    if (!session?.user?.id || session.user.role !== 'Super Admin') return
    setSplittingMattress(true)
    setError('')
    try {
      const res = await fetch('/api/tools/contents-inv/form-items/split-mattress-blankets', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to split')
      setFormItems(data.items || [])
      setLabelEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.label ?? ''
        }
        return next
      })
      setCatEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.xactimateCat ?? ''
        }
        return next
      })
      setSelEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.xactimateSel ?? ''
        }
        return next
      })
      setUnitEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.unit ?? ''
        }
        return next
      })
      setPriceEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          const p = item.customUnitPrice
          next[item.id] = p === null || p === undefined ? '' : String(p)
        }
        return next
      })
      setAnswers((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          if (next[item.id] === undefined) next[item.id] = ''
        }
        return next
      })
      setSuccess(data.message || 'Split into Mattress Bag and Furniture Blankets.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setError(e?.message || 'Failed to split')
    } finally {
      setSplittingMattress(false)
    }
  }

  const handleSaveCodes = async () => {
    if (!session?.user?.id || session.user.role !== 'Super Admin') return
    setSavingCodes(true)
    setError('')
    try {
      const updates = formItems.map((item) => {
        const rawPrice = priceEdits[item.id]?.trim()
        const customUnitPrice =
          !rawPrice ? null : (() => { const n = parseFloat(rawPrice); return Number.isFinite(n) ? n : null })()
        const label = labelEdits[item.id]?.trim()
        return {
          id: item.id,
          label: label || item.label,
          xactimateCat: catEdits[item.id]?.trim() || null,
          xactimateSel: selEdits[item.id]?.trim() || null,
          unit: unitEdits[item.id]?.trim() || null,
          customUnitPrice,
        }
      })
      const res = await fetch('/api/tools/contents-inv/form-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      const data = await res.json()
      setFormItems(data.items || [])
      setLabelEdits((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          next[item.id] = item.label ?? ''
        }
        return next
      })
      setSuccess('Codes and names saved.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e?.message || 'Failed to save codes')
    } finally {
      setSavingCodes(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return
    setError('')
    setSuccess('')
    if (!clientName.trim() || !address.trim() || !customerJobCode.trim()) {
      setError('Please fill in client name, address, and customer job code.')
      return
    }
    const answersNum: Record<string, number> = {}
    for (const item of formItems) {
      const val = answers[item.id]?.trim()
      const num = val === '' ? 0 : Number(val)
      if (val !== '' && Number.isNaN(num)) {
        setError(`"${item.label}" must be a number.`)
        return
      }
      answersNum[item.id] = val === '' ? 0 : num
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tools/contents-inv/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientName: clientName.trim(),
          address: address.trim(),
          customerJobCode: customerJobCode.trim(),
          answers: answersNum,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit')
      }
      setSuccess('Form submitted successfully.')
      setClientName('')
      setAddress('')
      setCustomerJobCode('')
      setNotes('')
      setAnswers((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next)) next[key] = ''
        return next
      })
      loadSubmissions()
    } catch (e: any) {
      setError(e?.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (id: string) => {
    setSelectedId(id)
    setSelectedSubmission(null)
    try {
      const res = await fetch(`/api/tools/contents-inv/submissions/${id}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setSelectedSubmission(data.submission)
    } catch {
      setSelectedId(null)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4">
        <p className="text-gray-600 dark:text-gray-400 text-center text-sm sm:text-base">Sign in to use Contents INV</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" aria-hidden />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-[100dvh]">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-6">
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center gap-3 mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-500/20 flex-shrink-0">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent truncate">
                Contents INV
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 text-xs sm:text-sm line-clamp-2">
                Create invoices. Fill the form and submit. Managers can view all submissions.
              </p>
            </div>
          </div>
        </div>

        <div className={`grid gap-2 sm:flex sm:gap-2 mb-4 sm:mb-6 ${effectiveRole === 'Super Admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            onClick={() => setView('form')}
            className={`min-h-[44px] sm:min-h-0 px-4 py-3 sm:py-2 rounded-xl font-medium flex items-center justify-center gap-2 touch-manipulation ${view === 'form' ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">New form</span>
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`min-h-[44px] sm:min-h-0 px-4 py-3 sm:py-2 rounded-xl font-medium flex items-center justify-center gap-2 touch-manipulation ${view === 'list' ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            <List className="w-4 h-4 flex-shrink-0" />
            <span className="truncate hidden sm:inline">{effectiveRole === 'Employee' ? 'My submissions' : 'View all submissions'}</span>
            <span className="truncate sm:hidden">Submissions</span>
          </button>
          {effectiveRole === 'Super Admin' && (
            <button
              type="button"
              onClick={() => setView('codes')}
              className={`min-h-[44px] sm:min-h-0 px-4 py-3 sm:py-2 rounded-xl font-medium flex items-center justify-center gap-2 touch-manipulation ${view === 'codes' ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              <Settings2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate hidden sm:inline">Line item codes</span>
              <span className="truncate sm:hidden">Codes</span>
            </button>
          )}
        </div>

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

        {view === 'form' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">New invoice</h2>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Name of client
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Client name"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Address"
                    autoComplete="street-address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Customer job code
                  </label>
                  <input
                    type="text"
                    value={customerJobCode}
                    onChange={(e) => setCustomerJobCode(e.target.value)}
                    className="w-full px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Job code"
                  />
                </div>
              </div>

              {formItems.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Items (numbers only)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_6.5rem] gap-x-4 gap-y-3 sm:gap-y-2 sm:items-center">
                    {formItems.flatMap((item) => [
                      <label key={`${item.id}-l`} className="text-sm text-gray-700 dark:text-gray-300">
                        {item.label}
                      </label>,
                      <div key={`${item.id}-i`} className="w-full sm:w-[6.5rem] sm:min-w-[6.5rem]">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={answers[item.id] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === '' || /^-?\d*\.?\d*$/.test(v)) {
                              setAnswers((prev) => ({ ...prev, [item.id]: v }))
                            }
                          }}
                          className="w-full sm:w-[6.5rem] px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-right tabular-nums"
                          placeholder="0"
                        />
                      </div>,
                    ])}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No form items configured yet. A Super Admin can add items; until then you can still submit with client details and empty answers.
                </p>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Any notes you would like to share…"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 sm:py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium rounded-xl flex items-center justify-center gap-2 touch-manipulation"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Complete'
                )}
              </button>
            </form>
          </div>
        )}

        {view === 'list' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {submissionsScope === 'own' ? 'My submissions' : 'All submissions'}
              </h2>
            </div>
            {loadingSubmissions ? (
              <div className="p-8 sm:p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                No submissions yet.
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
                  {submissions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openDetail(s.id)}
                      className="w-full text-left px-4 py-4 min-h-[44px] active:bg-gray-50 dark:active:bg-gray-800/50 touch-manipulation flex flex-col gap-1"
                    >
                      <span className="font-medium text-red-600 dark:text-red-400 truncate">{s.clientName}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{s.customerJobCode}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-500">{format(new Date(s.createdAt), 'MMM d, yyyy')}</span>
                    </button>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Client</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Job code</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Submitted by</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => openDetail(s.id)}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                        >
                          <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{s.clientName}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.customerJobCode}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.user?.name || s.user?.email}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">{format(new Date(s.createdAt), 'MMM d, yyyy HH:mm')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {view === 'codes' && effectiveRole === 'Super Admin' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Set Xactimate line item codes</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Assign Xactimate CAT (category), SEL (selector), unit (e.g. hrs, ea, LF), and optional unit price per line item. Leave unit price blank to use Xactimate pricing on reports.
              </p>
            </div>
            <div className="p-4 sm:p-6">
              {formItems.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No form items to configure.</p>
                  {session?.user?.role === 'Super Admin' && (
                    <button
                      type="button"
                      onClick={handleSeedDefaults}
                      disabled={seedingDefaults}
                      className="min-h-[44px] px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium rounded-xl flex items-center justify-center gap-2"
                    >
                      {seedingDefaults ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        'Load default line items'
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Line item</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-28">CAT</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-28">SEL</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-28">Unit</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-28">Unit price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
                        {formItems.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={labelEdits[item.id] ?? item.label}
                                onChange={(e) => setLabelEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="Line item name"
                                className="w-full min-w-[10rem] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={catEdits[item.id] ?? ''}
                                onChange={(e) => setCatEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="e.g. INHR"
                                className="w-full max-w-[8rem] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={selEdits[item.id] ?? ''}
                                onChange={(e) => setSelEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="e.g. SME, SMBX"
                                className="w-full max-w-[8rem] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={unitEdits[item.id] ?? ''}
                                onChange={(e) => setUnitEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="e.g. hrs, ea, LF"
                                className="w-full max-w-[6rem] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={priceEdits[item.id] ?? ''}
                                onChange={(e) => setPriceEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="blank = Xactimate"
                                className="w-full max-w-[7rem] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveCodes}
                      disabled={savingCodes}
                      className="min-h-[44px] px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium rounded-xl flex items-center justify-center gap-2"
                    >
                      {savingCodes ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save codes
                        </>
                      )}
                    </button>
                    {formItems.some((i) => i.label === 'Mattress Bag Furniture Blankets') && (
                      <button
                        type="button"
                        onClick={handleSplitMattressBlankets}
                        disabled={splittingMattress}
                        className="min-h-[44px] px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-medium rounded-xl flex items-center justify-center gap-2"
                      >
                        {splittingMattress ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Splitting…
                          </>
                        ) : (
                          'Split into Mattress Bag & Furniture Blankets'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedId && (
          <div
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => { setSelectedId(null); setSelectedSubmission(null) }}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Contents INV Report</h3>
                <button
                  type="button"
                  onClick={() => { setSelectedId(null); setSelectedSubmission(null) }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 px-2 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white touch-manipulation rounded-xl"
                  aria-label="Close"
                >
                  <span className="text-lg font-semibold">×</span>
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto">
                {selectedSubmission ? (
                  <div className="space-y-5 pb-8">
                    {/* Report header */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedSubmission.clientName}</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          {selectedSubmission.address}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Hash className="w-4 h-4 flex-shrink-0" />
                          Job code: {selectedSubmission.customerJobCode}
                        </span>
                        <span>
                          {format(new Date(selectedSubmission.createdAt), 'MMM d, yyyy · h:mm a')} · {selectedSubmission.user?.name || selectedSubmission.user?.email}
                        </span>
                      </div>
                    </div>

                    {/* Line items table with Xactimate */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Line items</p>
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Item</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-24">CAT</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-24">SEL</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-20">Unit</th>
                              <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-24">Unit price</th>
                              <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-20">Qty</th>
                              <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-24">Extended</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-800 dark:text-gray-200 divide-y divide-gray-100 dark:divide-gray-700/80">
                            {formItems.length > 0
                              ? formItems.map((item) => {
                                  const cat = item.xactimateCat ?? item.xactimateCode ?? ''
                                  const sel = item.xactimateSel ?? ''
                                  const unitPrice = item.customUnitPrice != null ? Number(item.customUnitPrice) : null
                                  const qty = selectedSubmission.answers[item.id] ?? 0
                                  const extended = unitPrice != null && Number.isFinite(unitPrice) && typeof qty === 'number' ? unitPrice * qty : null
                                  return (
                                    <tr key={item.id}>
                                      <td className="py-2.5 px-4">{item.label}</td>
                                      <td className="py-2.5 px-4">
                                        {cat ? (
                                          <span className="font-mono text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                                            {cat}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 dark:text-gray-500">—</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-4">
                                        {sel ? (
                                          <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{sel}</span>
                                        ) : (
                                          <span className="text-gray-400 dark:text-gray-500">—</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">
                                        {item.unit || '—'}
                                      </td>
                                      <td className="py-2.5 px-4 text-right tabular-nums">
                                        {unitPrice != null && Number.isFinite(unitPrice)
                                          ? `$${Number(unitPrice).toFixed(2)}`
                                          : <span className="text-gray-500 dark:text-gray-400 italic">Xactimate</span>}
                                      </td>
                                      <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                                        {selectedSubmission.answers[item.id] !== undefined
                                          ? selectedSubmission.answers[item.id]
                                          : '—'}
                                      </td>
                                      <td className="py-2.5 px-4 text-right tabular-nums">
                                        {extended != null ? `$${extended.toFixed(2)}` : '—'}
                                      </td>
                                    </tr>
                                  )
                                })
                              : Object.entries(selectedSubmission.answers).map(([key, val]) => (
                                  <tr key={key}>
                                    <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400">{key}</td>
                                    <td className="py-2.5 px-4 text-gray-400">—</td>
                                    <td className="py-2.5 px-4 text-gray-400">—</td>
                                    <td className="py-2.5 px-4 text-gray-400">—</td>
                                    <td className="py-2.5 px-4 text-gray-400">—</td>
                                    <td className="py-2.5 px-4 text-right tabular-nums">{val}</td>
                                    <td className="py-2.5 px-4 text-gray-400">—</td>
                                  </tr>
                                ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {selectedSubmission.notes && (
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{selectedSubmission.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                  </div>
                )}
              </div>
              {selectedSubmission && (
                <div className="sticky bottom-0 p-4 pt-0 bg-white dark:bg-gray-900 flex-shrink-0 sm:hidden">
                  <button
                    type="button"
                    onClick={() => { setSelectedId(null); setSelectedSubmission(null) }}
                    className="w-full min-h-[48px] py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-medium touch-manipulation"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

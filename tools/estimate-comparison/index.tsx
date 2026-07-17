'use client'

// Estimate Comparison — v2 UI over the deterministic engine.
// Design: docs/estimate-comparison-redesign.md. Upload both PDFs → the
// engine parses (trust gate), matches in tiers, and computes every delta in
// code. Client/claim info is read from the PDFs — nothing is typed.
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'

interface LineItem {
  lineNumber: number
  room: string
  description: string
  quantity: number
  unit: string
  unitPriceCents: number
  rcvCents: number
  catalog?: { code: string; category: string | null } | null
}

interface Pair {
  mine: LineItem
  carrier: LineItem
  tier: string
  qtyDelta: number
  rcvDeltaCents: number
  unitPriceDeltaCents: number
}

interface Recommendation {
  room: string
  priority: 'critical' | 'minor'
  missing: string
  reason: string
  suggestedQty: number | null
  suggestedUnit: string | null
}

interface Suggestion {
  mine: LineItem
  carrier: LineItem
  reason: string
}

interface RoomSuggestion {
  mineRoom: string
  carrierRoom: string
  sharedItems: number
  geometry: string | null
  confidence: string
}

interface CompareReport {
  comparisonId?: string | null
  suggestions?: Suggestion[]
  roomPairs?: RoomSuggestion[]
  roomSuggestions?: RoomSuggestion[]
  summary: {
    clientName: string | null
    claimNumber: string | null
    mineTotal: string
    carrierTotal: string
    delta: string
    deltaRcvCents: number
    gates: { mine: boolean; carrier: boolean }
    counts: { matched: number; differences: number; mineOnly: number; carrierOnly: number }
  }
  rollups: { room: string; mineRcvCents: number; carrierRcvCents: number; deltaRcvCents: number }[]
  pairs: Pair[]
  mineOnly: LineItem[]
  carrierOnly: LineItem[]
  recommendations: Recommendation[]
}

type Bucket = 'differences' | 'missing' | 'carrier-only' | 'matched'

interface UploadedFile {
  id: string
  filename: string
  originalName: string
  url: string
}

interface HistoryEntry {
  id: string
  clientName: string | null
  claimNumber: string | null
  deltaRcvCents: number
  matchedCount: number
  mineOnlyCount: number
  carrierOnlyCount: number
  createdAt: string
}

const fmt = (cents: number): string =>
  `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  })}`

// Delta convention (Manny, 2026-07-16): deltas read from OUR side — the
// carrier should pay our amount or more. Engine stores mine − carrier;
// display carrier − mine, so carrier short = negative = red.
const shortfallCents = (mineMinusCarrierCents: number): number => -mineMinusCarrierCents

const deltaClass = (carrierMinusMine: number): string =>
  carrierMinusMine < 0
    ? 'text-red-700 dark:text-red-400'
    : carrierMinusMine > 0
      ? 'text-green-700 dark:text-green-400'
      : 'text-gray-400'

/** Room identity for grouping (mirror of the server's normalizeRoom). */
const roomKey = (room: string): string =>
  room.toLowerCase().replace(/\s*\(#\d+\)$/, '').replace(/\s+/g, ' ').trim()

const TIER_LABELS: Record<string, string> = {
  'code-room': 'exact',
  code: 'code (room moved)',
  'description-room': 'description',
  description: 'description (room moved)',
  'ai-confirmed': 'confirmed by you',
}

export default function EstimateComparisonTool() {
  const { data: session } = useSession()
  const [mineFile, setMineFile] = useState<UploadedFile | null>(null)
  const [carrierFile, setCarrierFile] = useState<UploadedFile | null>(null)
  const [processing, setProcessing] = useState(false)
  const [report, setReport] = useState<CompareReport | null>(null)
  const [error, setError] = useState('')
  const [bucket, setBucket] = useState<Bucket>('differences')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())

  // Per-room breakdown for the By-room drop-downs: what's in one estimate
  // and not the other, and what differs, for that room only.
  const roomDetails = useMemo(() => {
    const details = new Map<
      string,
      { missing: LineItem[]; carrierOnly: LineItem[]; differs: Pair[]; equal: number }
    >()
    if (!report) return details
    const bucket = (key: string) => {
      let d = details.get(key)
      if (!d) {
        d = { missing: [], carrierOnly: [], differs: [], equal: 0 }
        details.set(key, d)
      }
      return d
    }
    for (const item of report.mineOnly) bucket(roomKey(item.room)).missing.push(item)
    for (const item of report.carrierOnly) bucket(roomKey(item.room)).carrierOnly.push(item)
    for (const pair of report.pairs) {
      const d = bucket(roomKey(pair.mine.room))
      if (pair.rcvDeltaCents !== 0 || pair.qtyDelta !== 0) d.differs.push(pair)
      else d.equal += 1
    }
    for (const d of details.values()) {
      d.missing.sort((a, b) => b.rcvCents - a.rcvCents)
      d.carrierOnly.sort((a, b) => b.rcvCents - a.rcvCents)
      d.differs.sort((a, b) => Math.abs(b.rcvDeltaCents) - Math.abs(a.rcvDeltaCents))
    }
    return details
  }, [report])

  const toggleRoom = (key: string) => {
    setExpandedRooms((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (report !== null || history !== null || !session?.user?.id) return
    fetch('/api/tools/estimate-comparison/history')
      .then(async (response) => {
        const data = await response.json()
        if (response.ok) setHistory(data.comparisons ?? [])
      })
      .catch(() => setHistory([]))
  }, [report, history, session?.user?.id])

  const openHistory = async (id: string) => {
    setProcessing(true)
    setError('')
    try {
      const response = await fetch(`/api/tools/estimate-comparison/history/${id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load comparison')
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load comparison')
    } finally {
      setProcessing(false)
    }
  }

  const runComparison = async () => {
    if (!mineFile || !carrierFile || !session?.user?.id) {
      setError('Upload both estimates and sign in')
      return
    }
    setProcessing(true)
    setError('')
    setSaved(false)
    logUsage(session.user.id, 'estimate-comparison', 'comparison_started', {})
    try {
      const response = await fetch('/api/tools/estimate-comparison/compare-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mineFileId: mineFile.id, carrierFileId: carrierFile.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Comparison failed (${response.status})`)
      setReport(data)
      logUsage(session.user.id, 'estimate-comparison', 'comparison_completed', {
        claimNumber: data.summary?.claimNumber,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleSave = async () => {
    if (!report || !session?.user?.id) return
    try {
      const response = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'estimate-comparison',
          title: `Comparison — ${report.summary.clientName ?? 'estimate'}`,
          description: report.summary.claimNumber ? `Claim ${report.summary.claimNumber}` : '',
          data: report,
        }),
      })
      if (!response.ok) throw new Error()
      setSaved(true)
    } catch {
      setError('Save failed')
    }
  }

  const exportCsv = () => {
    if (!report) return
    const rows: string[][] = [
      ['Bucket', 'Room', 'Code', 'Description', 'Mine Qty', 'Carrier Qty', 'Mine RCV', 'Carrier RCV', 'Delta'],
      ...report.pairs
        .filter((p) => p.rcvDeltaCents !== 0 || p.qtyDelta !== 0)
        .map((p) => [
          'difference',
          p.mine.room,
          p.mine.catalog?.code ?? '',
          p.mine.description,
          String(p.mine.quantity),
          String(p.carrier.quantity),
          (p.mine.rcvCents / 100).toFixed(2),
          (p.carrier.rcvCents / 100).toFixed(2),
          (p.rcvDeltaCents / 100).toFixed(2),
        ]),
      ...report.mineOnly.map((i) => [
        'missing-from-carrier',
        i.room,
        i.catalog?.code ?? '',
        i.description,
        String(i.quantity),
        '',
        (i.rcvCents / 100).toFixed(2),
        '',
        (i.rcvCents / 100).toFixed(2),
      ]),
      ...report.carrierOnly.map((i) => [
        'carrier-only',
        i.room,
        i.catalog?.code ?? '',
        i.description,
        '',
        String(i.quantity),
        '',
        (i.rcvCents / 100).toFixed(2),
        (-i.rcvCents / 100).toFixed(2),
      ]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison_${report.summary.claimNumber ?? 'estimate'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Room pairing suggestions: confirming stores a permanent alias (applies
  // from the next comparison on); rejecting just dismisses the suggestion.
  const resolveRoomSuggestion = async (suggestion: RoomSuggestion, confirmed: boolean) => {
    setReport((current) =>
      current
        ? {
            ...current,
            roomSuggestions: (current.roomSuggestions ?? []).filter((s) => s !== suggestion),
          }
        : current
    )
    if (!confirmed) return
    try {
      await fetch('/api/tools/estimate-comparison/confirm-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mineRoom: suggestion.mineRoom,
          carrierRoom: suggestion.carrierRoom,
        }),
      })
    } catch {
      setError('Could not save the room pairing')
    }
  }

  // Review queue: confirming folds the AI-suggested pair into the report and
  // teaches the matcher the synonym; rejecting just drops the suggestion.
  const resolveSuggestion = async (suggestion: Suggestion, confirmed: boolean) => {
    setReport((current) => {
      if (!current) return current
      const suggestions = (current.suggestions ?? []).filter((s) => s !== suggestion)
      if (!confirmed) return { ...current, suggestions }
      return {
        ...current,
        suggestions,
        pairs: [
          ...current.pairs,
          {
            mine: suggestion.mine,
            carrier: suggestion.carrier,
            tier: 'ai-confirmed',
            qtyDelta: Math.round((suggestion.mine.quantity - suggestion.carrier.quantity) * 100) / 100,
            rcvDeltaCents: suggestion.mine.rcvCents - suggestion.carrier.rcvCents,
            unitPriceDeltaCents: suggestion.mine.unitPriceCents - suggestion.carrier.unitPriceCents,
          },
        ],
        mineOnly: current.mineOnly.filter((i) => i.lineNumber !== suggestion.mine.lineNumber),
        carrierOnly: current.carrierOnly.filter(
          (i) => i.lineNumber !== suggestion.carrier.lineNumber
        ),
        summary: {
          ...current.summary,
          counts: {
            ...current.summary.counts,
            matched: current.summary.counts.matched + 1,
            mineOnly: current.summary.counts.mineOnly - 1,
            carrierOnly: current.summary.counts.carrierOnly - 1,
          },
        },
      }
    })
    if (confirmed && report?.comparisonId) {
      try {
        await fetch('/api/tools/estimate-comparison/confirm-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comparisonId: report.comparisonId,
            mineLineNumber: suggestion.mine.lineNumber,
            carrierLineNumber: suggestion.carrier.lineNumber,
          }),
        })
      } catch {
        setError('Could not save the confirmed match')
      }
    }
  }

  const exportPdf = async () => {
    if (!report) return
    try {
      const response = await fetch('/api/tools/estimate-comparison/export-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Supplement_${report.summary.claimNumber ?? 'estimate'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('PDF export failed')
    }
  }

  const visiblePairs = useMemo(() => {
    if (!report) return []
    const matchesSearch = (text: string): boolean =>
      search === '' || text.toLowerCase().includes(search.toLowerCase())
    const source =
      bucket === 'differences'
        ? report.pairs.filter((p) => p.rcvDeltaCents !== 0 || p.qtyDelta !== 0)
        : bucket === 'matched'
          ? report.pairs.filter((p) => p.rcvDeltaCents === 0 && p.qtyDelta === 0)
          : []
    return source
      .filter((p) => matchesSearch(`${p.mine.description} ${p.mine.room} ${p.mine.catalog?.code ?? ''}`))
      .sort((a, b) => Math.abs(b.rcvDeltaCents) - Math.abs(a.rcvDeltaCents))
  }, [report, bucket, search])

  const visibleSingles = useMemo(() => {
    if (!report) return []
    const matchesSearch = (text: string): boolean =>
      search === '' || text.toLowerCase().includes(search.toLowerCase())
    const source =
      bucket === 'missing' ? report.mineOnly : bucket === 'carrier-only' ? report.carrierOnly : []
    return source
      .filter((i) => matchesSearch(`${i.description} ${i.room} ${i.catalog?.code ?? ''}`))
      .sort((a, b) => b.rcvCents - a.rcvCents)
  }, [report, bucket, search])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Estimate Comparison</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your estimate vs the carrier&apos;s — parsed, reconciled, and matched deterministically.
            </p>
          </div>
        </div>

        {!report && (
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8">
            <div className="grid lg:grid-cols-2 gap-8 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">My estimate</h3>
                <FileUpload
                  toolId="estimate-comparison"
                  onUploadComplete={(f) => {
                    setMineFile(f)
                    setError('')
                  }}
                  accept={{ 'application/pdf': ['.pdf'] }}
                />
                {mineFile && <UploadedBadge name={mineFile.originalName} />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Carrier&apos;s estimate
                </h3>
                <FileUpload
                  toolId="estimate-comparison"
                  onUploadComplete={(f) => {
                    setCarrierFile(f)
                    setError('')
                  }}
                  accept={{ 'application/pdf': ['.pdf'] }}
                />
                {carrierFile && <UploadedBadge name={carrierFile.originalName} />}
              </div>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-sm text-red-900 dark:text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            <button
              onClick={runComparison}
              disabled={!mineFile || !carrierFile || processing}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowLeftRight className="w-5 h-5" />}
              {processing ? 'Parsing & matching…' : 'Compare'}
            </button>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Client and claim info are read from the PDFs — nothing to type.
            </p>

            {history && history.length > 0 && (
              <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Recent comparisons
                </h3>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {history.slice(0, 10).map((entry) => (
                    <li key={entry.id}>
                      <button
                        onClick={() => openHistory(entry.id)}
                        className="w-full text-left py-2.5 flex flex-wrap items-baseline gap-x-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-2"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {entry.clientName ?? 'Comparison'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.claimNumber ? `Claim ${entry.claimNumber} · ` : ''}
                          {new Date(entry.createdAt).toLocaleDateString('en-US')}
                        </span>
                        <span
                          className={`ml-auto tabular-nums text-sm font-semibold ${deltaClass(shortfallCents(entry.deltaRcvCents))}`}
                        >
                          {fmt(shortfallCents(entry.deltaRcvCents))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {report && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {report.summary.clientName ?? 'Comparison'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.summary.claimNumber
                      ? `Claim ${report.summary.claimNumber}`
                      : 'Claim number not found in PDFs'}
                  </p>
                </div>
                <GateBadge label="Mine" ok={report.summary.gates.mine} />
                <GateBadge label="Carrier" ok={report.summary.gates.carrier} />
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={exportPdf}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={exportCsv}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> CSV
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> {saved ? 'Saved ✓' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setReport(null)
                      setMineFile(null)
                      setCarrierFile(null)
                      setHistory(null)
                    }}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    New comparison
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                <SummaryTile label="My estimate" value={report.summary.mineTotal} />
                <SummaryTile label="Carrier's estimate" value={report.summary.carrierTotal} />
                <SummaryTile
                  label="Carrier vs. my estimate"
                  value={fmt(shortfallCents(report.summary.deltaRcvCents))}
                  sub={
                    shortfallCents(report.summary.deltaRcvCents) < 0
                      ? 'carrier is short — recovery target'
                      : 'carrier meets or exceeds my estimate'
                  }
                  tone={shortfallCents(report.summary.deltaRcvCents) < 0 ? 'bad' : 'good'}
                />
                <SummaryTile
                  label="Matched items"
                  value={`${report.summary.counts.matched}`}
                  sub={`${report.summary.counts.differences} differ · ${report.summary.counts.mineOnly} missing · ${report.summary.counts.carrierOnly} carrier-only`}
                />
              </div>
            </div>

            {(report.roomSuggestions?.length ?? 0) > 0 && (
              <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-blue-200 dark:border-blue-800/50 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Same room? ({report.roomSuggestions!.length})
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  These rooms look like the same space under different names. Confirming is remembered
                  and merges them automatically from the next comparison on.
                </p>
                <ul className="space-y-2">
                  {report.roomSuggestions!.map((suggestion, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {suggestion.mineRoom} <span className="text-gray-400">↔</span> {suggestion.carrierRoom}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {[
                          suggestion.sharedItems > 0 ? `${suggestion.sharedItems} shared items` : null,
                          suggestion.geometry,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => resolveRoomSuggestion(suggestion, true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white"
                        >
                          Same room
                        </button>
                        <button
                          onClick={() => resolveRoomSuggestion(suggestion, false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          Different
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(report.suggestions?.length ?? 0) > 0 && (
              <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-amber-200 dark:border-amber-800/50 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Needs your review ({report.suggestions!.length})
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  AI-suggested pairings for unmatched items — nothing counts until you confirm.
                  Confirmed pairs are remembered and auto-match next time.
                </p>
                <ul className="space-y-3">
                  {report.suggestions!.map((suggestion, i) => (
                    <li
                      key={i}
                      className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                    >
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Mine</p>
                          <p className="text-gray-900 dark:text-white">{suggestion.mine.description}</p>
                          <p className="text-xs text-gray-500 tabular-nums">
                            {suggestion.mine.room} · {suggestion.mine.quantity} {suggestion.mine.unit} ·{' '}
                            {fmt(suggestion.mine.rcvCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Carrier</p>
                          <p className="text-gray-900 dark:text-white">{suggestion.carrier.description}</p>
                          <p className="text-xs text-gray-500 tabular-nums">
                            {suggestion.carrier.room} · {suggestion.carrier.quantity}{' '}
                            {suggestion.carrier.unit} · {fmt(suggestion.carrier.rcvCents)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex-1 min-w-[200px]">
                          {suggestion.reason}
                        </p>
                        <button
                          onClick={() => resolveSuggestion(suggestion, true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white"
                        >
                          Confirm match
                        </button>
                        <button
                          onClick={() => resolveSuggestion(suggestion, false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          Not a match
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.recommendations.length > 0 && (
              <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-5 h-5 text-red-600" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Scope Check on my estimate ({report.recommendations.length})
                  </h2>
                </div>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                      <span
                        className={`font-semibold ${rec.priority === 'critical' ? 'text-red-600' : 'text-amber-600'}`}
                      >
                        {rec.room}:
                      </span>{' '}
                      missing {rec.missing}
                      {rec.suggestedQty !== null && (
                        <span className="text-gray-500">
                          {' '}
                          — suggest ~{rec.suggestedQty.toFixed(2)} {rec.suggestedUnit ?? ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white">
                By room
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                      <th className="px-5 py-2">Room</th>
                      <th className="px-5 py-2 text-right">Mine</th>
                      <th className="px-5 py-2 text-right">Carrier</th>
                      <th className="px-5 py-2 text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rollups.map((r) => {
                      const key = roomKey(r.room)
                      const detail = roomDetails.get(key)
                      const expanded = expandedRooms.has(key)
                      const delta = shortfallCents(r.deltaRcvCents)
                      return (
                        <RoomRow
                          key={r.room}
                          room={r.room}
                          mine={r.mineRcvCents}
                          carrier={r.carrierRcvCents}
                          delta={delta}
                          expanded={expanded}
                          detail={detail}
                          onToggle={() => toggleRoom(key)}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
              <div className="px-5 pt-4 flex flex-wrap items-center gap-2">
                {(
                  [
                    ['differences', `Differences (${report.summary.counts.differences})`],
                    ['missing', `Missing from carrier's (${report.summary.counts.mineOnly})`],
                    ['carrier-only', `Only in carrier's (${report.summary.counts.carrierOnly})`],
                    ['matched', 'Matched, equal'],
                  ] as [Bucket, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setBucket(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      bucket === key
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="ml-auto relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items, rooms, codes…"
                    className="pl-9 pr-3 py-1.5 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <ul className="divide-y divide-gray-100 dark:divide-gray-700/50 mt-3">
                {(bucket === 'differences' || bucket === 'matched') &&
                  visiblePairs.map((pair, i) => (
                    <li key={i} className="px-5 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-xs font-mono text-red-600">
                          {pair.mine.catalog?.code ?? '—'}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {pair.mine.description}
                        </span>
                        <span className="text-xs text-gray-400">
                          {pair.mine.room} · {TIER_LABELS[pair.tier] ?? pair.tier}
                        </span>
                        <span
                          className={`ml-auto tabular-nums font-semibold ${deltaClass(shortfallCents(pair.rcvDeltaCents))}`}
                        >
                          {fmt(shortfallCents(pair.rcvDeltaCents))}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                        mine: {pair.mine.quantity} {pair.mine.unit} @ {fmt(pair.mine.unitPriceCents)} ={' '}
                        {fmt(pair.mine.rcvCents)}
                        {' · '}
                        carrier: {pair.carrier.quantity} {pair.carrier.unit} @{' '}
                        {fmt(pair.carrier.unitPriceCents)} = {fmt(pair.carrier.rcvCents)}
                      </p>
                    </li>
                  ))}
                {(bucket === 'missing' || bucket === 'carrier-only') &&
                  visibleSingles.map((item, i) => (
                    <li key={i} className="px-5 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-xs font-mono text-red-600">{item.catalog?.code ?? '—'}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{item.description}</span>
                        <span className="text-xs text-gray-400">{item.room}</span>
                        <span className="ml-auto tabular-nums font-semibold text-gray-900 dark:text-white">
                          {item.quantity} {item.unit} · {fmt(item.rcvCents)}
                        </span>
                      </div>
                    </li>
                  ))}
                {((bucket === 'differences' || bucket === 'matched')
                  ? visiblePairs.length
                  : visibleSingles.length) === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Nothing in this bucket{search ? ' matching your search' : ''}.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface RoomDetail {
  missing: LineItem[]
  carrierOnly: LineItem[]
  differs: Pair[]
  equal: number
}

interface RoomRowProps {
  room: string
  mine: number
  carrier: number
  /** carrier − mine: negative = carrier is short (red). */
  delta: number
  expanded: boolean
  detail: RoomDetail | undefined
  onToggle: () => void
}

function RoomRow({ room, mine, carrier, delta, expanded, detail, onToggle }: RoomRowProps) {
  const hasDetail =
    !!detail && (detail.missing.length > 0 || detail.carrierOnly.length > 0 || detail.differs.length > 0)
  return (
    <>
      <tr
        className={`border-t border-gray-100 dark:border-gray-700/50 ${hasDetail ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}`}
        onClick={hasDetail ? onToggle : undefined}
      >
        <td className="px-5 py-2 text-gray-900 dark:text-white">
          <span className="inline-flex items-center gap-1.5">
            {hasDetail ? (
              expanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )
            ) : (
              <span className="w-4" />
            )}
            {room}
          </span>
        </td>
        <td className="px-5 py-2 text-right tabular-nums">{fmt(mine)}</td>
        <td className="px-5 py-2 text-right tabular-nums">{fmt(carrier)}</td>
        <td className={`px-5 py-2 text-right tabular-nums font-semibold ${deltaClass(delta)}`}>
          {fmt(delta)}
        </td>
      </tr>
      {expanded && detail && (
        <>
          <DetailHeaderRow label={`In mine, not in carrier's (${detail.missing.length})`} show={detail.missing.length > 0} />
          {detail.missing.map((item) => (
            <DetailRow
              key={`m-${item.lineNumber}`}
              code={item.catalog?.code ?? null}
              lineLabel={`L${item.lineNumber}`}
              description={item.description}
              mine={`${item.quantity} ${item.unit} · ${fmt(item.rcvCents)}`}
              carrier="—"
              delta={-item.rcvCents}
            />
          ))}
          <DetailHeaderRow label={`In carrier's, not in mine (${detail.carrierOnly.length})`} show={detail.carrierOnly.length > 0} />
          {detail.carrierOnly.map((item) => (
            <DetailRow
              key={`c-${item.lineNumber}`}
              code={item.catalog?.code ?? null}
              lineLabel={`carrier L${item.lineNumber}`}
              description={item.description}
              mine="—"
              carrier={`${item.quantity} ${item.unit} · ${fmt(item.rcvCents)}`}
              delta={item.rcvCents}
            />
          ))}
          <DetailHeaderRow label={`Same item, different numbers (${detail.differs.length})`} show={detail.differs.length > 0} />
          {detail.differs.map((pair, i) => (
            <DetailRow
              key={`d-${i}`}
              code={pair.mine.catalog?.code ?? null}
              lineLabel={`L${pair.mine.lineNumber}`}
              description={pair.mine.description}
              mine={`${pair.mine.quantity} ${pair.mine.unit} · ${fmt(pair.mine.rcvCents)}`}
              carrier={`${pair.carrier.quantity} ${pair.carrier.unit} · ${fmt(pair.carrier.rcvCents)}`}
              delta={shortfallCents(pair.rcvDeltaCents)}
              highlightQty={pair.qtyDelta !== 0}
            />
          ))}
          {detail.equal > 0 && (
            <tr className="bg-gray-50/60 dark:bg-gray-900/40">
              <td colSpan={4} className="px-5 py-2 pl-12 text-xs text-gray-400 dark:text-gray-500">
                {detail.equal} matched item{detail.equal === 1 ? '' : 's'} with no differences
              </td>
            </tr>
          )}
        </>
      )}
    </>
  )
}

function DetailHeaderRow({ label, show }: { label: string; show: boolean }) {
  if (!show) return null
  return (
    <tr className="bg-gray-100/80 dark:bg-gray-800/70">
      <td colSpan={4} className="px-5 py-1.5 pl-12 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </td>
    </tr>
  )
}

interface DetailRowProps {
  code: string | null
  /** Printed line number in the source PDF — distinguishes real duplicates. */
  lineLabel: string
  description: string
  mine: string
  carrier: string
  /** carrier − mine for this line: negative = carrier short (red). */
  delta: number
  highlightQty?: boolean
}

/** Item row aligned to the parent table's MINE / CARRIER / DELTA columns. */
function DetailRow({ code, lineLabel, description, mine, carrier, delta, highlightQty }: DetailRowProps) {
  return (
    <tr className="bg-gray-50/60 dark:bg-gray-900/40 border-t border-gray-100/70 dark:border-gray-800">
      <td className="px-5 py-1.5 pl-12">
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mr-1.5">{lineLabel}</span>
        <span className="text-xs font-mono text-red-600 mr-2">{code ?? '–'}</span>
        <span className="text-[13px] text-gray-800 dark:text-gray-200">
          {description}
          {highlightQty && (
            <span className="ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              qty differs
            </span>
          )}
        </span>
      </td>
      <td className="px-5 py-1.5 text-right tabular-nums text-[13px] text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {mine}
      </td>
      <td className="px-5 py-1.5 text-right tabular-nums text-[13px] text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {carrier}
      </td>
      <td className={`px-5 py-1.5 text-right tabular-nums text-[13px] font-semibold whitespace-nowrap ${deltaClass(delta)}`}>
        {fmt(delta)}
      </td>
    </tr>
  )
}

function UploadedBadge({ name }: { name: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-900 dark:text-green-300">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{name}</span>
    </div>
  )
}

function GateBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
        ok
          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
      }`}
    >
      {ok ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldX className="w-3.5 h-3.5" />}
      {label} {ok ? 'reconciled' : 'not reconciled'}
    </span>
  )
}

interface SummaryTileProps {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad'
}

function SummaryTile({ label, value, sub, tone }: SummaryTileProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums mt-1 ${
          tone === 'good'
            ? 'text-green-700 dark:text-green-400'
            : tone === 'bad'
              ? 'text-red-700 dark:text-red-400'
              : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

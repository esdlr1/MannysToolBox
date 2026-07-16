'use client'

// Estimate Comparison — v2 UI over the deterministic engine.
// Design: docs/estimate-comparison-redesign.md. Upload both PDFs → the
// engine parses (trust gate), matches in tiers, and computes every delta in
// code. Client/claim info is read from the PDFs — nothing is typed.
import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
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

interface CompareReport {
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

const fmt = (cents: number): string =>
  `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  })}`

const TIER_LABELS: Record<string, string> = {
  'code-room': 'exact',
  code: 'code (room moved)',
  'description-room': 'description',
  description: 'description (room moved)',
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
                  label={report.summary.deltaRcvCents >= 0 ? 'Difference (my favor)' : 'Difference'}
                  value={report.summary.delta}
                  tone={report.summary.deltaRcvCents >= 0 ? 'good' : 'bad'}
                />
                <SummaryTile
                  label="Matched items"
                  value={`${report.summary.counts.matched}`}
                  sub={`${report.summary.counts.differences} differ · ${report.summary.counts.mineOnly} missing · ${report.summary.counts.carrierOnly} carrier-only`}
                />
              </div>
            </div>

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
                    {report.rollups.map((r) => (
                      <tr key={r.room} className="border-t border-gray-100 dark:border-gray-700/50">
                        <td className="px-5 py-2 text-gray-900 dark:text-white">{r.room}</td>
                        <td className="px-5 py-2 text-right tabular-nums">{fmt(r.mineRcvCents)}</td>
                        <td className="px-5 py-2 text-right tabular-nums">{fmt(r.carrierRcvCents)}</td>
                        <td
                          className={`px-5 py-2 text-right tabular-nums font-semibold ${
                            r.deltaRcvCents > 0
                              ? 'text-green-700 dark:text-green-400'
                              : r.deltaRcvCents < 0
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-gray-400'
                          }`}
                        >
                          {fmt(r.deltaRcvCents)}
                        </td>
                      </tr>
                    ))}
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
                          className={`ml-auto tabular-nums font-semibold ${
                            pair.rcvDeltaCents > 0
                              ? 'text-green-700 dark:text-green-400'
                              : pair.rcvDeltaCents < 0
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-gray-400'
                          }`}
                        >
                          {fmt(pair.rcvDeltaCents)}
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

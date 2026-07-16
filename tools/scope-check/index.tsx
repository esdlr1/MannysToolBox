'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'

interface PreflightMetadata {
  clientName: string | null
  claimNumber: string | null
  estimatorName: string | null
  estimateName: string | null
}

interface PreflightRecommendation {
  room: string
  ruleName: string
  priority: 'critical' | 'minor'
  missing: string
  reason: string
  triggeredBy: string
  suggestedQty: number | null
  suggestedUnit: string | null
}

interface PreflightReport {
  metadata: PreflightMetadata | null
  gate: {
    passed: boolean
    parsedTotal: string
    printedTotal: string | null
    messages: string[]
  }
  stats: { rooms: number; items: number; codesResolved: number; rulesEvaluated: number }
  recommendations: PreflightRecommendation[]
}

export default function ScopeCheckTool() {
  const { data: session } = useSession()
  const [checking, setChecking] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [report, setReport] = useState<PreflightReport | null>(null)
  const [error, setError] = useState('')

  const runPreflight = async (file: { id: string; originalName: string }) => {
    if (!session?.user?.id) {
      setError('Please sign in to run a pre-flight check')
      return
    }
    setFileName(file.originalName)
    setChecking(true)
    setError('')
    setReport(null)
    try {
      const response = await fetch('/api/tools/scope-check/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || `Pre-flight failed (${response.status})`)
      }
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pre-flight failed')
    } finally {
      setChecking(false)
    }
  }

  const byRoom = new Map<string, PreflightRecommendation[]>()
  for (const rec of report?.recommendations ?? []) {
    const list = byRoom.get(rec.room)
    if (list) list.push(rec)
    else byRoom.set(rec.room, [rec])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Scope Check</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Drop in your estimate before it goes out — see what might be missing. No typing.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 mb-6">
          <FileUpload
            toolId="scope-check"
            onUploadComplete={runPreflight}
            accept={{ 'application/pdf': ['.pdf'] }}
          />
          {fileName && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FileText className="w-4 h-4" />
              {fileName}
            </div>
          )}
        </div>

        {checking && (
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-10 text-center">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-300">
              Parsing estimate, reconciling totals, checking scope rules…
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
          </div>
        )}

        {report && (
          <div className="space-y-6">
            {/* Claim header — read from the PDF, nothing typed */}
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {report.metadata?.clientName ?? report.metadata?.estimateName ?? 'Estimate'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.metadata?.claimNumber
                      ? `Claim ${report.metadata.claimNumber}`
                      : 'No claim number found in PDF'}
                    {report.metadata?.estimatorName ? ` · Estimator: ${report.metadata.estimatorName}` : ''}
                  </p>
                </div>
                {report.gate.passed ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    <ShieldCheck className="w-4 h-4" />
                    Reconciled — {report.gate.parsedTotal}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                    <ShieldX className="w-4 h-4" />
                    Totals did not reconcile — findings may be incomplete
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {report.stats.rooms} rooms · {report.stats.items} line items ·{' '}
                {report.stats.codesResolved} resolved to Xactimate codes · {report.stats.rulesEvaluated}{' '}
                rules checked
              </p>
              {!report.gate.passed &&
                report.gate.messages.map((message) => (
                  <p key={message} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    {message}
                  </p>
                ))}
            </div>

            {/* Findings */}
            {report.recommendations.length === 0 ? (
              <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  No missing scope found
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Every approved rule was satisfied. Rules grow as your estimate library grows.
                </p>
              </div>
            ) : (
              Array.from(byRoom.entries()).map(([room, recs]) => (
                <div
                  key={room}
                  className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden"
                >
                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{room}</h3>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {recs.map((rec, index) => (
                      <li key={`${rec.ruleName}-${index}`} className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                              rec.priority === 'critical' ? 'text-red-600' : 'text-amber-500'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white">
                              Missing: {rec.missing}
                              {rec.suggestedQty !== null && (
                                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                                  suggest ~{rec.suggestedQty.toFixed(2)} {rec.suggestedUnit ?? ''} (from
                                  sketch)
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{rec.reason}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                              Triggered by: {rec.triggeredBy}
                            </p>
                          </div>
                          <span
                            className={`ml-auto flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                              rec.priority === 'critical'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {rec.priority}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

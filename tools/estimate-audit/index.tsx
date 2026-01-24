'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import { EstimateAuditResult } from '@/types/estimate-audit'
import { AlertCircle, CheckCircle2, FileSearch, Loader2, ShieldCheck } from 'lucide-react'

export default function EstimateAuditTool() {
  const { data: session } = useSession()
  const [file, setFile] = useState<{ id: string; filename: string; originalName: string; url: string } | null>(null)
  const [projectName, setProjectName] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<EstimateAuditResult | null>(null)
  const [error, setError] = useState('')

  const handleUpload = (uploadedFile: { id: string; filename: string; originalName: string; url: string }) => {
    setFile(uploadedFile)
    setError('')
    setResult(null)
  }

  const handleAnalyze = async () => {
    if (!file || !session?.user?.id) {
      setError('Please upload an estimate first.')
      return
    }

    setProcessing(true)
    setError('')
    setResult(null)

    try {
      logUsage(session.user.id, 'estimate-audit', 'audit_started', {
        projectName,
      })

      const response = await fetch('/api/tools/estimate-audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          projectName,
          notes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to analyze estimate')
      }

      const data = await response.json()
      setResult(data)

      logUsage(session.user.id, 'estimate-audit', 'audit_completed', {
        missingCount: data.summary?.missingCount ?? 0,
      })
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the estimate')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-500/20">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Estimate Completeness Audit
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                Upload a single estimate to check for missing line items and scope dependencies.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Name (optional)
              </label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="e.g., Smith Residence - Kitchen"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="Any scope notes or special conditions"
              />
            </div>
          </div>

          <FileUpload
            toolId="estimate-audit"
            onUploadComplete={handleUpload}
            accept={{ 'application/pdf': ['.pdf'] }}
            maxSize={20 * 1024 * 1024}
          />

          {file && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Uploaded: <span className="font-medium">{file.originalName}</span>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!file || processing}
            className="mt-6 w-full py-3 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                Analyze Estimate
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Checked Rules</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.summary.checkedRules}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Missing Items</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.summary.missingCount}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.summary.criticalCount}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Minor</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.summary.minorCount}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Missing Line Items
              </h2>

              {result.missingLineItems.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>No missing line items detected.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {result.missingLineItems.map((item, idx) => (
                    <div
                      key={`${item.requiredItem}-${idx}`}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {item.requiredItem}
                            {item.xactimateCode && (
                              <span className="ml-2 text-xs font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                {item.xactimateCode}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            item.priority === 'critical'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}
                        >
                          {item.priority === 'critical' ? 'Critical' : 'Minor'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.reason}</p>
                      
                      {/* Show suggested line items directly - these are what's needed */}
                      {item.suggestedLineItems && item.suggestedLineItems.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-2">
                            Suggested Line Items to Add:
                          </div>
                          <ul className="space-y-1">
                            {item.suggestedLineItems.map((lineItem, lidx) => (
                              <li key={`${idx}-${lidx}`} className="text-xs text-blue-800 dark:text-blue-200 font-mono">
                                • {lineItem}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Show related items found (what triggered this suggestion) */}
                      {item.relatedItemsFound && item.relatedItemsFound.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium">Related items found:</span> {item.relatedItemsFound.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result.notes?.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Notes</h2>
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {result.notes.map((note, idx) => (
                    <li key={`${note}-${idx}`}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

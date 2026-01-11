'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import { ComparisonResult } from '@/types/estimate-comparison'

export default function EstimateComparisonTool() {
  const { data: session } = useSession()
  const [step, setStep] = useState(1)
  const [adjusterFile, setAdjusterFile] = useState<{ id: string; filename: string; originalName: string; url: string } | null>(null)
  const [contractorFile, setContractorFile] = useState<{ id: string; filename: string; originalName: string; url: string } | null>(null)
  const [clientName, setClientName] = useState('')
  const [claimNumber, setClaimNumber] = useState('')
  const [processing, setProcessing] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [showSideBySide, setShowSideBySide] = useState(false)
  const [showHighlighted, setShowHighlighted] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleAdjusterUpload = (file: { id: string; filename: string; originalName: string; url: string }) => {
    setAdjusterFile(file)
    setError('')
  }

  const handleContractorUpload = (file: { id: string; filename: string; originalName: string; url: string }) => {
    setContractorFile(file)
    setError('')
  }

  const handleNext = () => {
    if (step === 1 && adjusterFile && contractorFile) {
      setStep(2)
    } else if (step === 2 && clientName && claimNumber) {
      setStep(3)
      processComparison()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const processComparison = async () => {
    if (!adjusterFile || !contractorFile || !session?.user?.id) {
      setError('Please upload both estimates and sign in')
      return
    }

    setProcessing(true)
    setError('')

    try {
      // Log usage
      logUsage(session.user.id, 'estimate-comparison', 'comparison_started', {
        clientName,
        claimNumber,
      })

      // Call API to process comparison
      const response = await fetch('/api/tools/estimate-comparison/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjusterFileId: adjusterFile.id,
          contractorFileId: contractorFile.id,
          clientName,
          claimNumber,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to process comparison')
      }

      const result = await response.json()
      setComparisonResult(result)
      setStep(4)

      // Log successful comparison
      logUsage(session.user.id, 'estimate-comparison', 'comparison_completed', {
        clientName,
        claimNumber,
        discrepanciesCount: result.summary.discrepanciesCount,
      })
    } catch (err: any) {
      setError(err.message || 'An error occurred while processing the comparison')
      console.error('Comparison error:', err)
    } finally {
      setProcessing(false)
    }
  }

  const handleSave = async () => {
    if (!comparisonResult || !session?.user?.id) return

    try {
      const response = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'estimate-comparison',
          title: `Estimate Comparison - ${clientName}`,
          description: `Claim #${claimNumber}`,
          data: {
            clientName,
            claimNumber,
            comparisonResult,
            notes,
            adjusterFile: adjusterFile?.originalName,
            contractorFile: contractorFile?.originalName,
          },
        }),
      })

      if (response.ok) {
        alert('Comparison saved successfully!')
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save comparison')
    }
  }

  const handleExportPDF = async () => {
    if (!comparisonResult) return

    try {
      const response = await fetch('/api/tools/estimate-comparison/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          claimNumber,
          comparisonResult,
          notes,
          showSideBySide,
          showHighlighted,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Estimate_Comparison_${clientName}_${claimNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Export error:', err)
      alert('Failed to export PDF')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= s
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step > s ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Upload Files</span>
            <span>Client Info</span>
            <span>Processing</span>
            <span>Results</span>
          </div>
        </div>

        {/* Step 1: File Upload */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Upload Estimates
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adjuster's Estimate
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Upload PDF, Xactimate, or Symbility format
                </p>
                <FileUpload
                  toolId="estimate-comparison"
                  onUploadComplete={handleAdjusterUpload}
                  accept={{
                    'application/pdf': ['.pdf'],
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                  }}
                />
                {adjusterFile && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                    ✓ {adjusterFile.originalName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contractor's Estimate (Xactimate PDF)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Upload your Xactimate PDF estimate
                </p>
                <FileUpload
                  toolId="estimate-comparison"
                  onUploadComplete={handleContractorUpload}
                  accept={{
                    'application/pdf': ['.pdf'],
                  }}
                />
                {contractorFile && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                    ✓ {contractorFile.originalName}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleNext}
                disabled={!adjusterFile || !contractorFile}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Client Information
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Client Information */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Client Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter client name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Claim Number *
                </label>
                <input
                  type="text"
                  value={claimNumber}
                  onChange={(e) => setClaimNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter claim number"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!clientName || !claimNumber}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Process Comparison
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 3 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Processing Comparison
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              AI is analyzing and comparing your estimates...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              This may take a few moments
            </p>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && comparisonResult && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Comparison Results
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Export PDF
                </button>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-4">
                Summary of Discrepancies
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost Difference</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${Math.abs(comparisonResult.summary.totalCostDifference).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Missing Items</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {comparisonResult.summary.missingItemsCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Discrepancies</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {comparisonResult.summary.discrepanciesCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Critical Issues</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {comparisonResult.summary.criticalIssues}
                  </p>
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className="flex gap-4 items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showSideBySide}
                  onChange={(e) => setShowSideBySide(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show Side-by-Side View</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showHighlighted}
                  onChange={(e) => setShowHighlighted(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show Highlighted Differences</span>
              </label>
            </div>

            {/* Missing Items List */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Missing Items
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Item</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Unit Price</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Total</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {comparisonResult.missingItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.item}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">${item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">${item.totalPrice.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              item.priority === 'critical'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discrepancies */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Discrepancies
              </h3>
              <div className="space-y-4">
                {comparisonResult.discrepancies.map((disc, idx) => (
                  <div
                    key={idx}
                    className={`p-4 border rounded-lg ${
                      disc.priority === 'critical'
                        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                        : 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">{disc.item}</h4>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          disc.priority === 'critical'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}
                      >
                        {disc.priority}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Adjuster: </span>
                        <span className="font-medium">{disc.adjusterValue}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Contractor: </span>
                        <span className="font-medium">{disc.contractorValue}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Difference: </span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {disc.difference} ({disc.differencePercent > 0 ? '+' : ''}{disc.differencePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes/Comments
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                placeholder="Add any notes or comments about this comparison..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

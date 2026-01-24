'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import { AlertCircle, Camera, Loader2, Image as ImageIcon, CheckCircle2, FileText, Download } from 'lucide-react'

interface EstimateLineItem {
  code: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  room?: string
  category?: string
}

interface EstimateSummary {
  totalLineItems: number
  totalCost: number
  byCategory: Record<string, number>
  byRoom: Record<string, number>
}

interface PhotoXactEstimate {
  estimate: {
    projectName: string
    claimNumber?: string
    propertyAddress?: string
    date: string
    lineItems: EstimateLineItem[]
    summary: EstimateSummary
    measurements?: Array<{
      type: string
      description: string
      value: number
      unit: string
    }>
    rooms: string[]
  }
  notes?: string[]
  imageUrl: string
  fileName: string
  warnings?: string[]
}

export default function PhotoXactTool() {
  const { data: session } = useSession()
  const [file, setFile] = useState<{ id: string; filename: string; originalName: string; url: string } | null>(null)
  const [projectName, setProjectName] = useState('')
  const [claimNumber, setClaimNumber] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [processing, setProcessing] = useState(false)
  const [estimate, setEstimate] = useState<PhotoXactEstimate | null>(null)
  const [error, setError] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleUpload = (uploadedFile: { id: string; filename: string; originalName: string; url: string }) => {
    setFile(uploadedFile)
    setError('')
    setEstimate(null)
    
    // Load image preview
    fetch(uploadedFile.url)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(blob)
      })
      .catch(err => {
        console.error('Failed to load image preview:', err)
      })
  }

  const handleGenerate = async () => {
    if (!file || !session?.user?.id) {
      setError('Please upload a photo first.')
      return
    }

    setProcessing(true)
    setError('')
    setEstimate(null)

    try {
      logUsage(session.user.id, 'photoxact', 'estimate_generation_started', {
        fileName: file.originalName,
        projectName,
        claimNumber,
      })

      const response = await fetch('/api/tools/photoxact/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          projectName,
          claimNumber,
          propertyAddress,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate estimate')
      }

      const data = await response.json()
      setEstimate(data)

      logUsage(session.user.id, 'photoxact', 'estimate_generated', {
        lineItemsCount: data.estimate?.lineItems?.length || 0,
        totalCost: data.estimate?.summary?.totalCost || 0,
      })
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the estimate')
    } finally {
      setProcessing(false)
    }
  }

  const handleExport = () => {
    if (!estimate) return
    
    const estimateData = {
      projectName: estimate.estimate.projectName,
      claimNumber: estimate.estimate.claimNumber,
      propertyAddress: estimate.estimate.propertyAddress,
      date: estimate.estimate.date,
      lineItems: estimate.estimate.lineItems,
      summary: estimate.estimate.summary,
      measurements: estimate.estimate.measurements,
      rooms: estimate.estimate.rooms,
    }
    
    const blob = new Blob([JSON.stringify(estimateData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PhotoXact-Estimate-${estimate.estimate.projectName || 'estimate'}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg shadow-red-500/20">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                PhotoXact
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                Upload a photo of damaged area. AI will create a complete construction estimate with Xactimate codes, quantities, prices, and full estimate structure.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 mb-8">
          {/* Project Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Name
              </label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="e.g., Smith Residence"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Claim Number (optional)
              </label>
              <input
                value={claimNumber}
                onChange={(e) => setClaimNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="Claim #"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Property Address (optional)
              </label>
              <input
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="123 Main St"
              />
            </div>
          </div>

          <FileUpload
            toolId="photoxact"
            onUploadComplete={handleUpload}
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] }}
            maxSize={10 * 1024 * 1024} // 10MB
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
            onClick={handleGenerate}
            disabled={!file || processing}
            className="mt-6 w-full py-3 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Estimate...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Complete Estimate
              </>
            )}
          </button>
        </div>

        {estimate && (
          <div className="space-y-6">
            {/* Estimate Header */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {estimate.estimate.projectName}
                  </h2>
                  {estimate.estimate.claimNumber && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Claim #: {estimate.estimate.claimNumber}
                    </p>
                  )}
                  {estimate.estimate.propertyAddress && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {estimate.estimate.propertyAddress}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Date: {estimate.estimate.date}
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Estimate
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Line Items</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {estimate.estimate.summary.totalLineItems}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Cost</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${estimate.estimate.summary.totalCost.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Rooms</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {estimate.estimate.rooms?.length || 0}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Object.keys(estimate.estimate.summary.byCategory || {}).length}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {estimate.warnings && estimate.warnings.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-xl">
                  <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Warnings:
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                    {estimate.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Photo and Estimate */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Photo Display */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Photo
                </h3>
                {estimate.imageUrl && (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img
                      src={estimate.imageUrl}
                      alt="Estimate photo"
                      className="w-full h-auto max-h-[600px] object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Estimate Details */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Estimate Summary
                </h3>
                
                {/* By Category */}
                {Object.keys(estimate.estimate.summary.byCategory || {}).length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      By Category
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(estimate.estimate.summary.byCategory || {}).map(([category, cost]) => (
                        <div key={category} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{category}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${(cost as number).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* By Room */}
                {Object.keys(estimate.estimate.summary.byRoom || {}).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      By Room
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(estimate.estimate.summary.byRoom || {}).map(([room, cost]) => (
                        <div key={room} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{room}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${(cost as number).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Line Items
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Code
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Description
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Qty
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Unit
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Unit Price
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Total
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Room
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.estimate.lineItems.map((item, idx) => (
                      <tr
                        key={`${item.code}-${idx}`}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="py-3 px-4">
                          <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                            {item.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                          {item.description}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-900 dark:text-white">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">
                          {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-900 dark:text-white">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          ${item.totalPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {item.room || '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                      <td colSpan={5} className="py-3 px-4 text-right text-gray-900 dark:text-white">
                        Total:
                      </td>
                      <td className="py-3 px-4 text-right text-lg text-red-600 dark:text-red-400">
                        ${estimate.estimate.summary.totalCost.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Measurements */}
            {estimate.estimate.measurements && estimate.estimate.measurements.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Measurements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {estimate.estimate.measurements.map((measurement, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {measurement.description}
                      </div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
                        {measurement.value} {measurement.unit}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {measurement.type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {estimate.notes && estimate.notes.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Notes</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {estimate.notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
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

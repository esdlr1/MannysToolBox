'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import { AlertCircle, Camera, Loader2, Image as ImageIcon, CheckCircle2, Search, Sparkles } from 'lucide-react'

interface LineItem {
  code: string
  description: string
  quantity: string
  location?: string
}

interface PhotoAnalysisResult {
  lineItems: LineItem[]
  summary: {
    totalItems: number
    rooms: string[]
  }
  notes: string[]
  imageUrl: string
  fileName: string
}

interface SearchResult {
  code: string
  description: string
  category: string
  unit: string
}

export default function WhatsXactPhotoTool() {
  const { data: session } = useSession()
  const [file, setFile] = useState<{ id: string; filename: string; originalName: string; url: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<PhotoAnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)

  // AI describe-what-you-need search (optional photo)
  const [describeQuery, setDescribeQuery] = useState('')
  const [smartResults, setSmartResults] = useState<SearchResult[]>([])
  const [smartSearching, setSmartSearching] = useState(false)
  const [showSmartResults, setShowSmartResults] = useState(false)

  const handleUpload = (uploadedFile: { id: string; filename: string; originalName: string; url: string }) => {
    setFile(uploadedFile)
    setError('')
    setResult(null)
    
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

  const handleSearch = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setSearching(true)
    setShowSearchResults(true)

    try {
      const response = await fetch('/api/tools/whats-xact-photo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    // Debounce search
    if (value.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSearch(value)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }

  const handleSmartSearch = async () => {
    const q = describeQuery.trim()
    if (!q) {
      setError('Please describe what you\'re looking for or what it\'s used for.')
      return
    }
    setSmartSearching(true)
    setError('')
    setShowSmartResults(true)
    try {
      const response = await fetch('/api/tools/whats-xact-photo/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          fileId: file?.id || undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Search failed')
      }
      const data = await response.json()
      setSmartResults(data.results || [])
    } catch (err: any) {
      setSmartResults([])
      setError(err.message || 'AI search failed')
    } finally {
      setSmartSearching(false)
    }
  }

  const handleAnalyze = async () => {
    if (!file || !session?.user?.id) {
      setError('Please upload a photo first.')
      return
    }

    setProcessing(true)
    setError('')
    setResult(null)

    try {
      logUsage(session.user.id, 'whats-xact-photo', 'analysis_started', {
        fileName: file.originalName,
      })

      const response = await fetch('/api/tools/whats-xact-photo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to analyze photo')
      }

      const data = await response.json()
      setResult(data)

      logUsage(session.user.id, 'whats-xact-photo', 'analysis_completed', {
        itemsFound: data.lineItems?.length || 0,
      })
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the photo')
    } finally {
      setProcessing(false)
    }
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
                Whats Xact - Photo
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                Describe what you need or upload a photo. AI will suggest Xactimate line items—adding a photo is optional but helps.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
          </div>
        )}

        {/* Describe what you're looking for — AI + optional photo */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Describe what you&apos;re looking for
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Tell us what you need or what it&apos;s used for—AI will suggest the right Xactimate line items. Adding a photo below is optional but helps AI give better results.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={describeQuery}
                onChange={(e) => { setDescribeQuery(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                placeholder="e.g. fix drywall hole in bedroom, paint living room, plumbing under sink..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600"
              />
            </div>
            <button
              type="button"
              onClick={handleSmartSearch}
              disabled={smartSearching || !describeQuery.trim()}
              className="py-3 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0"
            >
              {smartSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Finding...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Find line items
                </>
              )}
            </button>
          </div>

          {showSmartResults && (
            <div className="mt-4">
              {smartSearching ? null : smartResults.length > 0 ? (
                <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="p-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-red-500" />
                    AI suggested {smartResults.length} item{smartResults.length !== 1 ? 's' : ''}
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {smartResults.map((item, idx) => (
                      <div
                        key={`${item.code}-${idx}`}
                        className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => {
                          setDescribeQuery(`${item.code} - ${item.description}`)
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                {item.code}
                              </span>
                              {item.category && (
                                <span className="text-xs text-gray-500 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                                  {item.category}
                                </span>
                              )}
                              {item.unit && (
                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                  {item.unit}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {item.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg">
                  No matching items found. Try a different description or add a photo.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Optional photo upload — helps AI, not required */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Add a photo (optional)
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Adding a photo can help AI give better results. Not required.
          </p>
          <FileUpload
            toolId="whats-xact-photo"
            onUploadComplete={handleUpload}
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] }}
            maxSize={10 * 1024 * 1024}
          />
          {file && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Uploaded: <span className="font-medium">{file.originalName}</span>
            </div>
          )}
        </div>

        {/* Analyze Photo — when user has a photo and wants full image analysis */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Analyze photo for line items
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upload a photo above, then click below to have AI identify all visible line items in the image.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={!file || processing}
            className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Photo...
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                Analyze Photo
              </>
            )}
          </button>
        </div>

        {/* Xactimate Line Item Search — keyword search */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Xactimate Line Item Search
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Describe what you need and we'll help you find the right Xactimate code from our 13,000+ line item database.
          </p>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="e.g., 'drywall repair', 'plumbing sink', 'paint wall', 'MASKSF'..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Search Results */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="mt-4 max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="p-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                Found {searchResults.length} matching item{searchResults.length !== 1 ? 's' : ''}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {searchResults.map((item, idx) => (
                  <div
                    key={`${item.code}-${idx}`}
                    className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => {
                      setSearchQuery(`${item.code} - ${item.description}`)
                      setShowSearchResults(false)
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                            {item.code}
                          </span>
                          {item.category && (
                            <span className="text-xs text-gray-500 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {item.category}
                            </span>
                          )}
                          {item.unit && (
                            <span className="text-xs text-gray-500 dark:text-gray-500">
                              {item.unit}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showSearchResults && searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <div className="mt-4 p-4 text-center text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg">
              No matching items found. Try a different search term.
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Line Items Found</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.summary.totalItems}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Rooms/Locations</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.summary.rooms?.length || 0}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">Photo</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {result.fileName}
                </div>
              </div>
            </div>

            {/* Photo with Results */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Photo Display */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Photo
                </h2>
                {result.imageUrl && (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img
                      src={result.imageUrl}
                      alt="Analyzed photo"
                      className="w-full h-auto max-h-[600px] object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Line Items List */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Identified Line Items
                </h2>

                {result.lineItems.length === 0 ? (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>No line items identified in the photo.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {result.lineItems.map((item, idx) => (
                      <div
                        key={`${item.code}-${item.description}-${idx}`}
                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                                {item.code}
                              </span>
                              {item.location && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {item.location}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.description}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          <span className="font-semibold">Quantity:</span> {item.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {result.notes && result.notes.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Notes</h2>
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {result.notes.map((note, idx) => (
                    <li key={`note-${idx}`}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rooms/Locations */}
            {result.summary.rooms && result.summary.rooms.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Rooms/Locations Identified
                </h2>
                <div className="flex flex-wrap gap-2">
                  {result.summary.rooms.map((room, idx) => (
                    <span
                      key={`room-${idx}`}
                      className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-full text-sm font-medium"
                    >
                      {room}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

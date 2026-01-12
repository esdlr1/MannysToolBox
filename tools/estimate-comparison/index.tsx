'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import { ComparisonResult } from '@/types/estimate-comparison'
import { Upload, FileText, User, CheckCircle2, Loader2, AlertCircle, DollarSign, TrendingUp, FileCheck, Download, Save, Eye, Search, Filter, ArrowUpDown, X, Calendar, Clock, Info, FileBarChart, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

// Sample data for preview
const sampleComparisonResult: ComparisonResult = {
  missingItems: [
    {
      item: 'Roofing shingles - Architectural grade',
      quantity: 35,
      unitPrice: 45.50,
      totalPrice: 1592.50,
      category: 'Roofing',
      priority: 'critical'
    },
    {
      item: 'Gutter installation - 6 inch aluminum',
      quantity: 120,
      unitPrice: 12.75,
      totalPrice: 1530.00,
      category: 'Exterior',
      priority: 'critical'
    },
    {
      item: 'Interior paint - Primer coat',
      quantity: 8,
      unitPrice: 28.00,
      totalPrice: 224.00,
      category: 'Interior',
      priority: 'minor'
    },
    {
      item: 'Window screen replacement',
      quantity: 12,
      unitPrice: 35.00,
      totalPrice: 420.00,
      category: 'Windows',
      priority: 'minor'
    }
  ],
  discrepancies: [
    {
      item: 'Flooring - Hardwood installation',
      adjusterValue: '850 sq ft',
      contractorValue: '1,100 sq ft',
      difference: '+250 sq ft',
      differencePercent: 29.4,
      type: 'measurement',
      priority: 'critical'
    },
    {
      item: 'Drywall repair',
      adjusterValue: 450.00,
      contractorValue: 625.00,
      difference: '+$175.00',
      differencePercent: 38.9,
      type: 'price',
      priority: 'critical'
    },
    {
      item: 'Cabinet replacement',
      adjusterValue: '12 linear feet',
      contractorValue: '15 linear feet',
      difference: '+3 linear feet',
      differencePercent: 25.0,
      type: 'measurement',
      priority: 'minor'
    },
    {
      item: 'Plumbing fixtures',
      adjusterValue: 1250.00,
      contractorValue: 1350.00,
      difference: '+$100.00',
      differencePercent: 8.0,
      type: 'price',
      priority: 'minor'
    }
  ],
  summary: {
    totalCostDifference: 3767.50,
    missingItemsCount: 4,
    discrepanciesCount: 4,
    criticalIssues: 4,
    minorIssues: 4
  }
}

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
  
  // Filtering and sorting state
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'minor'>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'cost' | 'name'>('priority')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Pagination state
  const [discrepanciesPage, setDiscrepanciesPage] = useState(1)
  const [missingItemsPage, setMissingItemsPage] = useState(1)
  const itemsPerPage = 20
  
  // Room grouping and collapse state
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [groupByRoom, setGroupByRoom] = useState(true)

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

  const handlePreview = () => {
    setComparisonResult(sampleComparisonResult)
    setClientName('John Smith')
    setClaimNumber('CL-2024-01234')
    setStep(4)
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

  // Helper function to extract room from item name
  const extractRoom = (itemName: string): string => {
    // Common patterns: "Kitchen - Floor", "Kit - Floor", "Living Room - Paint", etc.
    // First try to match "Room - Item" pattern
    const dashMatch = itemName.match(/^([^-]+?)\s*-\s*/i)
    if (dashMatch) {
      const room = dashMatch[1].trim()
      // Normalize common abbreviations
      const normalized = room.toLowerCase()
      if (normalized.includes('kit') && !normalized.includes('bath')) return 'Kitchen'
      if (normalized.includes('living') || normalized === 'lr') return 'Living Room'
      if ((normalized.includes('bedroom') || normalized === 'br') && !normalized.includes('bath')) return 'Bedroom'
      if (normalized.includes('bath')) return 'Bathroom'
      if (normalized.includes('dining') || normalized === 'dr') return 'Dining Room'
      if (normalized.includes('master')) return 'Master Bedroom'
      if (normalized.includes('garage')) return 'Garage'
      if (normalized.includes('basement')) return 'Basement'
      if (normalized.includes('attic')) return 'Attic'
      if (normalized.includes('hall')) return 'Hallway'
      if (normalized.includes('office')) return 'Office'
      return room
    }
    
    // Try to match common room names at the start
    const roomMatch = itemName.match(/^(Kitchen|Kit|K|Living Room|LR|Bedroom|BR|Bathroom|Bath|Master Bedroom|Master BR|Dining Room|DR|Office|Garage|Basement|Attic|Hallway|Hall)\b/i)
    if (roomMatch) {
      const room = roomMatch[1].trim()
      const normalized = room.toLowerCase()
      if (normalized.includes('kit') || normalized === 'k') return 'Kitchen'
      if (normalized.includes('living') || normalized === 'lr') return 'Living Room'
      if (normalized.includes('bedroom') || normalized === 'br') return 'Bedroom'
      if (normalized.includes('bath')) return 'Bathroom'
      if (normalized.includes('dining') || normalized === 'dr') return 'Dining Room'
      if (normalized.includes('master')) return 'Master Bedroom'
      if (normalized.includes('garage')) return 'Garage'
      if (normalized.includes('basement')) return 'Basement'
      if (normalized.includes('attic')) return 'Attic'
      if (normalized.includes('hall')) return 'Hallway'
      if (normalized.includes('office')) return 'Office'
      return room
    }
    
    return 'General'
  }

  // Toggle room expansion
  const toggleRoom = (room: string) => {
    setExpandedRooms(prev => {
      const newSet = new Set(prev)
      if (newSet.has(room)) {
        newSet.delete(room)
      } else {
        newSet.add(room)
      }
      return newSet
    })
  }

  // Expand all rooms by default on initial load
  useEffect(() => {
    if (comparisonResult && groupByRoom) {
      const rooms = new Set<string>()
      comparisonResult.discrepancies.forEach(disc => {
        rooms.add(extractRoom(disc.item))
      })
      setExpandedRooms(rooms)
    }
  }, [comparisonResult, groupByRoom])

  // Reset pagination when filters change
  useEffect(() => {
    setMissingItemsPage(1)
    setDiscrepanciesPage(1)
  }, [searchQuery, priorityFilter, sortBy, sortOrder])

  // Filter and sort missing items
  const filteredAndSortedMissingItems = useMemo(() => {
    if (!comparisonResult) return []
    
    let items = [...comparisonResult.missingItems]
    
    // Filter by search query
    if (searchQuery) {
      items = items.filter(item => 
        item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Filter by priority
    if (priorityFilter !== 'all') {
      items = items.filter(item => item.priority === priorityFilter)
    }
    
    // Sort
    items.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { critical: 2, minor: 1 }
        const diff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
        return sortOrder === 'desc' ? diff : -diff
      } else if (sortBy === 'cost') {
        const diff = b.totalPrice - a.totalPrice
        return sortOrder === 'desc' ? diff : -diff
      } else {
        const diff = a.item.localeCompare(b.item)
        return sortOrder === 'desc' ? -diff : diff
      }
    })
    
    return items
  }, [comparisonResult, searchQuery, priorityFilter, sortBy, sortOrder])

  // Filter and sort discrepancies
  const filteredAndSortedDiscrepancies = useMemo(() => {
    if (!comparisonResult) return []
    
    let items = [...comparisonResult.discrepancies]
    
    // Filter by search query
    if (searchQuery) {
      items = items.filter(item => 
        item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Filter by priority
    if (priorityFilter !== 'all') {
      items = items.filter(item => item.priority === priorityFilter)
    }
    
    // Sort
    items.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { critical: 2, minor: 1 }
        const diff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
        return sortOrder === 'desc' ? diff : -diff
      } else if (sortBy === 'cost') {
        const aDiff = typeof a.differencePercent === 'number' ? Math.abs(a.differencePercent) : 0
        const bDiff = typeof b.differencePercent === 'number' ? Math.abs(b.differencePercent) : 0
        const diff = bDiff - aDiff
        return sortOrder === 'desc' ? diff : -diff
      } else {
        const diff = a.item.localeCompare(b.item)
        return sortOrder === 'desc' ? -diff : diff
      }
    })
    
    return items
  }, [comparisonResult, searchQuery, priorityFilter, sortBy, sortOrder])

  // Group discrepancies by room
  const groupedDiscrepancies = useMemo(() => {
    if (!groupByRoom || !filteredAndSortedDiscrepancies.length) {
      return { 'All Items': filteredAndSortedDiscrepancies }
    }
    
    const groups: Record<string, typeof filteredAndSortedDiscrepancies> = {}
    filteredAndSortedDiscrepancies.forEach(item => {
      const room = extractRoom(item.item)
      if (!groups[room]) {
        groups[room] = []
      }
      groups[room].push(item)
    })
    
    // Sort rooms by name, but put "General" last
    const sortedRooms = Object.keys(groups).sort((a, b) => {
      if (a === 'General') return 1
      if (b === 'General') return -1
      return a.localeCompare(b)
    })
    
    const sortedGroups: Record<string, typeof filteredAndSortedDiscrepancies> = {}
    sortedRooms.forEach(room => {
      sortedGroups[room] = groups[room]
    })
    
    return sortedGroups
  }, [filteredAndSortedDiscrepancies, groupByRoom])

  // Paginated discrepancies
  const paginatedDiscrepancies = useMemo(() => {
    if (!groupByRoom) {
      const start = (discrepanciesPage - 1) * itemsPerPage
      const end = start + itemsPerPage
      return {
        paginatedItems: filteredAndSortedDiscrepancies.slice(start, end),
        totalPages: Math.ceil(filteredAndSortedDiscrepancies.length / itemsPerPage)
      }
    }
    // When grouped, pagination is per room (all items in expanded rooms are shown)
    return {
      paginatedItems: filteredAndSortedDiscrepancies,
      totalPages: 1
    }
  }, [filteredAndSortedDiscrepancies, discrepanciesPage, itemsPerPage, groupByRoom])

  // Paginated missing items
  const paginatedMissingItems = useMemo(() => {
    const start = (missingItemsPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return {
      paginatedItems: filteredAndSortedMissingItems.slice(start, end),
      totalPages: Math.ceil(filteredAndSortedMissingItems.length / itemsPerPage)
    }
  }, [filteredAndSortedMissingItems, missingItemsPage, itemsPerPage])

  // Calculate totals and revenue opportunities
  const missingItemsTotal = useMemo(() => {
    return filteredAndSortedMissingItems.reduce((sum, item) => sum + item.totalPrice, 0)
  }, [filteredAndSortedMissingItems])

  // Calculate total revenue opportunity (missing items + positive discrepancies)
  const totalRevenueOpportunity = useMemo(() => {
    if (!comparisonResult) return 0
    const missingItemsValue = comparisonResult.missingItems.reduce((sum, item) => sum + item.totalPrice, 0)
    // Note: totalCostDifference already includes missing items, so this is the total opportunity
    return comparisonResult.summary.totalCostDifference
  }, [comparisonResult])

  // Calculate total value of missing items (revenue opportunity) - used in executive summary
  const missingItemsTotalValue = useMemo(() => {
    if (!comparisonResult) return 0
    return comparisonResult.missingItems.reduce((sum, item) => sum + item.totalPrice, 0)
  }, [comparisonResult])

  const steps = [
    { number: 1, label: 'Upload Files', icon: Upload },
    { number: 2, label: 'Client Info', icon: User },
    { number: 3, label: 'Processing', icon: Loader2 },
    { number: 4, label: 'Results', icon: CheckCircle2 },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Progress Steps - Premium Design */}
        <div className="mb-12">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {steps.map((s, index) => {
              const Icon = s.icon
              const isActive = step >= s.number
              const isCurrent = step === s.number
              
              return (
                <div key={s.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? isCurrent
                            ? 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-lg shadow-red-500/50 scale-110'
                            : 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md'
                          : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-400'
                      }`}
                    >
                      {isCurrent && step === 3 ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Icon className={`w-6 h-6 ${isActive ? 'text-white' : ''}`} />
                      )}
                      {isActive && !isCurrent && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <span
                      className={`mt-3 text-xs font-medium transition-colors ${
                        isActive
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${
                        step > s.number
                          ? 'bg-gradient-to-r from-red-500 to-red-600'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          {/* Step 1: File Upload */}
          {step === 1 && (
            <div className="p-8 lg:p-12">
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  Upload Estimates
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Upload both estimate files to begin the comparison process
                </p>
              </div>
              
              <div className="grid lg:grid-cols-2 gap-8 mb-8">
                {/* Adjuster's Estimate */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Adjuster's Estimate
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        PDF, Xactimate, or Symbility format
                      </p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl p-1 border border-gray-200 dark:border-gray-700">
                    <FileUpload
                      toolId="estimate-comparison"
                      onUploadComplete={handleAdjusterUpload}
                      accept={{
                        'application/pdf': ['.pdf'],
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                      }}
                    />
                  </div>
                  {adjusterFile && (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-green-900 dark:text-green-300 truncate">
                        {adjusterFile.originalName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Contractor's Estimate */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Contractor's Estimate
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Xactimate PDF format
                      </p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl p-1 border border-gray-200 dark:border-gray-700">
                    <FileUpload
                      toolId="estimate-comparison"
                      onUploadComplete={handleContractorUpload}
                      accept={{
                        'application/pdf': ['.pdf'],
                      }}
                    />
                  </div>
                  {contractorFile && (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-green-900 dark:text-green-300 truncate">
                        {contractorFile.originalName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handlePreview}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview Results
                </button>
                <button
                  onClick={handleNext}
                  disabled={!adjusterFile || !contractorFile}
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl shadow-lg shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  Continue
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Client Information */}
          {step === 2 && (
            <div className="p-8 lg:p-12">
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  Client Information
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Provide the client details for this comparison
                </p>
              </div>

              <div className="max-w-2xl space-y-6 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Enter client name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Claim Number *
                  </label>
                  <input
                    type="text"
                    value={claimNumber}
                    onChange={(e) => setClaimNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Enter claim number"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!clientName || !claimNumber}
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl shadow-lg shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  Process Comparison
                  <Loader2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 3 && (
            <div className="p-16 lg:p-24 text-center">
              <div className="mb-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  Processing Comparison
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                  AI is analyzing and comparing your estimates
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  This may take a few moments
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}

          {/* Step 4: Results - Executive Summary Style */}
          {step === 4 && comparisonResult && (
            <div className="bg-white dark:bg-gray-900 min-h-screen">
              <div className="max-w-7xl mx-auto px-6 py-8 lg:px-12 lg:py-12">
                {/* Professional Report Header */}
                <div className="border-b-2 border-gray-200 dark:border-gray-700 pb-6 mb-8">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
                          <FileBarChart className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Estimate Comparison Report
                          </h1>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Professional Analysis Report
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Client</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{clientName}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Claim Number</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{claimNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Report Date</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{format(new Date(), 'MMMM dd, yyyy')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap border border-gray-200 dark:border-gray-700"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" />
                        Export PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Important Note - Room/Sketch Variations */}
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Important: Room Name & Sketch Variations</p>
                      <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                        Room names may vary between estimates (e.g., "Kitchen" vs "Kit" vs "K"). Sketch layouts may also differ slightly. 
                        The comparison focuses on matching items by description and code rather than exact room names. 
                        Items are matched intelligently across different room naming conventions.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Executive Summary Section */}
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-red-600 to-red-700 rounded-full"></div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Summary</h2>
                  </div>
                  
                  {/* Key Finding - Total Revenue Opportunity */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg p-8 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Total Revenue Opportunity</p>
                        <p className="text-5xl font-bold text-gray-900 dark:text-white mb-3">
                          ${Math.abs(totalRevenueOpportunity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl">
                          Items identified in the contractor's estimate that differ from the adjuster's estimate. 
                          This represents the total value of items requiring negotiation or addition to the adjuster's estimate.
                        </p>
                      </div>
                      <div className="hidden lg:block ml-8">
                        <div className="w-24 h-24 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center shadow-lg">
                          <TrendingUp className="w-12 h-12 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Missing Items Value</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        ${missingItemsTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        {comparisonResult.summary.missingItemsCount} items not in adjuster estimate
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Missing Items Count</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        {comparisonResult.summary.missingItemsCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        Items to add to adjuster estimate
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Discrepancies</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        {comparisonResult.summary.discrepanciesCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        Items with pricing differences
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Critical Issues</p>
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
                        {comparisonResult.summary.criticalIssues}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        High-priority items requiring attention
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Findings Section */}
                <div className="mt-12 space-y-8">
                  {/* Missing Items Section */}
              {comparisonResult.missingItems.length > 0 && (
                <div className="bg-white dark:bg-gray-800/50 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-6 mb-8 shadow-lg">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                        <FileText className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                        Missing Items - Revenue Opportunity
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
                        These items are in your estimate but NOT in the adjuster's estimate. Focus on getting these added!
                      </p>
                      <div className="flex items-center gap-4 mt-2 ml-9">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Showing: {filteredAndSortedMissingItems.length} of {comparisonResult.missingItems.length}
                        </span>
                      </div>
                    </div>
                    {missingItemsTotal > 0 && (
                      <div className="text-right bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Filtered Total Value</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ${missingItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </div>

                        {/* Filter and Sort Controls */}
                        <div className="mb-6 flex flex-wrap gap-4 items-center">
                          {/* Search */}
                          <div className="flex-1 min-w-[250px] relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search items..."
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400"
                            />
                            {searchQuery && (
                              <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Priority Filter */}
                          <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                              value={priorityFilter}
                              onChange={(e) => setPriorityFilter(e.target.value as 'all' | 'critical' | 'minor')}
                              className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="all">All Priorities</option>
                              <option value="critical">Critical Only</option>
                              <option value="minor">Minor Only</option>
                            </select>
                          </div>

                          {/* Sort */}
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as 'priority' | 'cost' | 'name')}
                              className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="priority">Sort by Priority</option>
                              <option value="cost">Sort by Cost</option>
                              <option value="name">Sort by Name</option>
                            </select>
                            <button
                              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                              className="px-3 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-600"
                            >
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Item Description</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total Price</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Priority</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                              {paginatedMissingItems.paginatedItems.length > 0 ? (
                                paginatedMissingItems.paginatedItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{item.item}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.quantity}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${item.unitPrice.toFixed(2)}</td>
                                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">${item.totalPrice.toFixed(2)}</td>
                                  <td className="px-6 py-4">
                                    <span
                                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                        item.priority === 'critical'
                                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                      }`}
                                    >
                                      {item.priority}
                                    </span>
                                  </td>
                                </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    No items match your filters
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Controls for Missing Items */}
                        {paginatedMissingItems.totalPages > 1 && (
                          <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              Showing {(missingItemsPage - 1) * itemsPerPage + 1} to {Math.min(missingItemsPage * itemsPerPage, filteredAndSortedMissingItems.length)} of {filteredAndSortedMissingItems.length} items
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setMissingItemsPage(prev => Math.max(1, prev - 1))}
                                disabled={missingItemsPage === 1}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                              </button>
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                Page {missingItemsPage} of {paginatedMissingItems.totalPages}
                              </div>
                              <button
                                onClick={() => setMissingItemsPage(prev => Math.min(paginatedMissingItems.totalPages, prev + 1))}
                                disabled={missingItemsPage === paginatedMissingItems.totalPages}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              >
                                Next
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

              {/* Discrepancies - Pricing Differences */}
              {comparisonResult.discrepancies.length > 0 && (
                <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                        <AlertCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        Discrepancies - Pricing Differences
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                        Items where your estimate differs from the adjuster's estimate
                      </p>
                      <div className="flex items-center gap-4 mt-2 ml-8">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Showing: {filteredAndSortedDiscrepancies.length} of {comparisonResult.discrepancies.length}
                        </span>
                      </div>
                    </div>
                  </div>

                        {/* Filter and Sort Controls */}
                        <div className="mb-6 flex flex-wrap gap-4 items-center">
                          {/* Search */}
                          <div className="flex-1 min-w-[250px] relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search discrepancies..."
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400"
                            />
                            {searchQuery && (
                              <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Priority Filter */}
                          <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                              value={priorityFilter}
                              onChange={(e) => setPriorityFilter(e.target.value as 'all' | 'critical' | 'minor')}
                              className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              <option value="all">All Priorities</option>
                              <option value="critical">Critical Only</option>
                              <option value="minor">Minor Only</option>
                            </select>
                          </div>

                          {/* Sort */}
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as 'priority' | 'cost' | 'name')}
                              className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              <option value="priority">Sort by Priority</option>
                              <option value="cost">Sort by Difference</option>
                              <option value="name">Sort by Name</option>
                            </select>
                            <button
                              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                              className="px-3 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-600"
                            >
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </button>
                          </div>

                          {/* Group by Room Toggle */}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="groupByRoom"
                              checked={groupByRoom}
                              onChange={(e) => {
                                setGroupByRoom(e.target.checked)
                                setDiscrepanciesPage(1)
                              }}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <label htmlFor="groupByRoom" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                              Group by Room
                            </label>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {filteredAndSortedDiscrepancies.length > 0 ? (
                            groupByRoom ? (
                              // Grouped by room with collapsible sections
                              Object.entries(groupedDiscrepancies).map(([room, items]) => {
                                const isExpanded = expandedRooms.has(room)
                                const criticalCount = items.filter(item => item.priority === 'critical').length
                                return (
                                  <div key={room} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    {/* Room Header - Collapsible */}
                                    <button
                                      onClick={() => toggleRoom(room)}
                                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-3">
                                        {isExpanded ? (
                                          <ChevronUp className="w-5 h-5 text-gray-500" />
                                        ) : (
                                          <ChevronDown className="w-5 h-5 text-gray-500" />
                                        )}
                                        <h4 className="font-semibold text-gray-900 dark:text-white text-lg">{room}</h4>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                          ({items.length} item{items.length !== 1 ? 's' : ''}
                                          {criticalCount > 0 && `, ${criticalCount} critical`})
                                        </span>
                                      </div>
                                    </button>
                                    
                                    {/* Room Items - Collapsible Content */}
                                    {isExpanded && (
                                      <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
                                        {items.map((disc, idx) => (
                                          <div
                                            key={idx}
                                            className={`p-5 rounded-lg border transition-all ${
                                              disc.priority === 'critical'
                                                ? 'border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10'
                                                : 'border-yellow-300 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-900/10'
                                            }`}
                                          >
                                            <div className="flex justify-between items-start mb-4">
                                              <h5 className="font-semibold text-gray-900 dark:text-white text-base">{disc.item}</h5>
                                              <span
                                                className={`inline-flex px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${
                                                  disc.priority === 'critical'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                }`}
                                              >
                                                {disc.priority}
                                              </span>
                                            </div>
                                            <div className="grid md:grid-cols-3 gap-4">
                                              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Adjuster Value</p>
                                                <p className="font-semibold text-gray-900 dark:text-white text-base">{disc.adjusterValue}</p>
                                              </div>
                                              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Contractor Value</p>
                                                <p className="font-semibold text-gray-900 dark:text-white text-base">{disc.contractorValue}</p>
                                              </div>
                                              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Difference</p>
                                                <p className="font-bold text-red-600 dark:text-red-400 text-base">
                                                  {disc.difference} ({disc.differencePercent > 0 ? '+' : ''}{disc.differencePercent.toFixed(1)}%)
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            ) : (
                              // Flat list with pagination
                              paginatedDiscrepancies.paginatedItems.map((disc, idx) => (
                                <div
                                  key={idx}
                                  className={`p-6 rounded-lg border transition-all ${
                                    disc.priority === 'critical'
                                      ? 'border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10'
                                      : 'border-yellow-300 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-900/10'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-base">{disc.item}</h4>
                                    <span
                                      className={`inline-flex px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${
                                        disc.priority === 'critical'
                                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                      }`}
                                    >
                                      {disc.priority}
                                    </span>
                                  </div>
                                  <div className="grid md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Adjuster Value</p>
                                      <p className="font-semibold text-gray-900 dark:text-white text-base">{disc.adjusterValue}</p>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Contractor Value</p>
                                      <p className="font-semibold text-gray-900 dark:text-white text-base">{disc.contractorValue}</p>
                                    </div>
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                      <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Difference</p>
                                      <p className="font-bold text-red-600 dark:text-red-400 text-base">
                                        {disc.difference} ({disc.differencePercent > 0 ? '+' : ''}{disc.differencePercent.toFixed(1)}%)
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )
                          ) : (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                              No discrepancies match your filters
                            </div>
                          )}
                        </div>

                        {/* Pagination Controls for Discrepancies (only when not grouped) */}
                        {!groupByRoom && paginatedDiscrepancies.totalPages > 1 && (
                          <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              Showing {(discrepanciesPage - 1) * itemsPerPage + 1} to {Math.min(discrepanciesPage * itemsPerPage, filteredAndSortedDiscrepancies.length)} of {filteredAndSortedDiscrepancies.length} items
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDiscrepanciesPage(prev => Math.max(1, prev - 1))}
                                disabled={discrepanciesPage === 1}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                              </button>
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                Page {discrepanciesPage} of {paginatedDiscrepancies.totalPages}
                              </div>
                              <button
                                onClick={() => setDiscrepanciesPage(prev => Math.min(paginatedDiscrepancies.totalPages, prev + 1))}
                                disabled={discrepanciesPage === paginatedDiscrepancies.totalPages}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              >
                                Next
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Notes Section */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-1 h-10 bg-gray-600 rounded-full"></div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            Notes & Comments
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Additional notes or comments about this comparison
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={5}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                        placeholder="Add any notes or comments about this comparison..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

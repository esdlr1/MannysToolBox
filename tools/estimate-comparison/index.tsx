'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { FileUpload } from '@/components/FileUpload'
import { logUsage } from '@/lib/utils'
import { ComparisonResult } from '@/types/estimate-comparison'
import { Upload, FileText, User, CheckCircle2, Loader2, AlertCircle, DollarSign, TrendingUp, FileCheck, Download, Save, Eye, Search, Filter, ArrowUpDown, X, Calendar, Clock, Info, FileBarChart, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MessageSquare, Copy, Check, BarChart3, PieChart, TrendingDown, Layers, Tag, MapPin, DollarSign as DollarIcon, Zap, History, BookOpen, Lightbulb, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { FeedbackModal } from '@/components/estimate-comparison/FeedbackModal'

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
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStage, setProcessingStage] = useState('')
  
  // Filtering and sorting state
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'minor'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priceRangeFilter, setPriceRangeFilter] = useState<{ min: number; max: number }>({ min: 0, max: Infinity })
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [codeSearch, setCodeSearch] = useState('')
  const [sortBy, setSortBy] = useState<'priority' | 'cost' | 'name' | 'code'>('priority')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Batch operations state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectAllMode, setSelectAllMode] = useState(false)
  
  // Manual matching state
  const [manualMatches, setManualMatches] = useState<Map<string, string>>(new Map()) // contractor item -> adjuster item
  const [manualUnmatches, setManualUnmatches] = useState<Set<string>>(new Set()) // item IDs to unmatch
  
  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'side-by-side' | 'charts'>('list')
  
  // Copy to clipboard state
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  
  // Pagination state
  const [discrepanciesPage, setDiscrepanciesPage] = useState(1)
  const [missingItemsPage, setMissingItemsPage] = useState(1)
  const itemsPerPage = 20
  
  // Room grouping and collapse state
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [groupByRoom, setGroupByRoom] = useState(true)
  
  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackItemType, setFeedbackItemType] = useState<'missing_item' | 'discrepancy' | 'overall'>('missing_item')
  const [feedbackItemIndex, setFeedbackItemIndex] = useState<number | undefined>()
  const [feedbackItemDescription, setFeedbackItemDescription] = useState<string | undefined>()

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
    setProcessingProgress(0)
    setProcessingStage('Initializing...')

    try {
      // Log usage
      logUsage(session.user.id, 'estimate-comparison', 'comparison_started', {
        clientName,
        claimNumber,
      })

      console.log('[Estimate Comparison] Starting comparison...', {
        adjusterFileId: adjusterFile.id,
        contractorFileId: contractorFile.id,
      })

      setProcessingProgress(10)
      setProcessingStage('Parsing adjuster estimate...')

      // Simulate progress updates (actual progress would come from server-sent events in production)
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
      }, 2000)

      // Call API to process comparison with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minute timeout

      setProcessingStage('Parsing contractor estimate...')
      setProcessingProgress(30)

      const response = await fetch('/api/tools/estimate-comparison/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjusterFileId: adjusterFile.id,
          contractorFileId: contractorFile.id,
          clientName,
          claimNumber,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      clearInterval(progressInterval)

      setProcessingProgress(70)
      setProcessingStage('Analyzing differences...')

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Estimate Comparison] API error:', data)
        throw new Error(data.error || `Failed to process comparison (${response.status})`)
      }

      setProcessingProgress(85)
      setProcessingStage('Finalizing results...')

      const result = await response.json()
      console.log('[Estimate Comparison] Comparison completed:', {
        missingItems: result.missingItems?.length || 0,
        discrepancies: result.discrepancies?.length || 0,
      })

      setProcessingProgress(100)
      setProcessingStage('Complete!')

      setTimeout(() => {
        setComparisonResult(result)
        setStep(4)
        setProcessingProgress(0)
        setProcessingStage('')
      }, 500)

      // Log successful comparison
      logUsage(session.user.id, 'estimate-comparison', 'comparison_completed', {
        clientName,
        claimNumber,
        discrepanciesCount: result.summary?.discrepanciesCount || 0,
      })
    } catch (err: any) {
      console.error('[Estimate Comparison] Error:', err)
      setProcessingProgress(0)
      setProcessingStage('')
      if (err.name === 'AbortError') {
        setError('Comparison timed out. The estimates may be too large. Please try with smaller files or contact support.')
      } else {
        setError(err.message || 'An error occurred while processing the comparison. Please check the console for details.')
      }
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

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItem(itemId)
      setTimeout(() => setCopiedItem(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Get unique categories from items
  const getUniqueCategories = useMemo(() => {
    if (!comparisonResult) return []
    const categories = new Set<string>()
    
    // Helper function to get Xactimate category (defined inside useMemo to avoid dependency issues)
    const getXactCategory = (code?: string) => {
      if (!code) return null
      try {
        if (typeof window !== 'undefined') {
          const xactimateLookup = require('@/lib/xactimate-lookup')
          return xactimateLookup.findByCode(code)?.category
        }
        return null
      } catch {
        return null
      }
    }
    
    comparisonResult.missingItems?.forEach(item => {
      if (item.category) categories.add(item.category)
      // Also try to get category from Xactimate if code exists
      if (item.code) {
        const xactCategory = getXactCategory(item.code)
        if (xactCategory) categories.add(xactCategory)
      }
    })
    comparisonResult.adjusterOnlyItems?.forEach(item => {
      if (item.category) categories.add(item.category)
      if (item.code) {
        const xactCategory = getXactCategory(item.code)
        if (xactCategory) categories.add(xactCategory)
      }
    })
    comparisonResult.discrepancies?.forEach(item => {
      if (item.code) {
        const xactCategory = getXactCategory(item.code)
        if (xactCategory) categories.add(xactCategory)
      }
    })
    return Array.from(categories).sort()
  }, [comparisonResult])

  // Helper function to extract room from item name (function declaration for hoisting)
  function extractRoom(itemName: string): string {
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

  // Get unique rooms from items
  const getUniqueRooms = useMemo(() => {
    if (!comparisonResult) return []
    const rooms = new Set<string>()
    comparisonResult.missingItems?.forEach(item => {
      const room = item.room || extractRoom(item.item)
      rooms.add(room)
    })
    comparisonResult.adjusterOnlyItems?.forEach(item => {
      const room = item.room || extractRoom(item.item)
      rooms.add(room)
    })
    comparisonResult.discrepancies?.forEach(item => {
      rooms.add(extractRoom(item.item))
    })
    return Array.from(rooms).sort()
  }, [comparisonResult])

  // Batch selection helpers
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const selectAllItems = () => {
    if (!comparisonResult) return
    const allIds = new Set<string>()
    comparisonResult.missingItems?.forEach((item, idx) => {
      allIds.add(`missing-${idx}`)
    })
    comparisonResult.adjusterOnlyItems?.forEach((item, idx) => {
      allIds.add(`adjuster-${idx}`)
    })
    comparisonResult.discrepancies?.forEach((item, idx) => {
      allIds.add(`discrepancy-${idx}`)
    })
    setSelectedItems(allIds)
    setSelectAllMode(true)
  }

  const clearSelection = () => {
    setSelectedItems(new Set())
    setSelectAllMode(false)
  }

  // Export selected items
  const exportSelectedItems = async (format: 'csv' | 'excel' | 'pdf') => {
    if (selectedItems.size === 0) {
      alert('Please select items to export')
      return
    }
    
    const selectedData: any[] = []
    comparisonResult?.missingItems?.forEach((item, idx) => {
      if (selectedItems.has(`missing-${idx}`)) {
        const { type: _, ...itemWithoutType } = item as any
        selectedData.push({ itemType: 'missing', ...itemWithoutType })
      }
    })
    comparisonResult?.adjusterOnlyItems?.forEach((item, idx) => {
      if (selectedItems.has(`adjuster-${idx}`)) {
        const { type: _, ...itemWithoutType } = item as any
        selectedData.push({ itemType: 'adjuster_only', ...itemWithoutType })
      }
    })
    comparisonResult?.discrepancies?.forEach((item, idx) => {
      if (selectedItems.has(`discrepancy-${idx}`)) {
        const { type: itemTypeField, ...itemWithoutType } = item as any
        selectedData.push({ itemType: 'discrepancy', discrepancyType: itemTypeField, ...itemWithoutType })
      }
    })

    if (format === 'csv') {
      const headers = ['Type', 'Item', 'Code', 'Quantity', 'Unit Price', 'Total Price', 'Priority', 'Category', 'Discrepancy Type']
      const rows = selectedData.map(item => [
        item.itemType,
        item.item,
        item.code || '',
        item.quantity || '',
        item.unitPrice || '',
        item.totalPrice || '',
        item.priority || '',
        item.category || '',
        item.discrepancyType || ''
      ])
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Selected_Items_${clientName}_${claimNumber}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } else if (format === 'pdf') {
      // Use existing PDF export but with selected items only
      handleExportPDF()
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

  // Filter and sort missing items with enhanced filters
  const filteredAndSortedMissingItems = useMemo(() => {
    if (!comparisonResult) return []
    
    let items = [...comparisonResult.missingItems]
    
    // Filter by search query
    if (searchQuery) {
      items = items.filter(item => 
        item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Filter by Xactimate code search
    if (codeSearch) {
      items = items.filter(item => 
        item.code?.toUpperCase().includes(codeSearch.toUpperCase())
      )
    }
    
    // Filter by category
    if (categoryFilter !== 'all') {
      items = items.filter(item => item.category === categoryFilter)
    }
    
    // Filter by room
    if (roomFilter !== 'all') {
      items = items.filter(item => {
        const room = item.room || extractRoom(item.item)
        return room === roomFilter
      })
    }
    
    // Filter by price range
    items = items.filter(item => 
      item.totalPrice >= priceRangeFilter.min && 
      item.totalPrice <= priceRangeFilter.max
    )
    
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
      } else if (sortBy === 'code') {
        const aCode = a.code || ''
        const bCode = b.code || ''
        const diff = aCode.localeCompare(bCode)
        return sortOrder === 'desc' ? -diff : diff
      } else {
        const diff = a.item.localeCompare(b.item)
        return sortOrder === 'desc' ? -diff : diff
      }
    })
    
    return items
  }, [comparisonResult, searchQuery, codeSearch, categoryFilter, roomFilter, priceRangeFilter, priorityFilter, sortBy, sortOrder])

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

          {/* Step 3: Processing with Progress */}
          {step === 3 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                <div className="text-center mb-8">
                  <Loader2 className="w-16 h-16 text-red-600 dark:text-red-400 animate-spin mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Processing Comparison
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {processingStage || 'Analyzing your estimates...'}
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Progress
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {processingProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-600 to-red-700 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                </div>

                {/* Processing Steps */}
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    processingProgress >= 10 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      processingProgress >= 10 ? 'bg-green-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                    }`}>
                      {processingProgress >= 10 ? <Check className="w-4 h-4" /> : <span className="text-xs">1</span>}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Parsing adjuster estimate</span>
                  </div>
                  <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    processingProgress >= 30 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      processingProgress >= 30 ? 'bg-green-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                    }`}>
                      {processingProgress >= 30 ? <Check className="w-4 h-4" /> : <span className="text-xs">2</span>}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Parsing contractor estimate</span>
                  </div>
                  <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    processingProgress >= 70 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      processingProgress >= 70 ? 'bg-green-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                    }`}>
                      {processingProgress >= 70 ? <Check className="w-4 h-4" /> : <span className="text-xs">3</span>}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Analyzing differences with AI</span>
                  </div>
                  <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    processingProgress >= 85 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      processingProgress >= 85 ? 'bg-green-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                    }`}>
                      {processingProgress >= 85 ? <Check className="w-4 h-4" /> : <span className="text-xs">4</span>}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Finalizing results</span>
                  </div>
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Processing (Old - keeping for fallback) */}
          {step === 3 && !processingProgress && (
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
                      
                      {/* View Mode Switcher */}
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                              viewMode === 'list'
                                ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            List
                          </button>
                          <button
                            onClick={() => setViewMode('side-by-side')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                              viewMode === 'side-by-side'
                                ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                            Side-by-Side
                          </button>
                          <button
                            onClick={() => setViewMode('charts')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                              viewMode === 'charts'
                                ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                          >
                            <BarChart3 className="w-4 h-4" />
                            Charts
                          </button>
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
                    
                    <div className="flex gap-3 flex-wrap">
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
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/tools/estimate-comparison/export-excel', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                clientName,
                                claimNumber,
                                comparisonResult,
                                notes,
                              }),
                            })
                            if (response.ok) {
                              const blob = await response.blob()
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `Estimate_Comparison_${clientName}_${claimNumber}.xlsx`
                              a.click()
                              window.URL.revokeObjectURL(url)
                            }
                          } catch (err) {
                            console.error('Excel export error:', err)
                            alert('Failed to export Excel')
                          }
                        }}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <FileBarChart className="w-4 h-4" />
                        Export Excel
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

                {/* Matched Items Section - Show what was successfully matched */}
                {comparisonResult.matchedItems && comparisonResult.matchedItems.length > 0 && (
                  <div className="mb-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Successfully Matched Items ({comparisonResult.matchedItems.length})
                      </h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      These items were found in both estimates (they match, just worded differently):
                    </p>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {comparisonResult.matchedItems.slice(0, 20).map((match, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3 border border-green-200 dark:border-green-700">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 text-sm">
                              <div className="font-medium text-gray-900 dark:text-white mb-1">
                                Contractor: {match.contractorItem}
                              </div>
                              <div className="text-gray-600 dark:text-gray-400">
                                Adjuster: {match.adjusterItem}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                Match: {match.matchReason.replace('_', ' ')} ({Math.round(match.confidence * 100)}% confidence)
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {comparisonResult.matchedItems.length > 20 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                          ... and {comparisonResult.matchedItems.length - 20} more matched items
                        </p>
                      )}
                    </div>
                  </div>
                )}

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
                  {/* Items ONLY in Contractor Estimate (Missing from Adjuster) */}
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

                          {/* Xactimate Code Search */}
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={codeSearch}
                              onChange={(e) => setCodeSearch(e.target.value)}
                              placeholder="Search by code..."
                              className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
                            />
                          </div>

                          {/* Category Filter */}
                          {getUniqueCategories && Array.isArray(getUniqueCategories) && getUniqueCategories.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-gray-400" />
                              <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="all">All Categories</option>
                                {getUniqueCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Room Filter */}
                          {getUniqueRooms && Array.isArray(getUniqueRooms) && getUniqueRooms.length > 0 && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <select
                                value={roomFilter}
                                onChange={(e) => setRoomFilter(e.target.value)}
                                className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="all">All Rooms</option>
                                {getUniqueRooms.map(room => (
                                  <option key={room} value={room}>{room}</option>
                                ))}
                              </select>
                            </div>
                          )}

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
                              onChange={(e) => setSortBy(e.target.value as 'priority' | 'cost' | 'name' | 'code')}
                              className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="priority">Sort by Priority</option>
                              <option value="cost">Sort by Cost</option>
                              <option value="name">Sort by Name</option>
                              <option value="code">Sort by Code</option>
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
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                  <input
                                    type="checkbox"
                                    checked={selectAllMode && selectedItems.size > 0}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        selectAllItems()
                                        setSelectAllMode(true)
                                      } else {
                                        clearSelection()
                                        setSelectAllMode(false)
                                      }
                                    }}
                                    className="mr-2"
                                  />
                                  Item Description
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Code</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total Price</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Priority</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                              {paginatedMissingItems.paginatedItems.length > 0 ? (
                                paginatedMissingItems.paginatedItems.map((item, idx) => (
                                <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedItems.has(`missing-${idx}`) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedItems.has(`missing-${idx}`)}
                                        onChange={() => toggleItemSelection(`missing-${idx}`)}
                                        className="mr-2"
                                      />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.item}</span>
                                      {item.category && (
                                        <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                          {item.category}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {item.code ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{item.code}</span>
                                        <button
                                          onClick={() => copyToClipboard(item.code || '', `code-${idx}`)}
                                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                                          title="Copy code"
                                        >
                                          {copiedItem === `code-${idx}` ? (
                                            <Check className="w-3 h-3 text-green-600" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
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
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => copyToClipboard(`${item.item} | Qty: ${item.quantity} | Price: $${item.totalPrice.toFixed(2)}`, `item-${idx}`)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="Copy item details"
                                      >
                                        {copiedItem === `item-${idx}` ? (
                                          <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                          <Copy className="w-4 h-4" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setFeedbackItemType('missing_item')
                                          setFeedbackItemIndex(idx)
                                          setFeedbackItemDescription(item.item)
                                          setFeedbackModalOpen(true)
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="Provide feedback"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                      </button>
                                    </div>
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
                                    <div className="flex items-center gap-2 flex-1">
                                      <h4 className="font-semibold text-gray-900 dark:text-white text-base">{disc.item}</h4>
                                      <button
                                        onClick={() => {
                                          setFeedbackItemType('discrepancy')
                                          setFeedbackItemIndex(idx)
                                          setFeedbackItemDescription(disc.item)
                                          setFeedbackModalOpen(true)
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="Provide feedback on this discrepancy"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                      </button>
                                    </div>
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

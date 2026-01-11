// Estimate comparison utilities
// These functions help with pre-processing and validation before AI comparison

import { LineItem, Measurement, ParsedEstimate } from './estimate-parser'

export interface ComparisonPreprocessing {
  adjusterData: ParsedEstimate
  contractorData: ParsedEstimate
  suggestedMatches: Array<{
    adjusterItem: LineItem
    contractorItem: LineItem
    confidence: number
  }>
  potentialMissingItems: LineItem[]
  potentialDiscrepancies: Array<{
    item: string
    adjusterValue: number
    contractorValue: number
    differencePercent: number
    type: 'quantity' | 'price' | 'measurement'
  }>
}

/**
 * Pre-process estimates before AI comparison
 * This helps identify obvious matches and discrepancies
 */
export function preprocessComparison(
  adjusterData: ParsedEstimate,
  contractorData: ParsedEstimate
): ComparisonPreprocessing {
  const suggestedMatches: Array<{
    adjusterItem: LineItem
    contractorItem: LineItem
    confidence: number
  }> = []

  const potentialMissingItems: LineItem[] = []
  const potentialDiscrepancies: Array<{
    item: string
    adjusterValue: number
    contractorValue: number
    differencePercent: number
    type: 'quantity' | 'price' | 'measurement'
  }> = []

  // Find potential matches by code (Xactimate/Symbility codes)
  const adjusterByCode = new Map<string, LineItem>()
  const contractorByCode = new Map<string, LineItem>()

  adjusterData.lineItems.forEach(item => {
    if (item.code) {
      adjusterByCode.set(item.code, item)
    }
  })

  contractorData.lineItems.forEach(item => {
    if (item.code) {
      contractorByCode.set(item.code, item)
    }
  })

  // Match by code first (highest confidence)
  adjusterByCode.forEach((adjusterItem, code) => {
    const contractorItem = contractorByCode.get(code)
    if (contractorItem) {
      suggestedMatches.push({
        adjusterItem,
        contractorItem,
        confidence: 0.95, // High confidence for code matches
      })

      // Check for discrepancies in matched items
      const qtyDiff = Math.abs(adjusterItem.quantity - contractorItem.quantity)
      const qtyDiffPercent = adjusterItem.quantity > 0
        ? (qtyDiff / adjusterItem.quantity) * 100
        : 0

      const priceDiff = Math.abs(adjusterItem.unitPrice - contractorItem.unitPrice)
      const priceDiffPercent = adjusterItem.unitPrice > 0
        ? (priceDiff / adjusterItem.unitPrice) * 100
        : 0

      if (qtyDiffPercent > 25) {
        potentialDiscrepancies.push({
          item: adjusterItem.item,
          adjusterValue: adjusterItem.quantity,
          contractorValue: contractorItem.quantity,
          differencePercent: qtyDiffPercent,
          type: 'quantity',
        })
      }

      if (priceDiffPercent > 15) {
        potentialDiscrepancies.push({
          item: adjusterItem.item,
          adjusterValue: adjusterItem.unitPrice,
          contractorValue: contractorItem.unitPrice,
          differencePercent: priceDiffPercent,
          type: 'price',
        })
      }
    }
  })

  // Find items in contractor estimate that don't have matches
  const matchedContractorCodes = new Set(
    suggestedMatches.map(m => m.contractorItem.code).filter(Boolean)
  )

  contractorData.lineItems.forEach(item => {
    if (!item.code || !matchedContractorCodes.has(item.code)) {
      // Check if it might match by description (lower confidence)
      const hasMatch = adjusterData.lineItems.some(adjItem => {
        const desc1 = `${adjItem.item} ${adjItem.description}`.toLowerCase()
        const desc2 = `${item.item} ${item.description}`.toLowerCase()
        return desc1 === desc2 || desc1.includes(desc2) || desc2.includes(desc1)
      })

      if (!hasMatch) {
        potentialMissingItems.push(item)
      }
    }
  })

  // Compare measurements
  adjusterData.measurements.forEach(adjMeas => {
    const contractorMeas = contractorData.measurements.find(
      c => c.type === adjMeas.type && 
           c.description.toLowerCase() === adjMeas.description.toLowerCase()
    )

    if (contractorMeas) {
      const diff = Math.abs(adjMeas.value - contractorMeas.value)
      const diffPercent = adjMeas.value > 0
        ? (diff / adjMeas.value) * 100
        : 0

      if (diffPercent > 25) {
        potentialDiscrepancies.push({
          item: adjMeas.description,
          adjusterValue: adjMeas.value,
          contractorValue: contractorMeas.value,
          differencePercent: diffPercent,
          type: 'measurement',
        })
      }
    }
  })

  return {
    adjusterData,
    contractorData,
    suggestedMatches,
    potentialMissingItems,
    potentialDiscrepancies,
  }
}

/**
 * Validate comparison result structure
 */
export function validateComparisonResult(result: any): boolean {
  if (!result || typeof result !== 'object') return false

  if (!Array.isArray(result.missingItems)) return false
  if (!Array.isArray(result.discrepancies)) return false
  if (!result.summary || typeof result.summary !== 'object') return false

  // Validate summary fields
  const requiredSummaryFields = [
    'totalCostDifference',
    'missingItemsCount',
    'discrepanciesCount',
    'criticalIssues',
    'minorIssues',
  ]

  return requiredSummaryFields.every(field => 
    typeof result.summary[field] === 'number'
  )
}

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
  const matchedContractorIndices = new Set(
    suggestedMatches.map(m => contractorData.lineItems.indexOf(m.contractorItem))
  )

  // Enhanced fuzzy matching function
  function normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  function calculateSimilarity(text1: string, text2: string): number {
    const norm1 = normalizeText(text1)
    const norm2 = normalizeText(text2)
    
    // Exact match
    if (norm1 === norm2) return 1.0
    
    // One contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9
    
    // Word overlap
    const words1 = new Set(norm1.split(/\s+/).filter(w => w.length > 2))
    const words2 = new Set(norm2.split(/\s+/).filter(w => w.length > 2))
    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])
    
    if (union.size === 0) return 0
    return intersection.size / union.size
  }

  // Construction terminology synonyms
  const synonyms: Record<string, string[]> = {
    'remove': ['demo', 'demolish', 'tear out', 'rip out', 'remove and replace', 'r&r'],
    'replace': ['install', 'install new', 'new', 'r&r', 'remove and replace'],
    'repair': ['fix', 'patch', 'restore'],
    'paint': ['paint coat', 'paint finish', 'paint application'],
    'drywall': ['sheetrock', 'gypsum', 'wallboard'],
    'sq ft': ['sqft', 'square feet', 'sf', 'sq.ft'],
    'linear feet': ['lf', 'ln ft', 'linear ft', 'lin ft'],
    'each': ['ea', 'e.a.', 'piece'],
  }

  function expandSynonyms(text: string): string {
    let expanded = text.toLowerCase()
    for (const [key, values] of Object.entries(synonyms)) {
      for (const synonym of values) {
        if (expanded.includes(synonym)) {
          expanded = expanded.replace(new RegExp(synonym, 'gi'), key)
        }
      }
    }
    return expanded
  }

  contractorData.lineItems.forEach((item, index) => {
    // Skip if already matched by code
    if (item.code && matchedContractorCodes.has(item.code)) {
      return
    }
    
    // Skip if already matched
    if (matchedContractorIndices.has(index)) {
      return
    }

    // Enhanced matching: try multiple strategies
    const contractorText = `${item.item} ${item.description} ${item.code || ''}`.toLowerCase()
    const contractorNormalized = expandSynonyms(contractorText)
    
    interface MatchResult {
      item: LineItem
      similarity: number
    }
    
    let bestMatch: MatchResult | null = null
    
    adjusterData.lineItems.forEach(adjItem => {
      // Skip if adjuster item already matched
      const adjusterMatched = suggestedMatches.some(m => m.adjusterItem === adjItem)
      if (adjusterMatched) return
      
      const adjusterText = `${adjItem.item} ${adjItem.description} ${adjItem.code || ''}`.toLowerCase()
      const adjusterNormalized = expandSynonyms(adjusterText)
      
      // Calculate similarity
      const similarity = calculateSimilarity(contractorNormalized, adjusterNormalized)
      
      // Also check if codes match (even if not exact)
      if (item.code && adjItem.code) {
        const codeSimilarity = item.code.toLowerCase() === adjItem.code.toLowerCase() ? 0.95 : 0
        if (codeSimilarity > similarity) {
          bestMatch = { item: adjItem, similarity: codeSimilarity }
          return
        }
      }
      
      // Check if quantities and prices are very similar (might be same item)
      const qtyMatch = Math.abs(item.quantity - adjItem.quantity) < 0.1
      const priceMatch = Math.abs(item.unitPrice - adjItem.unitPrice) < 1.0
      if (qtyMatch && priceMatch && similarity > 0.5) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { item: adjItem, similarity: similarity + 0.2 }
        }
      } else if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { item: adjItem, similarity }
      }
    })

    // Only mark as potentially missing if similarity is very low (< 0.6)
    // This is conservative - we want to avoid false positives
    if (!bestMatch || bestMatch.similarity < 0.6) {
      potentialMissingItems.push(item)
    } else {
      // Add to suggested matches with lower confidence
      suggestedMatches.push({
        adjusterItem: bestMatch.item,
        contractorItem: item,
        confidence: bestMatch.similarity,
      })
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

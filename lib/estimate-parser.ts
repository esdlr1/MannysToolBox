// Estimate parsing utilities
// This will handle extracting structured data from estimate files

export interface LineItem {
  item: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  category?: string
  code?: string // Xactimate/Symbility code if available
}

export interface Measurement {
  type: 'area' | 'linear' | 'volume' | 'count'
  description: string
  value: number
  unit: string
  location?: string
}

export interface ParsedEstimate {
  lineItems: LineItem[]
  measurements: Measurement[]
  totalCost: number
  subtotals?: Record<string, number> // By category
  metadata: {
    format: 'xactimate' | 'symbility' | 'pdf' | 'unknown'
    date?: string
    projectName?: string
  }
}

/**
 * Parse estimate data from extracted text
 * This is a placeholder - will be enhanced with actual PDF parsing
 */
export function parseEstimateText(text: string): ParsedEstimate {
  // TODO: Implement actual parsing logic
  // For now, return empty structure
  return {
    lineItems: [],
    measurements: [],
    totalCost: 0,
    metadata: {
      format: 'unknown',
    },
  }
}

/**
 * Normalize item descriptions for comparison
 * Handles variations in wording, abbreviations, etc.
 */
export function normalizeItemDescription(description: string): string {
  // Convert to lowercase and remove extra spaces
  let normalized = description.toLowerCase().trim().replace(/\s+/g, ' ')
  
  // Common construction term normalizations
  const replacements: Record<string, string> = {
    'sq ft': 'square feet',
    'sq. ft.': 'square feet',
    'sqft': 'square feet',
    'lf': 'linear feet',
    'ln ft': 'linear feet',
    'ln. ft.': 'linear feet',
    'ea': 'each',
    'ea.': 'each',
    'remove': 'removal',
    'remove and replace': 'r&r',
    'r & r': 'r&r',
    'demo': 'demolition',
    'demo and remove': 'demolition and removal',
  }
  
  // Apply replacements
  Object.entries(replacements).forEach(([old, newVal]) => {
    normalized = normalized.replace(new RegExp(`\\b${old}\\b`, 'gi'), newVal)
  })
  
  return normalized
}

/**
 * Calculate similarity between two item descriptions
 * Returns a score between 0 and 1
 */
export function calculateItemSimilarity(item1: string, item2: string): number {
  const norm1 = normalizeItemDescription(item1)
  const norm2 = normalizeItemDescription(item2)
  
  // Exact match
  if (norm1 === norm2) return 1.0
  
  // Check if one contains the other (high similarity)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.8
  }
  
  // Word-based similarity
  const words1 = new Set(norm1.split(' '))
  const words2 = new Set(norm2.split(' '))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  // Jaccard similarity
  return intersection.size / union.size
}

/**
 * Find matching items between two estimates
 */
export function findMatchingItems(
  items1: LineItem[],
  items2: LineItem[]
): Array<{
  item1: LineItem
  item2: LineItem
  similarity: number
}> {
  const matches: Array<{
    item1: LineItem
    item2: LineItem
    similarity: number
  }> = []
  
  items1.forEach(item1 => {
    let bestMatch: LineItem | null = null
    let bestSimilarity = 0
    
    items2.forEach(item2 => {
      const similarity = calculateItemSimilarity(
        `${item1.item} ${item1.description}`,
        `${item2.item} ${item2.description}`
      )
      
      if (similarity > bestSimilarity && similarity > 0.6) {
        bestSimilarity = similarity
        bestMatch = item2
      }
    })
    
    if (bestMatch) {
      matches.push({
        item1,
        item2: bestMatch,
        similarity: bestSimilarity,
      })
    }
  })
  
  return matches
}

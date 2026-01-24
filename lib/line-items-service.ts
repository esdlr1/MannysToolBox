// Shared Line Items Service
// Provides access to the Xactimate line items database for all tools

import xactimateLineItems from './xactimate-line-items.json'

export interface LineItem {
  code: string
  description: string
  category?: string
  unit?: string
}

// Cache for lookup maps to avoid rebuilding on every call
let codeMap: Map<string, LineItem> | null = null
let descriptionMap: Map<string, LineItem[]> | null = null
let normalizedDescriptionMap: Map<string, LineItem[]> | null = null
let categoryMap: Map<string, LineItem[]> | null = null

// Normalize text for matching
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Initialize lookup maps (lazy loading)
function initializeMaps() {
  if (codeMap !== null) return // Already initialized

  codeMap = new Map<string, LineItem>()
  descriptionMap = new Map<string, LineItem[]>()
  normalizedDescriptionMap = new Map<string, LineItem[]>()
  categoryMap = new Map<string, LineItem[]>()

  for (const item of xactimateLineItems as LineItem[]) {
    // Index by code
    if (item.code) {
      codeMap.set(item.code.toUpperCase().trim(), item)
    }

    // Index by description (exact)
    if (item.description) {
      if (!descriptionMap.has(item.description)) {
        descriptionMap.set(item.description, [])
      }
      descriptionMap.get(item.description)!.push(item)

      // Index by normalized description
      const normalized = normalize(item.description)
      if (!normalizedDescriptionMap.has(normalized)) {
        normalizedDescriptionMap.set(normalized, [])
      }
      normalizedDescriptionMap.get(normalized)!.push(item)
    }

    // Index by category
    if (item.category) {
      const cat = item.category.toUpperCase().trim()
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, [])
      }
      categoryMap.get(cat)!.push(item)
    }
  }
}

/**
 * Get all line items
 */
export function getAllLineItems(): LineItem[] {
  initializeMaps()
  return xactimateLineItems as LineItem[]
}

/**
 * Find line item by code
 */
export function findByCode(code: string): LineItem | undefined {
  initializeMaps()
  return codeMap!.get(code.toUpperCase().trim())
}

/**
 * Find line items by description (exact or partial match)
 */
export function findByDescription(description: string, exactOnly: boolean = false): LineItem[] {
  initializeMaps()
  const results: LineItem[] = []
  const normalized = normalize(description)

  // Exact match
  const exact = descriptionMap!.get(description)
  if (exact) {
    results.push(...exact)
  }

  if (exactOnly) {
    return results
  }

  // Normalized exact match
  const normalizedExact = normalizedDescriptionMap!.get(normalized)
  if (normalizedExact) {
    for (const item of normalizedExact) {
      if (!results.find(r => r.code === item.code && r.description === item.description)) {
        results.push(item)
      }
    }
  }

  // Partial match - check if description contains any line item description
  for (const [normDesc, items] of normalizedDescriptionMap!.entries()) {
    if (normalized.includes(normDesc) || normDesc.includes(normalized)) {
      // Only add if it's a meaningful match (not too short)
      if (normDesc.length > 10 || normalized.length > 10) {
        for (const item of items) {
          if (!results.find(r => r.code === item.code && r.description === item.description)) {
            results.push(item)
          }
        }
      }
    }
  }

  return results
}

/**
 * Search line items by keyword (searches both code and description)
 */
export function searchByKeyword(keyword: string, limit: number = 50): LineItem[] {
  initializeMaps()
  const normalizedKeyword = normalize(keyword)
  const results: LineItem[] = []
  const seen = new Set<string>()

  for (const item of xactimateLineItems as LineItem[]) {
    const itemDesc = normalize(item.description)
    const itemCode = item.code?.toUpperCase().trim() || ''

    if (
      itemDesc.includes(normalizedKeyword) ||
      itemCode.includes(normalizedKeyword.toUpperCase())
    ) {
      const key = `${item.code}-${item.description}`
      if (!seen.has(key)) {
        results.push(item)
        seen.add(key)
        if (results.length >= limit) break
      }
    }
  }

  return results
}

/**
 * Get line items by category
 */
export function getByCategory(category: string): LineItem[] {
  initializeMaps()
  return categoryMap!.get(category.toUpperCase().trim()) || []
}

/**
 * Get all available categories
 */
export function getAllCategories(): string[] {
  initializeMaps()
  const categories = new Set<string>()
  for (const item of xactimateLineItems as LineItem[]) {
    if (item.category) {
      categories.add(item.category.toUpperCase().trim())
    }
  }
  return Array.from(categories).sort()
}

/**
 * Check if a line item exists in the database
 */
export function itemExists(
  code?: string,
  description?: string
): boolean {
  if (code) {
    const found = findByCode(code)
    if (found) return true
  }

  if (description) {
    const matches = findByDescription(description, true)
    if (matches.length > 0) return true
  }

  return false
}

/**
 * Find similar line items (fuzzy matching)
 */
export function findSimilar(description: string, threshold: number = 0.6): LineItem[] {
  initializeMaps()
  const normalized = normalize(description)
  const results: LineItem[] = []
  const words = normalized.split(' ').filter(w => w.length > 2)

  for (const item of xactimateLineItems as LineItem[]) {
    const itemDesc = normalize(item.description)
    const itemWords = itemDesc.split(' ').filter(w => w.length > 2)

    // Calculate similarity based on common words
    const commonWords = words.filter(w => itemWords.includes(w))
    const similarity = commonWords.length / Math.max(words.length, itemWords.length)

    if (similarity >= threshold) {
      results.push(item)
    }
  }

  // Sort by similarity (descending)
  return results.sort((a, b) => {
    const aSim = calculateSimilarity(description, a.description)
    const bSim = calculateSimilarity(description, b.description)
    return bSim - aSim
  })
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalize(str1)
  const norm2 = normalize(str2)

  if (norm1 === norm2) return 1.0

  const words1 = norm1.split(' ').filter(w => w.length > 2)
  const words2 = norm2.split(' ').filter(w => w.length > 2)

  if (words1.length === 0 || words2.length === 0) return 0

  const commonWords = words1.filter(w => words2.includes(w))
  return commonWords.length / Math.max(words1.length, words2.length)
}

/**
 * Get line item statistics
 */
export function getStatistics() {
  initializeMaps()
  const items = xactimateLineItems as LineItem[]
  
  const byCategory = new Map<string, number>()
  for (const item of items) {
    const cat = item.category || 'UNKNOWN'
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1)
  }

  return {
    total: items.length,
    withCode: items.filter(i => i.code).length,
    withCategory: items.filter(i => i.category).length,
    withUnit: items.filter(i => i.unit).length,
    byCategory: Object.fromEntries(byCategory),
  }
}

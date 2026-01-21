// Xactimate line item lookup system
// Uses the parsed Xactimate line items to improve matching accuracy

import xactimateLineItems from './xactimate-line-items.json'

interface XactimateLineItem {
  code: string
  description: string
  category?: string
  unit?: string
}

// Normalize text for matching
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Create lookup maps for fast searching
const codeMap = new Map<string, XactimateLineItem>()
const descriptionMap = new Map<string, XactimateLineItem[]>()
const normalizedDescriptionMap = new Map<string, XactimateLineItem[]>()

// Initialize lookup maps
for (const item of xactimateLineItems as XactimateLineItem[]) {
  // Index by code
  if (item.code) {
    codeMap.set(item.code.toUpperCase(), item)
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
}

/**
 * Find Xactimate line item by code
 */
export function findByCode(code: string): XactimateLineItem | undefined {
  return codeMap.get(code.toUpperCase().trim())
}

/**
 * Find Xactimate line items by description (exact or partial match)
 */
export function findByDescription(description: string): XactimateLineItem[] {
  const results: XactimateLineItem[] = []
  const normalized = normalize(description)
  
  // Exact match
  const exact = descriptionMap.get(description)
  if (exact) {
    results.push(...exact)
  }
  
  // Normalized exact match
  const normalizedExact = normalizedDescriptionMap.get(normalized)
  if (normalizedExact) {
    results.push(...normalizedExact)
  }
  
  // Partial match - check if description contains any line item description
  for (const [normDesc, items] of normalizedDescriptionMap.entries()) {
    if (normalized.includes(normDesc) || normDesc.includes(normalized)) {
      // Only add if it's a meaningful match (not too short)
      if (normDesc.length > 10 || normalized.length > 10) {
        results.push(...items)
      }
    }
  }
  
  // Remove duplicates
  const unique = new Map<string, XactimateLineItem>()
  for (const item of results) {
    const key = `${item.code}-${item.description}`
    if (!unique.has(key)) {
      unique.set(key, item)
    }
  }
  
  return Array.from(unique.values())
}

/**
 * Check if a required item exists in the estimate using Xactimate lookup
 */
export function itemExistsInXactimate(
  lineItems: Array<{ description?: string; item?: string; code?: string }>,
  requiredKeywords: string[]
): boolean {
  // First, check if any line item code matches
  for (const item of lineItems) {
    const code = item.code?.toString().trim().toUpperCase()
    if (code) {
      const xactItem = findByCode(code)
      if (xactItem) {
        // Check if the Xactimate item description matches required keywords
        const xactDesc = normalize(xactItem.description)
        if (requiredKeywords.some((kw) => xactDesc.includes(normalize(kw)))) {
          return true
        }
      }
    }
    
    // Check description against Xactimate database
    const description = item.description || item.item || ''
    if (description) {
      const matches = findByDescription(description)
      for (const match of matches) {
        const matchDesc = normalize(match.description)
        if (requiredKeywords.some((kw) => matchDesc.includes(normalize(kw)))) {
          return true
        }
      }
    }
  }
  
  return false
}

/**
 * Get all Xactimate line items
 */
export function getAllLineItems(): XactimateLineItem[] {
  return xactimateLineItems as XactimateLineItem[]
}

/**
 * Search Xactimate line items by keyword
 */
export function searchByKeyword(keyword: string, limit: number = 10): XactimateLineItem[] {
  const normalizedKeyword = normalize(keyword)
  const results: XactimateLineItem[] = []
  
  for (const item of xactimateLineItems as XactimateLineItem[]) {
    const itemDesc = normalize(item.description)
    const itemCode = item.code?.toUpperCase() || ''
    
    if (
      itemDesc.includes(normalizedKeyword) ||
      itemCode.includes(normalizedKeyword.toUpperCase())
    ) {
      results.push(item)
      if (results.length >= limit) break
    }
  }
  
  return results
}

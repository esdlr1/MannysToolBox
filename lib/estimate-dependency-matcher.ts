// Improved matching logic for estimate dependency checking
// Focuses on consistency and everyday estimate patterns

/**
 * Normalize text for comparison - handles common variations and abbreviations
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Check if an item matches any of the required keywords (with synonyms)
 */
export function matchesKeywords(
  itemText: string,
  keywords: string[],
  synonyms: Record<string, string[]> = {}
): boolean {
  const normalized = normalizeForMatching(itemText)
  
  // Check direct keyword matches
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeForMatching(keyword)
    
    // Exact match or word boundary match
    if (
      normalized === normalizedKeyword ||
      normalized.includes(` ${normalizedKeyword} `) ||
      normalized.startsWith(`${normalizedKeyword} `) ||
      normalized.endsWith(` ${normalizedKeyword}`)
    ) {
      return true
    }
    
    // Check synonyms
    if (synonyms[keyword]) {
      for (const synonym of synonyms[keyword]) {
        const normalizedSynonym = normalizeForMatching(synonym)
        if (
          normalized === normalizedSynonym ||
          normalized.includes(` ${normalizedSynonym} `) ||
          normalized.startsWith(`${normalizedSynonym} `) ||
          normalized.endsWith(` ${normalizedSynonym}`)
        ) {
          return true
        }
      }
    }
  }
  
  return false
}

/**
 * Keyword synonyms for common construction terms
 */
export const keywordSynonyms: Record<string, string[]> = {
  'tape': ['taping', 'joint tape', 'drywall tape', 'paper tape'],
  'mud': ['joint compound', 'compound', 'spackle', 'drywall mud'],
  'texture': ['texturing', 'orange peel', 'knockdown', 'skip trowel', 'stomp'],
  'prime': ['primer', 'prime coat', 'sealer', 'seal'],
  'paint': ['painting', 'paint coat', 'finish coat', 'top coat'],
  'flashing': ['flash', 'metal flashing', 'valley flashing', 'step flashing'],
  'underlayment': ['felt', 'tar paper', 'roofing felt', 'synthetic underlayment'],
  'shutoff valve': ['ball valve', 'stop valve', 'isolation valve', 'shut-off valve'],
  'junction box': ['j-box', 'electrical box', 'outlet box', 'switch box'],
  'circuit breaker': ['breaker', 'panel breaker', 'circuit breaker in panel'],
  'ground': ['grounding', 'ground wire', 'earth ground', 'ground rod'],
  'duct': ['ductwork', 'supply duct', 'return duct', 'air duct'],
  'grout': ['tile grout', 'grouting'],
  'carpet pad': ['padding', 'carpet padding', 'underlayment'],
  'caulk': ['caulking', 'sealant', 'window seal', 'weather seal'],
  'hardware': ['door hardware', 'cabinet hardware'],
}

/**
 * Check if an item already exists in the estimate (with variations)
 * Now also checks against Xactimate line item database
 */
export function itemExists(
  lineItems: Array<{ description?: string; item?: string; code?: string }>,
  requiredKeywords: string[],
  synonyms: Record<string, string[]> = keywordSynonyms
): boolean {
  // First, check using Xactimate lookup (more accurate)
  try {
    const { itemExistsInXactimate } = require('./xactimate-lookup')
    if (itemExistsInXactimate(lineItems, requiredKeywords)) {
      return true
    }
  } catch (e) {
    // Xactimate lookup not available, continue with regular matching
  }
  
  // Fallback to regular keyword matching
  for (const item of lineItems) {
    const description = item.description || item.item || ''
    const code = item.code ? ` ${item.code}` : ''
    const fullText = `${description}${code}`
    
    if (matchesKeywords(fullText, requiredKeywords, synonyms)) {
      return true
    }
  }
  
  return false
}

/**
 * Get confidence score for a missing item check
 * Higher score = more confident the item is actually missing
 */
export function getMissingItemConfidence(
  lineItems: Array<{ description?: string; item?: string; code?: string }>,
  triggerKeywords: string[][],
  requiredKeywords: string[],
  category: string
): number {
  let confidence = 0.5 // Base confidence
  
  // Check how strong the trigger match is
  const normalizedItems = lineItems.map((item) => {
    const description = item.description || item.item || ''
    const code = item.code ? ` ${item.code}` : ''
    return normalizeForMatching(`${description}${code}`)
  })
  
  // Count trigger matches
  let triggerMatchCount = 0
  for (const keywordGroup of triggerKeywords) {
    for (const keyword of keywordGroup) {
      const normalizedKeyword = normalizeForMatching(keyword)
      if (normalizedItems.some((item) => item.includes(normalizedKeyword))) {
        triggerMatchCount++
        break
      }
    }
  }
  
  // Stronger trigger match = higher confidence
  if (triggerMatchCount >= triggerKeywords.length) {
    confidence += 0.3
  }
  
  // Check if required item is definitely missing (no synonyms found)
  if (!itemExists(lineItems, requiredKeywords)) {
    confidence += 0.2
  }
  
  // Check if category-related items exist (context)
  const categoryKeywords: Record<string, string[]> = {
    'Roofing': ['roof', 'shingle', 'gutter'],
    'Plumbing': ['plumb', 'pipe', 'fixture'],
    'Electrical': ['electrical', 'wire', 'circuit'],
    'HVAC': ['hvac', 'duct', 'vent'],
    'Flooring': ['floor', 'tile', 'carpet'],
    'Drywall': ['drywall', 'sheetrock'],
    'Windows': ['window'],
    'Doors': ['door'],
  }
  
  const categoryKw = categoryKeywords[category] || []
  const hasCategoryContext = normalizedItems.some((item) =>
    categoryKw.some((kw) => item.includes(kw))
  )
  
  if (hasCategoryContext) {
    confidence += 0.1
  }
  
  return Math.min(confidence, 1.0)
}

/**
 * Check if item should be excluded based on estimate context
 * Some items might be excluded if they're clearly not applicable
 */
export function shouldExcludeItem(
  lineItems: Array<{ description?: string; item?: string; code?: string }>,
  missingItem: string,
  category: string
): boolean {
  const normalizedItems = lineItems.map((item) => {
    const description = item.description || item.item || ''
    const code = item.code ? ` ${item.code}` : ''
    return normalizeForMatching(`${description}${code}`)
  })
  
  const fullText = normalizedItems.join(' ')
  
  // Exclude "full room paint" if it's a minor repair
  if (missingItem.includes('entire room') || missingItem.includes('full room')) {
    // Check if this is a major repair or just a patch
    const hasMinorRepair = fullText.includes('patch') || 
                          fullText.includes('small repair') ||
                          fullText.includes('spot repair')
    if (hasMinorRepair) {
      return true
    }
  }
  
  // Exclude "expansion tank" if water heater is tankless
  if (missingItem.includes('expansion tank')) {
    if (fullText.includes('tankless') || fullText.includes('on-demand')) {
      return true
    }
  }
  
  // Exclude "access panel" if pipes are exposed
  if (missingItem.includes('access panel')) {
    if (fullText.includes('exposed') || fullText.includes('open')) {
      return true
    }
  }
  
  return false
}

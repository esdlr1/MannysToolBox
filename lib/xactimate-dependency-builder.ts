// Build dependency rules from Xactimate line items
// Analyzes patterns and relationships to create intelligent dependency checks

import { getAllLineItems, searchByKeyword } from './xactimate-lookup'

interface DependencyPattern {
  trigger: string[] // Keywords that trigger this check
  required: string[] // Keywords that should be present
  category: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
  conditions?: string[] // When this applies (e.g., "water damage", "fire damage")
}

/**
 * Analyze line items to build dependency patterns
 */
export function buildDependencyPatterns(): DependencyPattern[] {
  const patterns: DependencyPattern[] = []
  const allItems = getAllLineItems()
  
  // Group items by category
  const byCategory = new Map<string, typeof allItems>()
  for (const item of allItems) {
    const cat = item.category || 'UNKNOWN'
    if (!byCategory.has(cat)) {
      byCategory.set(cat, [])
    }
    byCategory.get(cat)!.push(item)
  }
  
  // Build patterns based on common construction dependencies
  // These are based on industry knowledge and the web research
  
  // DRYWALL PATTERNS
  const drywallItems = searchByKeyword('drywall', 50)
  if (drywallItems.length > 0) {
    patterns.push({
      trigger: ['drywall', 'sheetrock', 'gypsum'],
      required: ['tape', 'mud', 'joint compound', 'texture'],
      category: 'DRY',
      reason: 'Drywall installation requires taping, mudding, and texturing',
      confidence: 'high',
    })
    
    patterns.push({
      trigger: ['drywall', 'sheetrock'],
      required: ['paint', 'primer', 'seal'],
      category: 'DRY',
      reason: 'Finished drywall requires primer and paint',
      confidence: 'high',
    })
  }
  
  // WATER DAMAGE PATTERNS
  const waterItems = searchByKeyword('water', 50)
  if (waterItems.length > 0) {
    patterns.push({
      trigger: ['water', 'flood', 'moisture'],
      required: ['dry', 'dehumidifier', 'air mover', 'antimicrobial'],
      category: 'WTR',
      reason: 'Water damage requires drying equipment and antimicrobial treatment',
      confidence: 'high',
      conditions: ['water damage'],
    })
    
    patterns.push({
      trigger: ['water', 'drywall', 'remove'],
      required: ['antimicrobial', 'clean', 'seal'],
      category: 'WTR',
      reason: 'Water-damaged drywall removal requires antimicrobial treatment',
      confidence: 'high',
      conditions: ['water damage'],
    })
  }
  
  // FLOORING PATTERNS
  const flooringItems = searchByKeyword('floor', 50)
  if (flooringItems.length > 0) {
    patterns.push({
      trigger: ['floor', 'replace', 'install'],
      required: ['baseboard', 'trim', 'molding', 'detach', 'reset'],
      category: 'FLR',
      reason: 'Flooring replacement typically requires baseboard/trim removal and reset',
      confidence: 'medium',
    })
    
    patterns.push({
      trigger: ['tile', 'install'],
      required: ['grout', 'underlayment', 'subfloor'],
      category: 'FLR',
      reason: 'Tile installation requires grout and proper subfloor preparation',
      confidence: 'high',
    })
  }
  
  // PAINTING PATTERNS
  const paintItems = searchByKeyword('paint', 50)
  if (paintItems.length > 0) {
    patterns.push({
      trigger: ['paint', 'wall', 'ceiling'],
      required: ['primer', 'prep', 'mask', 'tape'],
      category: 'PNT',
      reason: 'Painting requires primer and proper surface preparation',
      confidence: 'medium',
    })
  }
  
  // ROOFING PATTERNS
  const roofingItems = searchByKeyword('roof', 30)
  if (roofingItems.length > 0) {
    patterns.push({
      trigger: ['roof', 'shingle', 'replace'],
      required: ['underlayment', 'felt', 'flashing', 'drip edge'],
      category: 'ROF',
      reason: 'Roofing replacement requires underlayment, flashing, and drip edge',
      confidence: 'high',
    })
  }
  
  // PLUMBING PATTERNS
  const plumbingItems = searchByKeyword('plumb', 30)
  if (plumbingItems.length > 0) {
    patterns.push({
      trigger: ['fixture', 'toilet', 'sink', 'shower'],
      required: ['supply', 'drain', 'waste', 'p-trap'],
      category: 'PLB',
      reason: 'Plumbing fixtures require supply lines, drains, and P-traps',
      confidence: 'high',
    })
  }
  
  // ELECTRICAL PATTERNS
  const electricalItems = searchByKeyword('electrical', 30)
  if (electricalItems.length > 0) {
    patterns.push({
      trigger: ['wire', 'wiring', 'circuit'],
      required: ['junction box', 'breaker', 'ground'],
      category: 'ELE',
      reason: 'Electrical work requires junction boxes, breakers, and grounding',
      confidence: 'high',
    })
  }
  
  // APPLIANCE PATTERNS
  const applianceItems = searchByKeyword('appliance', 30)
  const applianceItemsByCat = allItems.filter((item) => item.category === 'APP')
  if (applianceItems.length > 0 || applianceItemsByCat.length > 0) {
    patterns.push({
      trigger: ['appliance', 'refrigerator', 'stove', 'oven', 'dishwasher', 'washer', 'dryer', 'microwave'],
      required: ['detach', 'reset', 'disconnect', 'reconnect', 'install'],
      category: 'APP',
      reason: 'Appliance replacement typically requires detach/reset of existing and installation of new',
      confidence: 'medium',
    })
    
    patterns.push({
      trigger: ['appliance', 'water heater', 'furnace', 'hvac'],
      required: ['electrical', 'gas', 'plumbing', 'vent', 'duct'],
      category: 'APP',
      reason: 'Appliances require proper connections (electrical/gas/plumbing) and venting',
      confidence: 'high',
    })
  }
  
  return patterns
}

/**
 * Get dependency patterns for a specific category
 */
export function getPatternsForCategory(category: string): DependencyPattern[] {
  const allPatterns = buildDependencyPatterns()
  return allPatterns.filter((p) => p.category === category)
}

/**
 * Find patterns that match given line items
 */
export function findMatchingPatterns(
  lineItems: Array<{ description?: string; item?: string; code?: string }>
): DependencyPattern[] {
  const allPatterns = buildDependencyPatterns()
  const itemTexts = lineItems.map((item) => {
    const desc = item.description || item.item || ''
    return desc.toLowerCase()
  })
  
  const matching: DependencyPattern[] = []
  
  for (const pattern of allPatterns) {
    // Check if any trigger keywords match
    const hasTrigger = pattern.trigger.some((keyword) =>
      itemTexts.some((text) => text.includes(keyword.toLowerCase()))
    )
    
    if (hasTrigger) {
      matching.push(pattern)
    }
  }
  
  return matching
}

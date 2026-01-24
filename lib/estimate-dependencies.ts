// Comprehensive construction estimate dependency rules
// Based on industry best practices, Xactimate patterns, and common missing items
// Focused on consistency for everyday estimates

import {
  itemExists,
  keywordSynonyms,
  getMissingItemConfidence,
  shouldExcludeItem,
} from './estimate-dependency-matcher'
import { findMatchingPatterns } from './xactimate-dependency-builder'

export interface DependencyRule {
  category: string
  trigger: {
    keywords: string[][]
    description: string
    excludeKeywords?: string[][] // Keywords that exclude this rule (e.g., "drywall per lf")
  }
  required: {
    keywords: string[]
    description: string
  }
  missingItem: string
  reason: string
  priority: 'critical' | 'minor'
  excludeIf?: {
    keywords: string[][]
    description: string
  }
}

export const dependencyRules: DependencyRule[] = [
  // DRYWALL & INTERIOR FINISHES
  // NOTE: "Drywall per LF" line items ALREADY include tape, mud, and texture - do not flag these
  {
    category: 'Drywall',
    trigger: {
      keywords: [['drywall', 'sheetrock'], ['replace', 'replacement', 'remove', 'demo', 'install', 'hang']],
      description: 'Drywall replacement/installation (excluding "per LF" items which include finish)',
      excludeKeywords: [['drywall', 'per', 'lf'], ['drywall', 'per', 'linear'], ['drywall', 'lf']] // Exclude "drywall per LF" items
    },
    required: {
      keywords: ['tape', 'mud', 'compound', 'joint'],
      description: 'Tape and mud'
    },
    missingItem: 'Drywall tape and mud (finish)',
    reason: 'Drywall replacement typically requires taping and joint compound. NOTE: "Drywall per LF" already includes this.',
    priority: 'critical'
  },
  {
    category: 'Drywall',
    trigger: {
      keywords: [['drywall', 'sheetrock'], ['replace', 'replacement', 'remove', 'demo', 'install', 'hang']],
      description: 'Drywall replacement/installation (excluding "per LF" items which include finish)',
      excludeKeywords: [['drywall', 'per', 'lf'], ['drywall', 'per', 'linear'], ['drywall', 'lf']] // Exclude "drywall per LF" items
    },
    required: {
      keywords: ['texture', 'orange peel', 'knockdown'],
      description: 'Texture finish'
    },
    missingItem: 'Drywall texture (match existing)',
    reason: 'Drywall replacement usually requires re-texturing to match existing finish. NOTE: "Drywall per LF" already includes this.',
    priority: 'critical'
  },
  {
    category: 'Drywall',
    trigger: {
      keywords: [['drywall', 'sheetrock'], ['replace', 'replacement', 'remove', 'demo', 'install', 'hang']],
      description: 'Drywall replacement/installation'
    },
    required: {
      keywords: ['prime', 'primer', 'seal'],
      description: 'Primer/sealer'
    },
    missingItem: 'Prime/seal new drywall',
    reason: 'New drywall needs primer/sealer before paint.',
    priority: 'minor'
  },
  {
    category: 'Drywall',
    trigger: {
      keywords: [['drywall', 'sheetrock'], ['replace', 'replacement', 'remove', 'demo', 'install', 'hang']],
      description: 'Drywall replacement/installation'
    },
    required: {
      keywords: ['paint', 'finish coat'],
      description: 'Paint'
    },
    missingItem: 'Paint repaired surfaces',
    reason: 'Drywall replacement usually requires painting finished surfaces.',
    priority: 'critical'
  },
  {
    category: 'Drywall',
    trigger: {
      keywords: [['drywall', 'sheetrock'], ['replace', 'replacement', 'remove', 'demo', 'install', 'hang']],
      description: 'Drywall replacement/installation'
    },
    required: {
      keywords: ['paint room', 'paint walls', 'paint ceiling', 'paint entire'],
      description: 'Full room paint'
    },
    missingItem: 'Paint entire affected room (walls/ceiling)',
    reason: 'Patching drywall often requires full room paint for color/texture consistency. Only flag if no wall/ceiling calculations are present.',
    priority: 'minor',
    excludeIf: {
      keywords: [['wall', 'calculation'], ['ceiling', 'calculation'], ['calc', 'wall'], ['calc', 'ceiling']],
      description: 'Wall or ceiling calculations present (paint likely included)'
    }
  },
  
  // ROOFING
  {
    category: 'Roofing',
    trigger: {
      keywords: [['shingles', 'roof', 'roofing'], ['install', 'replace', 'replacement', 'repair']],
      description: 'Roofing/shingles work'
    },
    required: {
      keywords: ['underlayment', 'felt', 'tar paper', 'ice shield'],
      description: 'Underlayment'
    },
    missingItem: 'Roofing underlayment/ice shield',
    reason: 'Shingles require underlayment for protection against water.',
    priority: 'critical'
  },
  {
    category: 'Roofing',
    trigger: {
      keywords: [['shingles', 'roof', 'roofing'], ['install', 'replace', 'replacement', 'repair']],
      description: 'Roofing/shingles work'
    },
    required: {
      keywords: ['flashing', 'valley', 'ridge', 'step', 'counter flashing'],
      description: 'Flashing'
    },
    missingItem: 'Roof flashing (valleys, ridges, penetrations)',
    reason: 'Roofing requires flashing at valleys, ridges, and penetrations to prevent leaks.',
    priority: 'critical'
  },
  {
    category: 'Roofing',
    trigger: {
      keywords: [['shingles', 'roof', 'roofing'], ['install', 'replace', 'replacement', 'repair']],
      description: 'Roofing/shingles work'
    },
    required: {
      keywords: ['gutters', 'downspouts', 'drainage'],
      description: 'Gutters/downspouts'
    },
    missingItem: 'Gutters and downspouts',
    reason: 'Roof replacement often requires inspection/repair of gutter systems.',
    priority: 'minor'
  },
  {
    category: 'Roofing',
    trigger: {
      keywords: [['shingles', 'roof', 'roofing'], ['install', 'replace', 'replacement', 'repair']],
      description: 'Roofing/shingles work'
    },
    required: {
      keywords: ['drip edge', 'edge metal'],
      description: 'Drip edge'
    },
    missingItem: 'Drip edge metal',
    reason: 'Drip edge protects roof edges and prevents water damage.',
    priority: 'minor'
  },
  
  // PLUMBING
  {
    category: 'Plumbing',
    trigger: {
      keywords: [['pipe', 'plumbing', 'water line'], ['replace', 'repair', 'install']],
      description: 'Plumbing pipe work'
    },
    required: {
      keywords: ['shutoff valve', 'ball valve', 'stop valve', 'isolation valve'],
      description: 'Shutoff valves'
    },
    missingItem: 'Shutoff/isolation valves',
    reason: 'Pipe replacement requires shutoff valves for maintenance and emergency control.',
    priority: 'critical'
  },
  {
    category: 'Plumbing',
    trigger: {
      keywords: [['pipe', 'plumbing'], ['replace', 'repair', 'install']],
      description: 'Plumbing pipe in wall/ceiling'
    },
    required: {
      keywords: ['access panel', 'access door'],
      description: 'Access panel'
    },
    missingItem: 'Access panel for plumbing',
    reason: 'Pipes in walls/ceilings require access panels for future maintenance.',
    priority: 'minor'
  },
  {
    category: 'Plumbing',
    trigger: {
      keywords: [['toilet', 'sink', 'faucet', 'shower', 'tub'], ['install', 'replace', 'repair']],
      description: 'Plumbing fixture installation'
    },
    required: {
      keywords: ['supply line', 'water line', 'connector', 'flex line'],
      description: 'Supply lines'
    },
    missingItem: 'Supply lines/connectors for fixtures',
    reason: 'Plumbing fixtures require supply lines to connect to water supply.',
    priority: 'critical'
  },
  {
    category: 'Plumbing',
    trigger: {
      keywords: [['toilet', 'sink', 'faucet', 'shower', 'tub'], ['install', 'replace', 'repair']],
      description: 'Plumbing fixture installation'
    },
    required: {
      keywords: ['drain', 'waste', 'p-trap', 'trap'],
      description: 'Drain/waste lines'
    },
    missingItem: 'Drain/waste lines and P-traps',
    reason: 'Plumbing fixtures require drain/waste connections and P-traps.',
    priority: 'critical'
  },
  {
    category: 'Plumbing',
    trigger: {
      keywords: [['water heater'], ['install', 'replace', 'repair']],
      description: 'Water heater installation'
    },
    required: {
      keywords: ['expansion tank', 'thermal expansion'],
      description: 'Expansion tank'
    },
    missingItem: 'Thermal expansion tank',
    reason: 'Water heaters often require expansion tanks for pressure relief (code requirement).',
    priority: 'minor'
  },
  
  // ELECTRICAL
  {
    category: 'Electrical',
    trigger: {
      keywords: [['wire', 'electrical', 'wiring'], ['install', 'replace', 'repair']],
      description: 'Electrical wiring work'
    },
    required: {
      keywords: ['junction box', 'electrical box', 'j-box'],
      description: 'Junction boxes'
    },
    missingItem: 'Junction boxes for electrical connections',
    reason: 'Electrical wiring requires junction boxes for connections (code requirement).',
    priority: 'critical'
  },
  {
    category: 'Electrical',
    trigger: {
      keywords: [['circuit', 'wiring'], ['add', 'new', 'install']],
      description: 'New circuit installation'
    },
    required: {
      keywords: ['circuit breaker', 'breaker', 'panel breaker'],
      description: 'Circuit breaker'
    },
    missingItem: 'Circuit breaker in panel',
    reason: 'New circuits require corresponding breakers in electrical panel.',
    priority: 'critical'
  },
  {
    category: 'Electrical',
    trigger: {
      keywords: [['wire', 'electrical', 'wiring'], ['install', 'replace', 'repair']],
      description: 'Electrical work'
    },
    required: {
      keywords: ['ground', 'grounding', 'ground wire', 'earth ground'],
      description: 'Grounding system'
    },
    missingItem: 'Grounding system',
    reason: 'Electrical systems require proper grounding for safety (code requirement).',
    priority: 'critical'
  },
  {
    category: 'Electrical',
    trigger: {
      keywords: [['outlet', 'switch', 'receptacle'], ['install', 'replace', 'repair']],
      description: 'Outlet/switch installation'
    },
    required: {
      keywords: ['electrical box', 'outlet box', 'switch box'],
      description: 'Electrical box'
    },
    missingItem: 'Electrical box for outlet/switch',
    reason: 'Outlets and switches require proper electrical boxes for installation.',
    priority: 'critical'
  },
  
  // HVAC
  {
    category: 'HVAC',
    trigger: {
      keywords: [['hvac', 'furnace', 'air conditioner'], ['install', 'replace', 'repair']],
      description: 'HVAC installation'
    },
    required: {
      keywords: ['duct', 'ductwork', 'supply duct', 'return duct'],
      description: 'Ductwork'
    },
    missingItem: 'HVAC ductwork',
    reason: 'HVAC units require ductwork to distribute air.',
    priority: 'critical'
  },
  {
    category: 'HVAC',
    trigger: {
      keywords: [['hvac', 'furnace', 'air conditioner'], ['install', 'replace', 'repair']],
      description: 'HVAC installation'
    },
    required: {
      keywords: ['vent', 'register', 'grille', 'diffuser'],
      description: 'Vents/registers'
    },
    missingItem: 'HVAC vents and registers',
    reason: 'HVAC systems require supply and return vents/registers.',
    priority: 'critical'
  },
  {
    category: 'HVAC',
    trigger: {
      keywords: [['air conditioner', 'heat pump'], ['install', 'replace', 'repair']],
      description: 'AC/heat pump installation'
    },
    required: {
      keywords: ['refrigerant line', 'line set', 'refrigerant'],
      description: 'Refrigerant lines'
    },
    missingItem: 'Refrigerant lines/line set',
    reason: 'Air conditioning systems require refrigerant lines between units.',
    priority: 'critical'
  },
  
  // FLOORING
  {
    category: 'Flooring',
    trigger: {
      keywords: [['flooring', 'tile', 'hardwood', 'carpet'], ['install', 'replace', 'repair']],
      description: 'Flooring installation'
    },
    required: {
      keywords: ['subfloor', 'underlayment', 'floor prep', 'leveling'],
      description: 'Subfloor preparation'
    },
    missingItem: 'Subfloor preparation/underlayment',
    reason: 'Flooring installation requires proper subfloor preparation.',
    priority: 'critical'
  },
  {
    category: 'Flooring',
    trigger: {
      keywords: [['tile'], ['install', 'replace', 'repair']],
      description: 'Tile installation'
    },
    required: {
      keywords: ['grout', 'tile grout'],
      description: 'Grout'
    },
    missingItem: 'Tile grout',
    reason: 'Tile installation requires grout to fill joints.',
    priority: 'critical'
  },
  {
    category: 'Flooring',
    trigger: {
      keywords: [['carpet'], ['install', 'replace', 'repair']],
      description: 'Carpet installation'
    },
    required: {
      keywords: ['carpet pad', 'padding', 'underlayment'],
      description: 'Carpet padding'
    },
    missingItem: 'Carpet padding/underlayment',
    reason: 'Carpet requires padding for comfort and longevity.',
    priority: 'critical'
  },
  
  // WINDOWS & DOORS
  {
    category: 'Windows',
    trigger: {
      keywords: [['window'], ['install', 'replace', 'repair']],
      description: 'Window installation'
    },
    required: {
      keywords: ['flashing', 'window flashing', 'head flashing'],
      description: 'Window flashing'
    },
    missingItem: 'Window flashing',
    reason: 'Windows require flashing to prevent water intrusion.',
    priority: 'critical'
  },
  {
    category: 'Windows',
    trigger: {
      keywords: [['window'], ['install', 'replace', 'repair']],
      description: 'Window installation'
    },
    required: {
      keywords: ['caulk', 'sealant', 'window seal', 'weather seal'],
      description: 'Caulk/sealant'
    },
    missingItem: 'Window caulk/sealant',
    reason: 'Windows require caulking/sealant for weatherproofing.',
    priority: 'critical'
  },
  {
    category: 'Doors',
    trigger: {
      keywords: [['door'], ['install', 'replace', 'repair']],
      description: 'Door installation'
    },
    required: {
      keywords: ['hardware', 'door hardware', 'hinges', 'lockset', 'handle'],
      description: 'Door hardware'
    },
    missingItem: 'Door hardware (hinges, lockset, handle)',
    reason: 'Doors require hardware for operation.',
    priority: 'critical'
  },
  
  // SIDING & EXTERIOR
  {
    category: 'Siding',
    trigger: {
      keywords: [['siding'], ['install', 'replace', 'repair']],
      description: 'Siding installation'
    },
    required: {
      keywords: ['underlayment', 'wrvb', 'house wrap', 'building paper'],
      description: 'Underlayment/weather barrier'
    },
    missingItem: 'Siding underlayment/weather barrier',
    reason: 'Siding requires underlayment for moisture protection.',
    priority: 'critical'
  },
  {
    category: 'Siding',
    trigger: {
      keywords: [['siding'], ['install', 'replace', 'repair']],
      description: 'Siding installation'
    },
    required: {
      keywords: ['flashing', 'corner flashing', 'j-channel'],
      description: 'Siding flashing'
    },
    missingItem: 'Siding flashing',
    reason: 'Siding requires flashing at corners and penetrations.',
    priority: 'critical'
  },
  
  // WATER DAMAGE RESTORATION
  {
    category: 'Water Damage',
    trigger: {
      keywords: [['water damage', 'water loss', 'flood'], ['restore', 'restoration', 'repair']],
      description: 'Water damage restoration'
    },
    required: {
      keywords: ['demolition', 'demo', 'remove', 'tear out'],
      description: 'Demolition'
    },
    missingItem: 'Demolition of damaged materials',
    reason: 'Water damage requires removal of affected materials.',
    priority: 'critical'
  },
  {
    category: 'Water Damage',
    trigger: {
      keywords: [['water damage', 'water loss', 'flood'], ['restore', 'restoration', 'repair']],
      description: 'Water damage restoration'
    },
    required: {
      keywords: ['dehumidifier', 'air mover', 'drying equipment'],
      description: 'Drying equipment'
    },
    missingItem: 'Drying equipment and services',
    reason: 'Water damage requires professional drying to prevent mold.',
    priority: 'critical'
  },
]

export interface CheckDependenciesOptions {
  additionalRules?: DependencyRule[]
  synonyms?: Record<string, string[]>
}

/**
 * Check all dependency rules against line items.
 * Optional: additionalRules (user-taught) and synonyms (merged with built-in) for matching.
 */
export function checkDependencies(
  lineItems: Array<{ description?: string; item?: string; code?: string }>,
  options?: CheckDependenciesOptions
): Array<{
  requiredItem: string
  reason: string
  priority: 'critical' | 'minor'
  relatedItemsFound?: string[]
  category: string
  confidence?: number
}> {
  const missing: Array<{
    requiredItem: string
    reason: string
    priority: 'critical' | 'minor'
    relatedItemsFound?: string[]
    category: string
    confidence?: number
  }> = []

  const rules = dependencyRules.concat(options?.additionalRules || [])
  const synonyms = options?.synonyms || keywordSynonyms

  // Normalize all item texts
  const itemTexts = lineItems.map((item) => {
    const description = item.description || item.item || ''
    const code = item.code ? ` (${item.code})` : ''
    return `${description}${code}`.trim()
  })
  const normalizedItems = itemTexts.map((text) => text.toLowerCase())

  // Check each rule
  for (const rule of rules) {
    // Check if trigger conditions are met
    const triggerMatches = rule.trigger.keywords.every((keywordGroup) =>
      keywordGroup.some((keyword) =>
        normalizedItems.some((item) => item.includes(keyword.toLowerCase()))
      )
    )

    if (!triggerMatches) {
      continue // Rule doesn't apply
    }
    
    // Check for exclusion keywords (e.g., "drywall per lf" excludes tape/texture rules)
    if (rule.trigger.excludeKeywords) {
      const hasExclusion = rule.trigger.excludeKeywords.some((excludeGroup) =>
        excludeGroup.every((excludeKeyword) =>
          normalizedItems.some((item) => item.includes(excludeKeyword.toLowerCase()))
        )
      )
      if (hasExclusion) {
        continue // Rule excluded (e.g., "drywall per lf" is present, so don't flag tape/texture)
      }
    }
    
    // Check for excludeIf conditions (e.g., don't flag paint if wall/ceiling calculations exist)
    if (rule.excludeIf) {
      const hasExcludeCondition = rule.excludeIf.keywords.some((excludeGroup) =>
        excludeGroup.every((excludeKeyword) =>
          normalizedItems.some((item) => item.includes(excludeKeyword.toLowerCase()))
        )
      )
      if (hasExcludeCondition) {
        continue // Rule excluded based on condition
      }
    }

    // Check if required items are present (using improved matching with synonyms)
    const hasRequired = itemExists(lineItems, rule.required.keywords, synonyms)

    if (!hasRequired) {
      // Check if this item should be excluded based on context
      if (shouldExcludeItem(lineItems, rule.missingItem, rule.category)) {
        continue // Skip this rule
      }
      
      // Get confidence score for this missing item
      const confidence = getMissingItemConfidence(
        lineItems,
        rule.trigger.keywords,
        rule.required.keywords,
        rule.category
      )
      
      // Only flag items with high confidence (reduce false positives for everyday estimates)
      if (confidence < 0.6) {
        continue // Skip low-confidence items
      }
      
      // Missing required item - find related items that are actually in the same category/trade
      // Only show items that are STRICTLY related to the category of the missing item
      const categoryKeywords: Record<string, string[]> = {
        'Roofing': ['roof', 'shingle', 'gutter', 'downspout', 'flashing', 'drip edge', 'ventilation', 'ridge', 'valley', 'eave', 'soffit', 'fascia', 'roofing', 'roof repair', 'roof replace'],
        'Plumbing': ['plumb', 'pipe', 'fixture', 'toilet', 'sink', 'faucet', 'shower', 'tub', 'drain', 'waste', 'water line', 'valve', 'supply line', 'p-trap', 'trap', 'plumbing'],
        'Electrical': ['electrical', 'wire', 'wiring', 'circuit', 'breaker', 'outlet', 'switch', 'panel', 'ground', 'junction box', 'conduit', 'electrical work'],
        'HVAC': ['hvac', 'furnace', 'air conditioner', 'heat pump', 'duct', 'vent', 'register', 'refrigerant', 'thermostat', 'hvac system'],
        'Flooring': ['floor', 'tile', 'carpet', 'hardwood', 'subfloor', 'underlayment', 'grout', 'padding', 'flooring'],
        'Drywall': ['drywall', 'sheetrock', 'tape', 'mud', 'texture', 'joint compound', 'drywall repair', 'drywall install'],
        'Windows': ['window', 'glazing', 'sash', 'window frame', 'casement', 'double hung', 'window install', 'window replace'],
        'Doors': ['door', 'entry door', 'interior door', 'exterior door', 'door slab', 'door jamb', 'door install', 'door replace'],
        'Siding': ['siding', 'exterior siding', 'cladding', 'lap siding', 'siding board'],
        'Water Damage': ['water damage', 'flood', 'moisture', 'mold', 'drying', 'dehumidifier', 'water mitigation'],
        'Foundation': ['foundation', 'concrete foundation', 'slab', 'footing', 'basement foundation'],
      }
      
      const categoryKeywordsList = categoryKeywords[rule.category] || []
      
      // Find items that match the category keywords (most relevant)
      // Use stricter matching - must contain category-specific terms, not generic ones
      const relatedItems = itemTexts
        .map((text, idx) => ({ text, idx, normalized: normalizedItems[idx], item: lineItems[idx] }))
        .filter(({ normalized, item }) => {
          // Must match at least one category keyword
          const matchesCategory = categoryKeywordsList.some((keyword) =>
            normalized.includes(keyword.toLowerCase())
          )
          
          // Exclude generic items that might match by accident
          const excludePatterns = [
            'project manager',
            'schedule',
            'coordinate',
            'oversee',
            'jobsite',
            'policyholder',
            'repair period',
            'minimum charge',
            'labor and material',
            'manage project',
            'deadline',
          ]
          
          const isGeneric = excludePatterns.some((pattern) =>
            normalized.includes(pattern.toLowerCase())
          )
          
          // Use Xactimate lookup to check if item has matching category (if code is available)
          let categoryMatches = false
          if (item.code) {
            try {
              const { findByCode } = require('./xactimate-lookup')
              const xactItem = findByCode(item.code.toString().trim())
              if (xactItem && xactItem.category) {
                const ruleCategoryCode = rule.category.substring(0, 3).toUpperCase() // e.g., "Roofing" -> "ROO"
                const itemCategoryCode = xactItem.category.substring(0, 3).toUpperCase()
                categoryMatches = itemCategoryCode === ruleCategoryCode || 
                                  xactItem.category.toUpperCase().includes(ruleCategoryCode)
              }
            } catch (e) {
              // Xactimate lookup not available, continue without category check
            }
          }
          
          return matchesCategory && !isGeneric
        })
        .map(({ text }) => text)
        .slice(0, 3) // Limit to 3 most relevant items

      missing.push({
        requiredItem: rule.missingItem,
        reason: rule.reason,
        priority: rule.priority,
        relatedItemsFound: relatedItems.length > 0 ? relatedItems : undefined,
        category: rule.category,
        confidence: confidence,
      })
    }
  }

  return missing
}

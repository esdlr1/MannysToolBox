// Scope Check — rule shapes, the deterministic evaluator, and the seed set.
// Design: docs/estimate-comparison-redesign.md (addendum).
//
// Rules are data with provenance. Only `approved` rules ever fire; `proposed`
// ones wait for review in Rule Studio. The evaluator is pure code: a rule
// triggers per room when a trigger matches a line item, and each companion
// missing from that room becomes a recommendation. Suggested quantities are
// computed from the room's parsed sketch surfaces — never guessed.
import {
  ParsedDocument,
  ParsedLineItem,
  RoomDimensions,
  SurfaceBasis,
} from '../estimate-engine'

export interface RuleTrigger {
  /** Canonical catalog codes (matched against resolved item codes). */
  codes?: string[]
  /** Trade categories (matched against resolved categories). */
  categories?: string[]
  /** Lowercase substrings matched against item descriptions. */
  keywords?: string[]
  /** Keywords that must NOT be present for the trigger to count. */
  excludeKeywords?: string[]
}

export interface RuleCompanion {
  /** What's missing, in plain words (shown in the report). */
  label: string
  /** Presence checks: any keyword hit or code hit in the room satisfies it. */
  keywords: string[]
  codes?: string[]
  /** Sketch surface to compute the suggested quantity from, if applicable. */
  qtyBasis?: SurfaceBasis
  unit?: string
}

export interface ScopeRuleDef {
  name: string
  trigger: RuleTrigger
  companions: RuleCompanion[]
  priority: 'critical' | 'minor'
  source: 'seeded' | 'mined' | 'ai-drafted' | 'manual'
  status: 'proposed' | 'approved' | 'muted'
  reason: string
}

export interface ScopeRecommendation {
  room: string
  ruleName: string
  priority: 'critical' | 'minor'
  missing: string
  reason: string
  /** Description of the item that triggered the rule. */
  triggeredBy: string
  /** Stable key of the trigger item, for "doesn't apply" dismissals. */
  triggerKey: string
  suggestedQty: number | null
  suggestedUnit: string | null
}

/**
 * Seed rules. The drywall set comes from ESTIMATE_AUDIT_RULES.md and the
 * water set from lib/xactimate-dependency-builder.ts — both shipped in the
 * old audit tool, so they start approved. The rest are AI-drafted candidates
 * that stay `proposed` until approved in Rule Studio.
 */
export const SEED_RULES: ScopeRuleDef[] = [
  {
    name: 'drywall-replacement-needs-finishing',
    trigger: {
      keywords: ['drywall', 'sheetrock', 'gypsum'],
      // 'per lf': Xactimate's per-LF drywall repair items (e.g. 1/2" drywall
      // per LF - up to 2'/4' tall) already include tape, finish, and texture
      // (taught by Manny, 2026-07-15 — Jordan Crawley false positive).
      excludeKeywords: ['taped', 'ready for paint', 'texture', 'labor minimum', 'per lf'],
    },
    companions: [
      { label: 'Drywall tape & joint compound (finish)', keywords: ['tape', 'mud', 'joint compound', 'taped'] },
      { label: 'Drywall texture (match existing)', keywords: ['texture', 'orange peel', 'knockdown'] },
    ],
    priority: 'critical',
    source: 'seeded',
    status: 'approved',
    reason: 'Replaced drywall must be taped, mudded, and textured to match existing finish.',
  },
  {
    name: 'drywall-replacement-needs-paint',
    trigger: { keywords: ['drywall', 'sheetrock', 'gypsum'], excludeKeywords: ['labor minimum'] },
    companions: [
      {
        label: 'Prime/seal then paint repaired surfaces',
        keywords: ['paint', 'prime', 'primer', 'seal'],
        qtyBasis: 'walls',
        unit: 'SF',
      },
    ],
    priority: 'critical',
    source: 'seeded',
    status: 'approved',
    reason: 'New drywall needs primer/sealer and a finish coat.',
  },
  {
    name: 'water-loss-needs-mitigation',
    trigger: { keywords: ['water extraction', 'flood cut', 'antimicrobial', 'dehumidifier', 'air mover'] },
    companions: [
      { label: 'Drying equipment (air movers / dehumidifier)', keywords: ['air mover', 'dehumidifier', 'drying'] },
      { label: 'Antimicrobial treatment', keywords: ['antimicrobial', 'anti-microbial', 'biocide'] },
    ],
    priority: 'critical',
    source: 'seeded',
    status: 'approved',
    reason: 'Water losses require drying equipment and antimicrobial treatment.',
  },
  {
    name: 'baseboard-removal-needs-refinish',
    trigger: { keywords: ['baseboard'], excludeKeywords: ['paint', 'stain', 'seal'] },
    companions: [
      {
        label: 'Paint or stain & finish baseboard',
        keywords: ['paint baseboard', 'stain', 'seal & paint base', 'finish base'],
        qtyBasis: 'floor_perimeter',
        unit: 'LF',
      },
    ],
    priority: 'minor',
    source: 'ai-drafted',
    status: 'proposed',
    reason: 'Replaced baseboard is normally painted or stained to match.',
  },
  {
    name: 'shingle-roof-needs-accessories',
    trigger: { keywords: ['shingle'], excludeKeywords: ['ridge', 'starter'] },
    companions: [
      { label: 'Drip edge / gutter apron', keywords: ['drip edge', 'gutter apron'] },
      { label: 'Roofing felt / underlayment', keywords: ['felt', 'underlayment', 'ice & water'] },
      { label: 'Ridge cap', keywords: ['ridge cap', 'hip/ridge', 'hip / ridge'] },
      { label: 'Starter course', keywords: ['starter'] },
    ],
    priority: 'critical',
    source: 'ai-drafted',
    status: 'proposed',
    reason: 'Shingle replacement normally includes underlayment, drip edge, starter, and ridge cap.',
  },
  {
    name: 'tile-floor-needs-mortar-bed',
    trigger: { keywords: ['tile floor'] },
    companions: [{ label: 'Mortar bed / thinset for tile', keywords: ['mortar', 'thinset'] }],
    priority: 'critical',
    source: 'ai-drafted',
    status: 'proposed',
    reason: 'Tile floor covering requires a mortar bed or thinset line.',
  },
]

function normalized(text: string): string {
  return text.toLowerCase()
}

/** Stable identity for a trigger item: catalog code, else normalized text. */
export function triggerKeyFor(item: ParsedLineItem): string {
  return item.catalog?.code ?? item.description.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)
}

/** Key under which a specific finding can be dismissed ("doesn't apply"). */
export function dismissalKey(ruleName: string, triggerKey: string, companionLabel: string): string {
  return `${ruleName}::${triggerKey}::${companionLabel}`
}

export function itemMatchesTrigger(item: ParsedLineItem, trigger: RuleTrigger): boolean {
  const description = normalized(item.description)
  if (trigger.excludeKeywords?.some((k) => description.includes(k))) return false
  if (trigger.codes?.some((code) => item.catalog?.code === code)) return true
  if (trigger.categories?.some((cat) => item.catalog?.category === cat)) return true
  return trigger.keywords?.some((k) => description.includes(k)) ?? false
}

export function companionPresent(items: ParsedLineItem[], companion: RuleCompanion): boolean {
  return items.some((item) => {
    if (companion.codes?.some((code) => item.catalog?.code === code)) return true
    const description = normalized(item.description)
    return companion.keywords.some((k) => description.includes(k))
  })
}

function suggestedQty(basis: SurfaceBasis | undefined, dims: RoomDimensions | null): number | null {
  if (!basis || !dims) return null
  const value: number | null = {
    walls: dims.wallsSf,
    ceiling: dims.ceilingSf,
    floor: dims.floorSf,
    walls_ceiling: dims.wallsCeilingSf,
    flooring_sy: dims.flooringSy,
    floor_perimeter: dims.floorPerimeterLf,
    ceiling_perimeter: dims.ceilingPerimeterLf,
  }[basis]
  return value
}

/**
 * Evaluate rules against a parsed, enriched document. Room-scoped: a rule
 * fires in each room where a trigger item exists and a companion is absent.
 */
export function evaluateScopeRules(
  doc: ParsedDocument,
  rules: ScopeRuleDef[],
  /** dismissalKey() strings the user has marked "doesn't apply". */
  dismissed: Set<string> = new Set()
): ScopeRecommendation[] {
  const active = rules.filter((rule) => rule.status === 'approved')
  const dimsByRoom = new Map(doc.rooms.map((room) => [room.name, room.dimensions ?? null]))
  const itemsByRoom = new Map<string, ParsedLineItem[]>()
  for (const item of doc.lineItems) {
    const list = itemsByRoom.get(item.room)
    if (list) list.push(item)
    else itemsByRoom.set(item.room, [item])
  }

  const recommendations: ScopeRecommendation[] = []
  for (const [room, items] of itemsByRoom) {
    for (const rule of active) {
      const triggerItem = items.find((item) => itemMatchesTrigger(item, rule.trigger))
      if (!triggerItem) continue
      const triggerKey = triggerKeyFor(triggerItem)
      for (const companion of rule.companions) {
        if (companionPresent(items, companion)) continue
        if (dismissed.has(dismissalKey(rule.name, triggerKey, companion.label))) continue
        recommendations.push({
          room,
          ruleName: rule.name,
          priority: rule.priority,
          missing: companion.label,
          reason: rule.reason,
          triggeredBy: triggerItem.description,
          triggerKey,
          suggestedQty: suggestedQty(companion.qtyBasis, dimsByRoom.get(room) ?? null),
          suggestedUnit: companion.unit ?? null,
        })
      }
    }
  }
  return recommendations
}

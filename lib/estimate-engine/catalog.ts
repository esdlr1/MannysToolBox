// Catalog enrichment: resolve parsed descriptions against the 13k-item
// Xactimate catalog (lib/xactimate-line-items.json) and attribute quantities
// to sketch surfaces.
//
// Final Draft PDFs print descriptions without CAT/SEL codes. Recovering the
// code turns fuzzy description matching between two estimates into exact
// code matching, and the catalog's category/unit add trade rollups and a
// per-item sanity check. Quantities in Xactimate come from sketch variables
// (F/C/W...); floor and ceiling SF are usually identical, so the description
// word ("ceiling", "floor") is what disambiguates which surface was used.
import { getAllLineItems } from '../xactimate-lookup'
import {
  CatalogResolution,
  ItemAction,
  ParsedDocument,
  ParsedLineItem,
  RoomDimensions,
  SurfaceBasis,
} from './types'

/** Leading action phrases, longest first; they wrap a base catalog item. */
// Symbility prints actions with a dash ("Replace - Carpet Pad"); Xactimate
// without ("R&R Baseboard") — the optional "-" covers both.
const ACTION_PREFIXES: { re: RegExp; action: ItemAction }[] = [
  { re: /^remove\s*&\s*replace\s*-?\s+/i, action: 'remove_replace' },
  { re: /^r&r\s*-?\s+/i, action: 'remove_replace' },
  { re: /^detach\s*&\s*reset\s*-?\s+/i, action: 'detach_reset' },
  { re: /^material only\s*-?\s+/i, action: 'material_only' },
  { re: /^remove\s*-?\s+/i, action: 'remove' },
  { re: /^replace\s*-?\s+/i, action: 'replace' },
  { re: /^install\s*-?\s+/i, action: 'install' },
]

/** "Supplement 2 -" style tags estimators prepend; not part of the item. */
const SUPPLEMENT_TAG_RE = /^(install\s+)?supplement\s*\d*\s*-\s*/i

interface CatalogIndex {
  /** normalized full description → entries (usually one). */
  byDescription: Map<string, { code: string; category: string | null; unit: string | null }[]>
}

let cachedIndex: CatalogIndex | null = null

function catalogIndex(): CatalogIndex {
  if (cachedIndex) return cachedIndex
  const byDescription: CatalogIndex['byDescription'] = new Map()
  for (const item of getAllLineItems()) {
    const key = normalizeDescription(item.description)
    if (key.length === 0) continue
    const entry = {
      code: item.code,
      category: item.category ?? null,
      unit: item.unit?.toUpperCase() ?? null,
    }
    const list = byDescription.get(key)
    if (list) list.push(entry)
    else byDescription.set(key, [entry])
  }
  cachedIndex = { byDescription }
  return cachedIndex
}

/** Canonical form for description comparison across PDFs and the catalog. */
export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+and\s+/g, ' & ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[,.]+$/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split an estimate description into its action prefix and base item text. */
export function splitAction(description: string): { action: ItemAction | null; base: string } {
  let base = description.replace(SUPPLEMENT_TAG_RE, '')
  for (const { re, action } of ACTION_PREFIXES) {
    if (re.test(base)) return { action, base: base.replace(re, '') }
  }
  return { action: null, base }
}

/**
 * Resolve a printed description to a catalog entry. Tries the full text and
 * the action-stripped base, each by longest token-prefix: printed lines often
 * carry trailing junk (depreciation condition "Avg. 16.00%", estimator notes,
 * a swallowed group header), while the true catalog item is always a prefix.
 * Ambiguous keys (several codes sharing one normalized description) resolve
 * only if all candidates agree on the code.
 */
export function resolveDescription(description: string): {
  action: ItemAction | null
  resolution: CatalogResolution | null
} {
  const { action, base } = splitAction(description)
  const index = catalogIndex()

  const full = lookupByPrefix(index, description)
  if (full) {
    return { action, resolution: { ...full.entry, method: full.complete ? 'exact' : 'fuzzy' } }
  }

  const stripped = lookupByPrefix(index, base)
  if (stripped) {
    return {
      action,
      resolution: { ...stripped.entry, method: stripped.complete ? 'action-stripped' : 'fuzzy' },
    }
  }

  return { action, resolution: null }
}

/** Longest catalog match on a token-prefix of the text (min 5 chars). */
function lookupByPrefix(
  index: CatalogIndex,
  text: string
): { entry: Omit<CatalogResolution, 'method'>; complete: boolean } | null {
  const tokens = normalizeDescription(text).split(' ')
  for (let end = tokens.length; end >= 1; end--) {
    const key = tokens.slice(0, end).join(' ')
    if (key.length < 5) break
    const entry = lookupUnambiguous(index, key)
    if (entry) return { entry, complete: end === tokens.length }
  }
  return null
}

function lookupUnambiguous(
  index: CatalogIndex,
  key: string
): Omit<CatalogResolution, 'method'> | null {
  const entries = index.byDescription.get(key)
  if (!entries || entries.length === 0) return null
  const code = entries[0].code
  if (!entries.every((e) => e.code === code)) return null
  return entries[0]
}

/** Surface named by the description's own words, if any. */
export function surfaceHintFromDescription(description: string): SurfaceBasis | null {
  const text = description.toLowerCase()
  if (/walls?\s*(&|and)\s*ceiling/.test(text)) return 'walls_ceiling'
  if (/\bceiling/.test(text)) return 'ceiling'
  if (/\bwalls?\b/.test(text)) return 'walls'
  if (/floor perimeter|baseboard|base shoe|quarter round|\bshoe molding/.test(text)) {
    return 'floor_perimeter'
  }
  if (/crown molding|cove molding|ceil\.? perimeter/.test(text)) return 'ceiling_perimeter'
  if (/\bfloor(ing)?\b/.test(text)) return 'floor'
  return null
}

/** True when a quantity equals a sketch measurement within print rounding. */
function matchesMeasure(quantity: number, measure: number | null): boolean {
  if (measure === null || measure === 0) return false
  return Math.abs(quantity - measure) <= Math.max(0.02, measure * 0.002)
}

/**
 * Attribute a quantity to the sketch surface it was calculated from.
 * When both floor and ceiling match (they usually do), the description's
 * surface word decides; without one the ambiguity is recorded as-is.
 */
export function attributeMeasurement(
  quantity: number,
  hint: SurfaceBasis | null,
  dims: RoomDimensions | null | undefined
): SurfaceBasis | 'floor_or_ceiling' | null {
  if (!dims) return null

  const candidates: SurfaceBasis[] = []
  if (matchesMeasure(quantity, dims.wallsSf)) candidates.push('walls')
  if (matchesMeasure(quantity, dims.ceilingSf)) candidates.push('ceiling')
  if (matchesMeasure(quantity, dims.floorSf)) candidates.push('floor')
  if (matchesMeasure(quantity, dims.wallsCeilingSf)) candidates.push('walls_ceiling')
  if (matchesMeasure(quantity, dims.flooringSy)) candidates.push('flooring_sy')
  if (matchesMeasure(quantity, dims.floorPerimeterLf)) candidates.push('floor_perimeter')
  if (matchesMeasure(quantity, dims.ceilingPerimeterLf)) candidates.push('ceiling_perimeter')

  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  if (hint && candidates.includes(hint)) return hint
  const floorCeiling =
    candidates.includes('floor') && candidates.includes('ceiling') && candidates.length === 2
  return floorCeiling ? 'floor_or_ceiling' : candidates[0]
}

/** Enrich every parsed item in place: action, catalog code, surface basis. */
export function enrichDocument(doc: ParsedDocument): void {
  const dimsByRoom = new Map(doc.rooms.map((room) => [room.name, room.dimensions ?? null]))
  for (const item of doc.lineItems) {
    enrichItem(item, dimsByRoom.get(item.room) ?? null)
  }
}

function enrichItem(item: ParsedLineItem, dims: RoomDimensions | null): void {
  const { action, resolution } = resolveDescription(item.description)
  const hint = surfaceHintFromDescription(item.description)
  item.action = action
  // A prefix (fuzzy) match that disagrees with the printed unit is a false
  // positive (e.g. "Wallpaper labor minimum" EA matching the SF wallpaper
  // item) — drop it. Complete matches keep the mismatch visible as a signal.
  const unitContradicts =
    resolution?.method === 'fuzzy' && resolution.unit !== null && resolution.unit !== item.unit
  item.catalog = unitContradicts ? null : resolution
  item.surfaceHint = hint
  item.measurementBasis = attributeMeasurement(item.quantity, hint, dims)
}

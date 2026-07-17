// Aggregated comparison view — how an estimator actually reads a diff.
//
// Estimates legitimately repeat items (bathroom + closet areas, mitigation
// visits). Line-by-line one-to-one matching then splits the story: one copy
// "matches", the rest look "missing", even though the real statement is
// "vinyl plank: mine 142.85 SF total vs carrier 54.94 SF". This module groups
// each side's lines by (room, item identity), sums quantities and money, and
// compares the groups — duplicates collapse, partial coverage becomes a
// quantity delta.
import { ParsedDocument, ParsedLineItem } from './types'
import { actionGroup, baseDescription, normalizeRoom } from './match'

export interface ActionMismatch {
  mine: AggregatedItem
  carrier: AggregatedItem
  /** actionGroup values, e.g. 'replace' vs 'install'. */
  mineAction: string
  carrierAction: string
}

export interface AggregatedItem {
  /** Printed line numbers contributing to this group (sorted). */
  lineNumbers: number[]
  /** First contributing line's number (UI/back-compat). */
  lineNumber: number
  room: string
  description: string
  quantity: number
  unit: string
  /** Per-unit cents derived from the group (rcv / qty for multi-line groups). */
  unitPriceCents: number
  rcvCents: number
  catalog: { code: string; category: string | null } | null
  /** Action class of the group (actionGroup value). */
  action: string
}

export interface AggregatedPair {
  mine: AggregatedItem
  carrier: AggregatedItem
  tier: 'room' | 'moved' | 'near'
  qtyDelta: number
  rcvDeltaCents: number
  unitPriceDeltaCents: number
}

const NEAR_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'per', 'from', 'only', 'coat', 'coats',
  'standard', 'grade', 'misc', 'one', 'two', 'each', 'high', 'install',
  'detach', 'reset', 'remove', 'replace', 'material',
])

/** Significant words of an item's description (≥4 chars, minus stopwords). */
function significantWords(item: AggregatedItem): Set<string> {
  return new Set(
    baseDescription(asLine(item))
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !NEAR_STOPWORDS.has(w))
  )
}

/**
 * Same physical item despite differing identity: same action class, room, and
 * unit, quantity within 5%, and the shorter description's significant words
 * are a subset of the longer's. Handles the case where one side resolved to a
 * catalog code and the other didn't, or a size suffix differs ("Quarter round"
 * vs "Quarter round - 3/4"") — taught by Manny, 2026-07-16.
 */
function nearSameItem(a: AggregatedItem, b: AggregatedItem): boolean {
  if (a.action !== b.action) return false
  if (normalizeRoom(a.room) !== normalizeRoom(b.room)) return false
  if (a.unit !== b.unit) return false
  const q = Math.max(a.quantity, b.quantity)
  if (q > 0 && Math.abs(a.quantity - b.quantity) / q > 0.05) return false
  const wa = significantWords(a)
  const wb = significantWords(b)
  if (wa.size === 0 || wb.size === 0) return false
  const [small, large] = wa.size <= wb.size ? [wa, wb] : [wb, wa]
  for (const w of small) if (!large.has(w)) return false
  return true
}

export interface AggregatedComparison {
  pairs: AggregatedPair[]
  mineOnly: AggregatedItem[]
  carrierOnly: AggregatedItem[]
  /**
   * Same item, same room, DIFFERENT action class — e.g. our full "Vanity"
   * (replace) vs carrier's "Install Vanity" (labor only). Scope differences,
   * not price differences (taught by Manny, 2026-07-16).
   */
  actionMismatches: ActionMismatch[]
}

export interface AggregateOptions {
  synonymCanon?: (desc: string) => string
  roomCanon?: (roomKey: string) => string
}

/** Item identity WITHOUT the action class (used to spot scope mismatches). */
function baseIdentity(item: ParsedLineItem, options: AggregateOptions): string {
  if (item.catalog) return `code::${item.catalog.code}`
  const desc = options.synonymCanon
    ? options.synonymCanon(baseDescription(item))
    : baseDescription(item)
  return `desc::${desc}`
}

/** Full identity: action classes never cross-match (different work & money). */
function itemKey(item: ParsedLineItem, options: AggregateOptions): string {
  return `${actionGroup(item)}::${baseIdentity(item, options)}`
}

function roomOf(item: ParsedLineItem, options: AggregateOptions): string {
  const key = normalizeRoom(item.room)
  return options.roomCanon ? options.roomCanon(key) : key
}

function buildGroups(
  doc: ParsedDocument,
  options: AggregateOptions
): Map<string, { room: string; items: ParsedLineItem[] }> {
  const groups = new Map<string, { room: string; items: ParsedLineItem[] }>()
  for (const item of doc.lineItems) {
    const key = `${roomOf(item, options)}::${itemKey(item, options)}`
    const group = groups.get(key)
    if (group) group.items.push(item)
    else groups.set(key, { room: roomOf(item, options), items: [item] })
  }
  return groups
}

function toAggregated(items: ParsedLineItem[]): AggregatedItem {
  const lineNumbers = items.map((i) => i.lineNumber).sort((a, b) => a - b)
  const quantity = Math.round(items.reduce((sum, i) => sum + i.quantity, 0) * 100) / 100
  const rcvCents = items.reduce((sum, i) => sum + i.rcvCents, 0)
  const first = items[0]
  return {
    lineNumbers,
    lineNumber: lineNumbers[0],
    room: first.room,
    description: first.description,
    quantity,
    unit: first.unit,
    unitPriceCents:
      items.length === 1
        ? first.unitPriceCents
        : quantity > 0
          ? Math.round(rcvCents / quantity)
          : first.unitPriceCents,
    rcvCents,
    catalog: first.catalog ? { code: first.catalog.code, category: first.catalog.category } : null,
    action: actionGroup(first),
  }
}

/**
 * Compare aggregated groups: same item in the same room first, then leftover
 * groups with the same identity in a different room ("moved").
 */
export function aggregateComparison(
  mine: ParsedDocument,
  carrier: ParsedDocument,
  options: AggregateOptions = {}
): AggregatedComparison {
  const mineGroups = buildGroups(mine, options)
  const carrierGroups = buildGroups(carrier, options)

  const pairs: AggregatedPair[] = []
  const usedCarrier = new Set<string>()

  const pushPair = (mineItems: ParsedLineItem[], carrierItems: ParsedLineItem[], tier: 'room' | 'moved') => {
    const m = toAggregated(mineItems)
    const c = toAggregated(carrierItems)
    pairs.push({
      mine: m,
      carrier: c,
      tier,
      qtyDelta: Math.round((m.quantity - c.quantity) * 100) / 100,
      rcvDeltaCents: m.rcvCents - c.rcvCents,
      unitPriceDeltaCents: m.unitPriceCents - c.unitPriceCents,
    })
  }

  // Tier 1: same room + same identity.
  const mineLeft: [string, { room: string; items: ParsedLineItem[] }][] = []
  for (const [key, group] of mineGroups) {
    const counterpart = carrierGroups.get(key)
    if (counterpart) {
      usedCarrier.add(key)
      pushPair(group.items, counterpart.items, 'room')
    } else {
      mineLeft.push([key, group])
    }
  }

  // Tier 2: same identity, different room (carriers restructure rooms).
  const carrierByIdentity = new Map<string, string[]>()
  for (const key of carrierGroups.keys()) {
    if (usedCarrier.has(key)) continue
    const identity = key.slice(key.indexOf('::') + 2)
    const list = carrierByIdentity.get(identity)
    if (list) list.push(key)
    else carrierByIdentity.set(identity, [key])
  }
  const mineOnly: AggregatedItem[] = []
  for (const [key, group] of mineLeft) {
    const identity = key.slice(key.indexOf('::') + 2)
    const candidates = carrierByIdentity.get(identity)
    const counterpartKey = candidates?.shift()
    if (counterpartKey) {
      usedCarrier.add(counterpartKey)
      pushPair(group.items, carrierGroups.get(counterpartKey)!.items, 'moved')
    } else {
      mineOnly.push(toAggregated(group.items))
    }
  }

  const carrierOnly: AggregatedItem[] = []
  for (const [key, group] of carrierGroups) {
    if (!usedCarrier.has(key)) carrierOnly.push(toAggregated(group.items))
  }

  // Near-match pass: pair leftover groups that are clearly the same item
  // (same action/room/unit, close quantity, description word-subset) even
  // when one side has a catalog code and the other doesn't, or a size suffix
  // differs. Otherwise same-item lines split into missing + carrier-only.
  const carrierNearTaken = new Set<AggregatedItem>()
  const mineAfterNear: AggregatedItem[] = []
  for (const m of mineOnly) {
    const c = carrierOnly.find((x) => !carrierNearTaken.has(x) && nearSameItem(m, x))
    if (c) {
      carrierNearTaken.add(c)
      pairs.push({
        mine: m,
        carrier: c,
        tier: 'near',
        qtyDelta: Math.round((m.quantity - c.quantity) * 100) / 100,
        rcvDeltaCents: m.rcvCents - c.rcvCents,
        unitPriceDeltaCents: m.unitPriceCents - c.unitPriceCents,
      })
    } else {
      mineAfterNear.push(m)
    }
  }
  const carrierAfterNear = carrierOnly.filter((x) => !carrierNearTaken.has(x))

  // Scope mismatches: leftover groups sharing room + base identity but a
  // different action class. Presented as their own category — the carrier
  // wrote a different scope of work for the same item.
  const actionMismatches: ActionMismatch[] = []
  const mineOnlyKept: AggregatedItem[] = []
  const carrierLeftByBase = new Map<string, AggregatedItem[]>()
  const baseOf = (item: AggregatedItem): string => {
    const identity = item.catalog
      ? `code::${item.catalog.code}`
      : `desc::${options.synonymCanon?.(baseDescription(asLine(item))) ?? baseDescription(asLine(item))}`
    return `${normalizeRoom(item.room)}::${identity}`
  }
  for (const item of carrierAfterNear) {
    const base = baseOf(item)
    const list = carrierLeftByBase.get(base)
    if (list) list.push(item)
    else carrierLeftByBase.set(base, [item])
  }
  const takenCarrier = new Set<AggregatedItem>()
  for (const item of mineAfterNear) {
    const candidates = carrierLeftByBase.get(baseOf(item))
    const counterpart = candidates?.find((c) => !takenCarrier.has(c) && c.action !== item.action)
    if (counterpart) {
      takenCarrier.add(counterpart)
      actionMismatches.push({
        mine: item,
        carrier: counterpart,
        mineAction: item.action,
        carrierAction: counterpart.action,
      })
    } else {
      mineOnlyKept.push(item)
    }
  }

  return {
    pairs,
    mineOnly: mineOnlyKept,
    carrierOnly: carrierAfterNear.filter((item) => !takenCarrier.has(item)),
    actionMismatches,
  }
}

/** Minimal line view of an aggregated item (for identity helpers). */
function asLine(item: AggregatedItem): ParsedLineItem {
  return {
    lineNumber: item.lineNumber,
    room: item.room,
    code: null,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    taxCents: 0,
    opCents: 0,
    rcvCents: item.rcvCents,
    depreciationCents: 0,
    acvCents: item.rcvCents,
  }
}

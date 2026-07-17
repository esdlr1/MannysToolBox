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
}

export interface AggregatedPair {
  mine: AggregatedItem
  carrier: AggregatedItem
  tier: 'room' | 'moved'
  qtyDelta: number
  rcvDeltaCents: number
  unitPriceDeltaCents: number
}

export interface AggregatedComparison {
  pairs: AggregatedPair[]
  mineOnly: AggregatedItem[]
  carrierOnly: AggregatedItem[]
}

export interface AggregateOptions {
  synonymCanon?: (desc: string) => string
  roomCanon?: (roomKey: string) => string
}

function itemKey(item: ParsedLineItem, options: AggregateOptions): string {
  if (item.catalog) return `code::${item.catalog.code}`
  const desc = options.synonymCanon
    ? options.synonymCanon(baseDescription(item))
    : baseDescription(item)
  return `desc::${actionGroup(item)}::${desc}`
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

  return { pairs, mineOnly, carrierOnly }
}

// Line-item matching between two parsed estimates (mine vs carrier's).
// Design: docs/estimate-comparison-redesign.md §5.
//
// Deterministic tiers, one-to-one greedy within each tier; every tier only
// sees items the previous tier didn't claim:
//   1. code-room         same canonical catalog code, same room
//   2. code              same code, room moved (labeled so rollups stay honest)
//   3. description-room  same normalized action-stripped description + room
//   4. description       same description, room moved
// Whatever remains is reported as mine-only / carrier-only. AI pairing
// suggestions (design tier 4) are a later, clearly-labeled layer — they never
// enter results as fact.
import { ParsedDocument, ParsedLineItem } from './types'
import { normalizeDescription, splitAction } from './catalog'

export type MatchTier = 'code-room' | 'code' | 'description-room' | 'description'

export interface MatchedPair {
  mine: ParsedLineItem
  carrier: ParsedLineItem
  tier: MatchTier
  qtyDelta: number
  rcvDeltaCents: number
  unitPriceDeltaCents: number
}

export interface MatchResult {
  pairs: MatchedPair[]
  mineOnly: ParsedLineItem[]
  carrierOnly: ParsedLineItem[]
  totals: {
    mineRcvCents: number
    carrierRcvCents: number
    /** mine − carrier; positive = carrier is light. */
    deltaRcvCents: number
  }
}

/** Room identity across documents: case/spacing-insensitive, instance-suffix free. */
export function normalizeRoom(room: string): string {
  return room
    .toLowerCase()
    .replace(/\s*\(#\d+\)$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function baseDescription(item: ParsedLineItem): string {
  return normalizeDescription(splitAction(item.description).base)
}

/**
 * Action compatibility class. R&R (remove AND replace) is different work —
 * and different money — from a remove-only or a detach & reset line, so
 * description-based matching must never pair across classes. Plain items,
 * installs, and replacements share one class (a bare Xactimate item implies
 * install/replace).
 */
export function actionGroup(item: ParsedLineItem): string {
  switch (splitAction(item.description).action) {
    case 'remove':
      return 'remove'
    case 'remove_replace':
      return 'rr'
    case 'detach_reset':
      return 'dr'
    default:
      return 'install'
  }
}

/**
 * Canonicalizer over user-confirmed description synonyms (learned from the
 * review queue): descriptions confirmed to mean the same item map to one
 * canonical string, so past confirmations auto-match in future comparisons.
 */
export function buildSynonymCanon(pairs: { a: string; b: string }[]): (desc: string) => string {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = x
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string
    return root
  }
  for (const { a, b } of pairs) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb)
  }
  return (desc) => find(desc)
}

export interface MatchOptions {
  /** Maps a normalized base description to its synonym-group canonical form. */
  synonymCanon?: (desc: string) => string
  /** Maps a normalized room key to its paired-room canonical key. */
  roomCanon?: (roomKey: string) => string
}

export function matchDocuments(
  mine: ParsedDocument,
  carrier: ParsedDocument,
  options: MatchOptions = {}
): MatchResult {
  const canon = options.synonymCanon ?? ((desc: string) => desc)
  const roomOf = (item: ParsedLineItem): string =>
    options.roomCanon ? options.roomCanon(normalizeRoom(item.room)) : normalizeRoom(item.room)
  const desc = (item: ParsedLineItem): string => canon(baseDescription(item))
  const tierKeys: { tier: MatchTier; key: (item: ParsedLineItem) => string | null }[] = [
    {
      tier: 'code-room',
      key: (item) => (item.catalog ? `${item.catalog.code}::${roomOf(item)}` : null),
    },
    { tier: 'code', key: (item) => item.catalog?.code ?? null },
    {
      tier: 'description-room',
      key: (item) => `${actionGroup(item)}::${desc(item)}::${roomOf(item)}`,
    },
    { tier: 'description', key: (item) => `${actionGroup(item)}::${desc(item)}` },
  ]

  const pairs: MatchedPair[] = []
  let mineLeft = [...mine.lineItems]
  let carrierLeft = [...carrier.lineItems]

  for (const { tier, key } of tierKeys) {
    const carrierByKey = new Map<string, ParsedLineItem[]>()
    for (const item of carrierLeft) {
      const k = key(item)
      if (k === null) continue
      const list = carrierByKey.get(k)
      if (list) list.push(item)
      else carrierByKey.set(k, [item])
    }

    const stillMine: ParsedLineItem[] = []
    const claimed = new Set<ParsedLineItem>()
    for (const item of mineLeft) {
      const k = key(item)
      const candidates = k === null ? undefined : carrierByKey.get(k)
      const match = candidates?.shift()
      if (!match) {
        stillMine.push(item)
        continue
      }
      claimed.add(match)
      pairs.push({
        mine: item,
        carrier: match,
        tier,
        qtyDelta: round2(item.quantity - match.quantity),
        rcvDeltaCents: item.rcvCents - match.rcvCents,
        unitPriceDeltaCents: item.unitPriceCents - match.unitPriceCents,
      })
    }
    mineLeft = stillMine
    carrierLeft = carrierLeft.filter((item) => !claimed.has(item))
  }

  const mineRcvCents = mine.lineItems.reduce((sum, item) => sum + item.rcvCents, 0)
  const carrierRcvCents = carrier.lineItems.reduce((sum, item) => sum + item.rcvCents, 0)

  return {
    pairs,
    mineOnly: mineLeft,
    carrierOnly: carrierLeft,
    totals: {
      mineRcvCents,
      carrierRcvCents,
      deltaRcvCents: mineRcvCents - carrierRcvCents,
    },
  }
}

/** Per-room rollup across both documents, keyed by normalized room name. */
export interface RoomRollup {
  room: string
  mineRcvCents: number
  carrierRcvCents: number
  deltaRcvCents: number
}

export function roomRollups(
  mine: ParsedDocument,
  carrier: ParsedDocument,
  options: { roomCanon?: (roomKey: string) => string; labels?: Map<string, string> } = {}
): RoomRollup[] {
  const rollups = new Map<string, RoomRollup>()
  const add = (items: ParsedLineItem[], side: 'mine' | 'carrier'): void => {
    for (const item of items) {
      const raw = normalizeRoom(item.room)
      const key = options.roomCanon ? options.roomCanon(raw) : raw
      let rollup = rollups.get(key)
      if (!rollup) {
        rollup = {
          room: options.labels?.get(key) ?? item.room,
          mineRcvCents: 0,
          carrierRcvCents: 0,
          deltaRcvCents: 0,
        }
        rollups.set(key, rollup)
      }
      if (side === 'mine') rollup.mineRcvCents += item.rcvCents
      else rollup.carrierRcvCents += item.rcvCents
    }
  }
  add(mine.lineItems, 'mine')
  add(carrier.lineItems, 'carrier')
  for (const rollup of rollups.values()) {
    rollup.deltaRcvCents = rollup.mineRcvCents - rollup.carrierRcvCents
  }
  return Array.from(rollups.values()).sort((a, b) => b.deltaRcvCents - a.deltaRcvCents)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

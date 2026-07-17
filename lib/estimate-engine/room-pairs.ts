// Room pairing across estimates — rooms renamed between documents
// ("Bedroom + Closet" vs "Bedroom") are identified deterministically:
//   1. Shared items: matched line items whose two sides live in
//      differently-named rooms are evidence those rooms correspond.
//   2. Geometry fingerprints: parsed sketch measurements (floor SF, walls SF,
//      perimeter) agreeing within tolerance corroborate or suggest a pair.
//   3. Learned aliases: user-confirmed pairs auto-merge forever.
// Confident pairs merge automatically (labeled "A ↔ B" in rollups) and
// upgrade matching; uncertain ones are suggested for one-click confirmation.
import { ParsedDocument, RoomDimensions } from './types'
import { MatchResult, normalizeRoom } from './match'

export interface RoomPairing {
  mineRoom: string
  carrierRoom: string
  sharedItems: number
  /** Human-readable geometry evidence, e.g. "floors both 136.0 SF". */
  geometry: string | null
  confidence: 'alias' | 'auto' | 'suggested'
}

interface RoomInfo {
  name: string
  key: string
  itemCount: number
  dims: RoomDimensions | null
}

function roomInfos(doc: ParsedDocument): Map<string, RoomInfo> {
  const infos = new Map<string, RoomInfo>()
  for (const room of doc.rooms) {
    const key = normalizeRoom(room.name)
    const existing = infos.get(key)
    if (existing) {
      existing.dims = existing.dims ?? room.dimensions ?? null
    } else {
      infos.set(key, { name: room.name, key, itemCount: 0, dims: room.dimensions ?? null })
    }
  }
  for (const item of doc.lineItems) {
    const info = infos.get(normalizeRoom(item.room))
    if (info) info.itemCount++
  }
  return infos
}

function within(a: number | null, b: number | null, pct: number): boolean {
  if (a === null || b === null || a <= 0 || b <= 0) return false
  return Math.abs(a - b) / Math.max(a, b) <= pct
}

function geometryEvidence(mine: RoomDimensions | null, carrier: RoomDimensions | null): string | null {
  if (!mine || !carrier) return null
  if (within(mine.floorSf, carrier.floorSf, 0.03)) {
    return `floors ${mine.floorSf!.toFixed(1)} / ${carrier.floorSf!.toFixed(1)} SF`
  }
  if (within(mine.wallsSf, carrier.wallsSf, 0.03)) {
    return `walls ${mine.wallsSf!.toFixed(1)} / ${carrier.wallsSf!.toFixed(1)} SF`
  }
  if (within(mine.floorPerimeterLf, carrier.floorPerimeterLf, 0.03)) {
    return `perimeters ${mine.floorPerimeterLf!.toFixed(1)} / ${carrier.floorPerimeterLf!.toFixed(1)} LF`
  }
  return null
}

/**
 * Infer room correspondences from match evidence + geometry + learned
 * aliases. One-to-one, cross-name only (same-named rooms already align).
 */
export function inferRoomPairs(
  mine: ParsedDocument,
  carrier: ParsedDocument,
  result: MatchResult,
  aliasPairs: { a: string; b: string }[]
): RoomPairing[] {
  const mineRooms = roomInfos(mine)
  const carrierRooms = roomInfos(carrier)
  const aliases = new Set(aliasPairs.map(({ a, b }) => (a < b ? `${a}::${b}` : `${b}::${a}`)))
  const isAlias = (m: string, c: string): boolean =>
    aliases.has(m < c ? `${m}::${c}` : `${c}::${m}`)

  // Shared-item counts per cross-name room pair.
  const shared = new Map<string, number>()
  for (const pair of result.pairs) {
    const m = normalizeRoom(pair.mine.room)
    const c = normalizeRoom(pair.carrier.room)
    if (m === c) continue
    const key = `${m}::${c}`
    shared.set(key, (shared.get(key) ?? 0) + 1)
  }

  interface Candidate {
    m: RoomInfo
    c: RoomInfo
    count: number
    geometry: string | null
    alias: boolean
  }
  const candidates: Candidate[] = []
  for (const m of mineRooms.values()) {
    for (const c of carrierRooms.values()) {
      if (m.key === c.key) continue
      const count = shared.get(`${m.key}::${c.key}`) ?? 0
      const geometry = geometryEvidence(m.dims, c.dims)
      const alias = isAlias(m.key, c.key)
      if (count === 0 && !geometry && !alias) continue
      candidates.push({ m, c, count, geometry, alias })
    }
  }
  candidates.sort((a, b) => Number(b.alias) - Number(a.alias) || b.count - a.count)

  const usedMine = new Set<string>()
  const usedCarrier = new Set<string>()
  const pairings: RoomPairing[] = []
  for (const cand of candidates) {
    if (usedMine.has(cand.m.key) || usedCarrier.has(cand.c.key)) continue
    // Don't pair a room away from an exact-name counterpart that exists.
    if (!cand.alias && (carrierRooms.has(cand.m.key) || mineRooms.has(cand.c.key))) continue

    let confidence: RoomPairing['confidence'] | null = null
    if (cand.alias) confidence = 'alias'
    else if (
      (cand.count >= 3 && cand.count * 2 >= Math.min(cand.m.itemCount, cand.c.itemCount)) ||
      (cand.count >= 2 && cand.geometry !== null)
    ) {
      confidence = 'auto'
    } else if (cand.count >= 2 || cand.geometry !== null) {
      confidence = 'suggested'
    }
    if (!confidence) continue

    usedMine.add(cand.m.key)
    usedCarrier.add(cand.c.key)
    pairings.push({
      mineRoom: cand.m.name,
      carrierRoom: cand.c.name,
      sharedItems: cand.count,
      geometry: cand.geometry,
      confidence,
    })
  }
  return pairings
}

/**
 * Canonicalizer for merged pairs (alias + auto): maps a carrier room key to
 * its mine-side partner so matching and rollups treat them as one room.
 */
export function buildRoomCanon(pairings: RoomPairing[]): (roomKey: string) => string {
  const map = new Map<string, string>()
  for (const pairing of pairings) {
    if (pairing.confidence === 'suggested') continue
    map.set(normalizeRoom(pairing.carrierRoom), normalizeRoom(pairing.mineRoom))
  }
  return (roomKey) => map.get(roomKey) ?? roomKey
}

/** Display label for a merged room ("Bedroom + Closet ↔ Bedroom"). */
export function pairedRoomLabels(pairings: RoomPairing[]): Map<string, string> {
  const labels = new Map<string, string>()
  for (const pairing of pairings) {
    if (pairing.confidence === 'suggested') continue
    labels.set(normalizeRoom(pairing.mineRoom), `${pairing.mineRoom} ↔ ${pairing.carrierRoom}`)
  }
  return labels
}

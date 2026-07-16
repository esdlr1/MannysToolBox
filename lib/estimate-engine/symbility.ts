// Deterministic parser for Symbility / Cotality (Claims Connect) estimates.
//
// Layout (from real carrier samples, e.g. Liberty Mutual):
//   Description Quantity Unit Price Per Total O&P Total Taxes RC Depreciation ACV
//   Bedroom                                 ← section header (unreliable)
//   2 Replace - Carpet Pad, Synthetic 142.82 $0.84 SF $24.00 $4.32 $148.29 $51.41 $96.88
//   Bedroom - Subtotal (12 items) $396.74 $55.56 $2,435.87 $525.59 $1,910.28
//   Floor Plan - Subtotal (66 items) ...    ← floorplan rollup (empty buffer)
// Money tokens carry explicit $ signs and a fixed order after the unit:
// O&P, Taxes, RC, Depreciation, ACV. Supplements can carry negative amounts.
// Same buffered-section strategy as the Xactimate parser: items belong to the
// next Subtotal row; a Subtotal with nothing buffered is a rollup and (at
// floorplan level) supplies the printed grand total. The reconciliation gate
// remains the authority on correctness.
import {
  ParsedDocument,
  ParsedLineItem,
  ParsedRoom,
  PdfPage,
  RoomDimensions,
  TextLine,
} from './types'

const SUBTOTAL_RE = /^(.+?)\s*-\s*Subtotal\s*\((\d+)\s*items?\)/i
const ITEM_START_RE = /^(\d+)\s+\S/
const MONEY_RE = /^\(?-?\$-?[\d,]+\.\d{2}\)?$/
const UNIT_RE = /^[A-Z]{1,4}\d?$/
const QTY_RE = /^-?[\d,]+(\.\d+)?$/

/** Lines that are never item content (headers, footers, recap sections). */
const NOISE_RE =
  /^(Description\s+Quantity|ESTIMATE:|FLOORPLAN:|In progress|Recap by|Total, all|MATERIALS|LABOR|Claim\s+\S+\s+Page|Length:|Walls:|Walls-subs|Doors:|Floor:|Windows:|Openings:|Missing Walls:|Perim)/i

const DIM_RES: { re: RegExp; key: keyof RoomDimensions }[] = [
  { re: /(?:^|\s)Walls:\s*([\d,]+\.?\d*)\s*SF/, key: 'wallsSf' },
  { re: /Ceiling:\s*([\d,]+\.?\d*)\s*SF/, key: 'ceilingSf' },
  { re: /Floor:\s*([\d,]+\.?\d*)\s*SF/, key: 'floorSf' },
  { re: /Perim \(F\):\s*([\d,]+\.?\d*)\s*LF/, key: 'floorPerimeterLf' },
  { re: /Perim \(C\):\s*([\d,]+\.?\d*)\s*LF/, key: 'ceilingPerimeterLf' },
]

interface ParserState {
  dims: RoomDimensions
  buffered: ParsedLineItem[]
  nameCounts: Map<string, number>
  rooms: ParsedRoom[]
  items: ParsedLineItem[]
  lastItem: ParsedLineItem | null
  grandRcvCents: number | null
  /** True once the bare estimate-level "Subtotal $..." row set the grand. */
  grandIsAuthoritative: boolean
  warnings: string[]
}

export function parseSymbility(pages: PdfPage[]): ParsedDocument {
  const state: ParserState = {
    dims: emptyDims(),
    buffered: [],
    nameCounts: new Map(),
    rooms: [],
    items: [],
    lastItem: null,
    grandRcvCents: null,
    grandIsAuthoritative: false,
    warnings: [],
  }

  for (const page of pages) {
    state.lastItem = null // page headers must not append to descriptions
    for (const line of page.lines) {
      consumeLine(state, line)
    }
  }
  flushBuffered(state, 'General', null)

  return {
    format: 'symbility',
    parseMethod: 'deterministic',
    rooms: state.rooms,
    lineItems: state.items,
    printedTotals: { grandRcvCents: state.grandRcvCents, grandAcvCents: null },
    warnings: state.warnings,
  }
}

function consumeLine(state: ParserState, line: TextLine): void {
  const text = line.text.trim()
  if (text.length === 0) return

  if (scanDims(state.dims, text)) {
    state.lastItem = null
    return
  }

  const subtotal = text.match(SUBTOTAL_RE)
  if (subtotal) {
    closeSection(state, subtotal[1].trim(), text)
    return
  }

  // Bare estimate-level grand: "Subtotal $o&p $tax $rc $deprec $acv" — the
  // authoritative total (includes sections outside the floorplan, e.g.
  // Minimum Charge Adjustments). First occurrence wins; recap tables later
  // in the document have different column counts and are ignored.
  if (/^Subtotal\s/.test(text) && !state.grandIsAuthoritative) {
    const money = text.split(/\s+/).filter((t) => MONEY_RE.test(t))
    if (money.length >= 5) {
      state.grandRcvCents = signedCents(money[2])
      state.grandIsAuthoritative = true
      state.lastItem = null
      return
    }
  }

  if (ITEM_START_RE.test(text) && tryParseItem(state, text)) return

  if (NOISE_RE.test(text)) {
    state.lastItem = null
    return
  }

  if (state.lastItem && isContinuation(text)) {
    state.lastItem.description = `${state.lastItem.description} ${text}`.trim()
  }
}

/**
 * Item row: <line#> <description...> <qty> <$unit price> <UNIT> then exactly
 * O&P, Taxes, RC, Depreciation, ACV as $-prefixed amounts.
 */
function tryParseItem(state: ParserState, text: string): boolean {
  const tokens = text.split(/\s+/)
  if (tokens.length < 8 || !/^\d+$/.test(tokens[0])) return false

  // Locate the unit-price token: first money token whose successor is a unit.
  let priceIdx = -1
  for (let i = 2; i < tokens.length - 5; i++) {
    if (MONEY_RE.test(tokens[i]) && UNIT_RE.test(tokens[i + 1] ?? '')) {
      priceIdx = i
      break
    }
  }
  if (priceIdx < 3) return false
  if (!QTY_RE.test(tokens[priceIdx - 1])) return false

  const tail = tokens.slice(priceIdx + 2).filter((t) => MONEY_RE.test(t))
  if (tail.length < 5) return false
  const [opCents, taxCents, rcvCents, depreciationCents, acvCents] = tail.slice(0, 5).map(signedCents)

  const item: ParsedLineItem = {
    lineNumber: Number.parseInt(tokens[0], 10),
    room: '',
    code: null,
    description: tokens.slice(1, priceIdx - 1).join(' '),
    quantity: Number.parseFloat(tokens[priceIdx - 1].replace(/,/g, '')),
    unit: tokens[priceIdx + 1].toUpperCase(),
    unitPriceCents: signedCents(tokens[priceIdx]),
    taxCents,
    opCents,
    rcvCents,
    depreciationCents,
    acvCents,
  }
  state.buffered.push(item)
  state.lastItem = item
  return true
}

function closeSection(state: ParserState, name: string, text: string): void {
  const money = text.split(/\s+/).filter((t) => MONEY_RE.test(t)).map(signedCents)
  const rcv = money.length >= 3 ? money[2] : null

  if (state.buffered.length === 0) {
    // Rollup (floorplan level): sums into the grand unless the bare
    // estimate-level Subtotal row has already set it authoritatively.
    if (rcv !== null && !state.grandIsAuthoritative) {
      state.grandRcvCents = (state.grandRcvCents ?? 0) + rcv
    }
    state.lastItem = null
    return
  }
  flushBuffered(state, name, rcv)
}

function flushBuffered(state: ParserState, name: string, printedRcvCents: number | null): void {
  if (state.buffered.length === 0 && printedRcvCents === null) return
  const count = (state.nameCounts.get(name.toLowerCase()) ?? 0) + 1
  state.nameCounts.set(name.toLowerCase(), count)
  const roomName = count === 1 ? name : `${name} (#${count})`
  state.rooms.push({ name: roomName, printedTotalRcvCents: printedRcvCents, dimensions: state.dims })
  for (const item of state.buffered) {
    item.room = roomName
    state.items.push(item)
  }
  state.buffered = []
  state.dims = emptyDims()
  state.lastItem = null
}

/** Signed money: "-$24.00", "$-24.00", "($24.00)" are all negative. */
function signedCents(token: string): number {
  const negative = token.includes('-') || token.startsWith('(')
  const value = Number.parseFloat(token.replace(/[($)\-,]/g, ''))
  const cents = Math.round(value * 100)
  return negative ? -cents : cents
}

function scanDims(dims: RoomDimensions, text: string): boolean {
  let found = false
  for (const { re, key } of DIM_RES) {
    const match = text.match(re)
    if (!match) continue
    const value = Number.parseFloat(match[1].replace(/,/g, ''))
    if (Number.isNaN(value)) continue
    dims[key] = (dims[key] ?? 0) + value
    found = true
  }
  return found
}

/**
 * Wrapped description / note text: words, no money, no feet-inch marks, no
 * page footers or dates. Single capitalized words are rejected — they're
 * group headers ("Cabinets", "Misc") that would pollute descriptions
 * (observed in production: "...Detach & reset MARI_BRAND 7/16/2026 Page: 5").
 */
function isContinuation(text: string): boolean {
  if (/\d\s*['"]/.test(text)) return false
  if (/Page:?\s*\d+/i.test(text)) return false
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) return false
  if (text.split(/\s+/).some((t) => MONEY_RE.test(t))) return false
  const words = text.split(/\s+/)
  if (words.length === 1 && /^[A-Z]/.test(text)) return false
  return /[a-z]/.test(text)
}

function emptyDims(): RoomDimensions {
  return {
    wallsSf: null,
    ceilingSf: null,
    floorSf: null,
    wallsCeilingSf: null,
    flooringSy: null,
    floorPerimeterLf: null,
    ceilingPerimeterLf: null,
  }
}

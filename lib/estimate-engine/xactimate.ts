// Deterministic parser for Xactimate PDF estimates (Final Draft style).
//
// First implementation targets the standard layout:
//   <Room name>                          ← section header
//   DESCRIPTION QUANTITY UNIT PRICE TAX O&P RCV DEPREC. ACV
//   1. R&R Laminated - comp. shingle rfg. - w/felt
//      34.33 SQ   291.74   112.02   903.11   10,015.44   (2,003.09)   8,012.35
//   ...
//   Totals: <Room name>   ...   10,015.44   2,003.09   8,012.35
//
// Column presence varies (O&P and depreciation can be absent depending on
// report settings), so numeric rows are interpreted from the right: the last
// columns are always ... RCV [DEPREC] [ACV]. The reconciliation gate
// (reconcile.ts) is the authority on whether this interpretation was correct.
// Golden-file samples drive refinement — see test-data/estimate-samples/.
import {
  ParsedDocument,
  ParsedLineItem,
  ParsedRoom,
  PdfPage,
  TextLine,
} from './types'
import { isMoneyToken, parseMoneyCents, parseQuantity, tokenize } from './numbers'

const ITEM_START_RE = /^(\d+)\.\s+(.+)$/
const ROOM_TOTALS_RE = /^Totals:\s+(.+?)(?:\s+[\d,().<>-]+)*$/
const CONTINUED_RE = /^CONTINUED\s*-\s*(.+)$/
const GRAND_TOTALS_RE = /^Line\s+Item\s+Totals?:/i
const UNIT_RE = /^(SQ|SF|LF|SY|CF|CY|EA|HR|DA|WK|MO|RM|LS|TN|ML|GL|BX|RL|PR|ST)$/i

/** Lines that look like headers/footers/dimension rows, never line-item content. */
const NOISE_RE =
  /^(DESCRIPTION|QUANTITY|UNIT|TAX|O&P|RCV|DEPREC|ACV|Height:|Missing Wall|Subroom:|Door|Window|Page:|Date:|\d+\/\d+\/\d+)/i

interface ParserState {
  currentRoom: string
  rooms: Map<string, ParsedRoom>
  items: ParsedLineItem[]
  pendingItem: { lineNumber: number; description: string } | null
  grandRcvCents: number | null
  warnings: string[]
}

export function parseXactimate(pages: PdfPage[]): ParsedDocument {
  const state: ParserState = {
    currentRoom: 'General',
    rooms: new Map(),
    items: [],
    pendingItem: null,
    grandRcvCents: null,
    warnings: [],
  }

  for (const page of pages) {
    for (const line of page.lines) {
      consumeLine(state, line)
    }
  }
  flushPendingItem(state)

  return {
    format: 'xactimate',
    parseMethod: 'deterministic',
    rooms: Array.from(state.rooms.values()),
    lineItems: state.items,
    printedTotals: { grandRcvCents: state.grandRcvCents, grandAcvCents: null },
    warnings: state.warnings,
  }
}

function consumeLine(state: ParserState, line: TextLine): void {
  const text = line.text.trim()
  if (text.length === 0) return

  const continued = text.match(CONTINUED_RE)
  if (continued) {
    state.currentRoom = continued[1].trim()
    ensureRoom(state, state.currentRoom)
    return
  }

  const roomTotals = text.match(ROOM_TOTALS_RE)
  if (roomTotals) {
    closeRoom(state, roomTotals[1].trim(), text)
    return
  }

  if (GRAND_TOTALS_RE.test(text)) {
    state.grandRcvCents = lastMoneyBefore(text, 3)
    return
  }

  const itemStart = text.match(ITEM_START_RE)
  if (itemStart) {
    beginItem(state, Number.parseInt(itemStart[1], 10), itemStart[2])
    return
  }

  if (state.pendingItem && tryCompleteItem(state, text)) return

  maybeStartRoom(state, text)
}

/** Record a warning for an item whose numeric row never arrived. */
function flushPendingItem(state: ParserState): void {
  if (!state.pendingItem) return
  state.warnings.push(
    `Line ${state.pendingItem.lineNumber} ("${state.pendingItem.description}") had no numeric row`
  )
  state.pendingItem = null
}

function beginItem(state: ParserState, lineNumber: number, rest: string): void {
  flushPendingItem(state)
  // Numbers can share the item's line; try to split description from numbers.
  const numericStart = findNumericTail(rest)
  const description = numericStart === -1 ? rest : rest.slice(0, numericStart).trim()
  state.pendingItem = { lineNumber, description }
  if (numericStart !== -1) {
    tryCompleteItem(state, rest.slice(numericStart).trim())
  }
}

/** Index where a trailing "qty UNIT money money ..." sequence begins, or -1. */
function findNumericTail(text: string): number {
  const match = text.match(/\s([\d,]+(?:\.\d+)?)\s+([A-Z]{2})\s+[\d,]+\.\d{2}\s/)
  if (match && match.index !== undefined && UNIT_RE.test(match[2])) {
    return match.index
  }
  return -1
}

/**
 * Interpret a numeric row for the pending item. Expected shape:
 *   <qty> <UNIT> <unit price> [tax] [O&P] <RCV> [(deprec)] [ACV]
 * Money columns are mapped from the right; missing optional columns get 0.
 */
function tryCompleteItem(state: ParserState, text: string): boolean {
  const pending = state.pendingItem
  if (!pending) return false

  const tokens = tokenize(text)
  if (tokens.length < 3) return appendDescription(state, text)

  const qty = parseQuantity(tokens[0])
  if (qty === null || !UNIT_RE.test(tokens[1] ?? '')) {
    return appendDescription(state, text)
  }

  const columns = mapMoneyColumns(tokens.slice(2))
  if (!columns) return appendDescription(state, text)

  state.items.push({
    lineNumber: pending.lineNumber,
    room: state.currentRoom,
    code: null, // Final Draft PDFs print descriptions only; codes come later via lookup.
    description: pending.description,
    quantity: qty,
    unit: tokens[1].toUpperCase(),
    ...columns,
  })
  ensureRoom(state, state.currentRoom)
  state.pendingItem = null
  return true
}

interface MoneyColumns {
  unitPriceCents: number
  taxCents: number
  opCents: number
  rcvCents: number
  depreciationCents: number
  acvCents: number
}

/**
 * Map the money tokens of a numeric row to named columns. Depreciation is
 * printed in parentheses/angle brackets; when present the row ends with
 * ... RCV (DEPREC) ACV, otherwise it ends with RCV. Whatever sits between
 * the unit price and RCV is tax and O&P (either may be absent).
 */
function mapMoneyColumns(tokens: string[]): MoneyColumns | null {
  const money = tokens.filter(isMoneyToken).map(parseMoneyCents)
  if (money.length < 2) return null

  const hasDeprec = tokens.some((t) => /^[(<]/.test(t))
  const rcvCents = hasDeprec ? money[money.length - 3] : money[money.length - 1]
  const middle = money.slice(1, hasDeprec ? money.length - 3 : money.length - 1)

  return {
    unitPriceCents: money[0],
    taxCents: middle[0] ?? 0,
    opCents: middle[1] ?? 0,
    rcvCents,
    depreciationCents: hasDeprec ? money[money.length - 2] : 0,
    acvCents: hasDeprec ? money[money.length - 1] : rcvCents,
  }
}

/** Multi-line descriptions: fold continuation text into the pending item. */
function appendDescription(state: ParserState, text: string): boolean {
  const pending = state.pendingItem
  if (!pending || NOISE_RE.test(text)) return false
  pending.description = `${pending.description} ${text}`.trim()
  return true
}

function maybeStartRoom(state: ParserState, text: string): void {
  if (NOISE_RE.test(text)) return
  if (state.pendingItem) return
  // Heuristic: a short line with no money tokens starts a new room section.
  const tokens = tokenize(text)
  if (tokens.length > 6 || tokens.some(isMoneyToken)) return
  if (/\d{3,}/.test(text)) return
  state.currentRoom = text
  ensureRoom(state, text)
}

function closeRoom(state: ParserState, roomName: string, fullText: string): void {
  const room = ensureRoom(state, roomName)
  const rcv = lastMoneyBefore(fullText, 3)
  if (rcv !== null) room.printedTotalRcvCents = rcv
  state.currentRoom = 'General'
}

function ensureRoom(state: ParserState, name: string): ParsedRoom {
  const existing = state.rooms.get(name)
  if (existing) return existing
  const room: ParsedRoom = { name, printedTotalRcvCents: null }
  state.rooms.set(name, room)
  return room
}

/**
 * The RCV figure in a totals row sits before optional DEPREC/ACV columns:
 * take the money token `fromEnd` positions from the right when that many
 * exist, otherwise the last one.
 */
function lastMoneyBefore(text: string, fromEnd: number): number | null {
  const money = tokenize(text).filter(isMoneyToken)
  if (money.length === 0) return null
  const idx = money.length >= fromEnd ? money.length - fromEnd : money.length - 1
  return parseMoneyCents(money[idx])
}

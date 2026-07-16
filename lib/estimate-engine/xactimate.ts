// Deterministic parser for Xactimate PDF estimates (Final Draft styles).
//
// Real-world Final Drafts vary: some print RCV/DEPREC./ACV columns, others
// (contractor style) RESET/REMOVE/REPLACE/TOTAL; any column may be empty on a
// given row. Key mechanisms:
//   1. Column calibration (columns.ts): label x-positions are read from each
//      header row and values are assigned to columns by position, not order.
//   2. Buffered section assignment: room header lines are unreliable (they
//      merge with sketch dimension text), but every line item appears before
//      its section's closing row. Items buffer until a close:
//        "Totals: X"  — always closes a room section.
//        "Total: X"   — closes an area section only if items are buffered;
//                       otherwise it is a rollup of already-closed rooms and
//                       is ignored.
//   3. SUPPLEMENT rows: items deferred to a supplement print the literal word
//      SUPPLEMENT instead of money columns; they parse as zero-dollar scope.
// The reconciliation gate (reconcile.ts) is the authority on correctness;
// golden samples in test-data/estimate-samples/ drive refinement.
import {
  ParsedDocument,
  ParsedLineItem,
  ParsedRoom,
  PdfPage,
  TextLine,
} from './types'
import { isMoneyToken, parseMoneyCents, parseQuantity, tokenize } from './numbers'
import {
  ColumnCalibration,
  XToken,
  assignMoneyToColumns,
  detectHeaderRow,
  tokensWithX,
} from './columns'

const ITEM_START_RE = /^(\d+)\.\s+/
const ROOM_TOTALS_RE = /^Totals:\s+(.+)$/
const AREA_TOTAL_RE = /^Total:\s+(.+)$/
const GRAND_TOTALS_RE = /^Line\s+Item\s+Totals?:/i
const UNIT_RE = /^(SQ|SF|LF|SY|CF|CY|EA|HR|DA|WK|MO|RM|LS|TN|ML|GL|BX|RL|PR|ST)$/i
const MONEY_TAIL_RE = /^[($<]*[\d,]+\.\d{2}[)>$]*$/

/** Header/footer/dimension rows that are never line-item content. */
const NOISE_RE =
  /^(DESCRIPTION|QUANTITY|UNIT|TAX|O&P|RCV|DEPREC|ACV|TOTAL|CONTINUED|Height:|Missing Wall|Subroom:|Door|Window|Page:|Date:|\d+\/\d+\/\d+)/i

/** Sketch/dimension text: feet-inch marks or area/length measure tokens. */
const DIMENSION_RE = /\d\s*['"]|\b(SF|LF|SY|SQ)\b/

interface ParserState {
  calibration: ColumnCalibration | null
  /** Items parsed since the last section close, awaiting a room name. */
  buffered: ParsedLineItem[]
  /** Occurrences per section name, for unique instance names. */
  nameCounts: Map<string, number>
  rooms: ParsedRoom[]
  items: ParsedLineItem[]
  pendingItem: { lineNumber: number; description: string } | null
  /** Last completed item, for wrapped description lines below its row. */
  lastItem: ParsedLineItem | null
  grandRcvCents: number | null
  warnings: string[]
}

export function parseXactimate(pages: PdfPage[]): ParsedDocument {
  const state: ParserState = {
    calibration: null,
    buffered: [],
    nameCounts: new Map(),
    rooms: [],
    items: [],
    pendingItem: null,
    lastItem: null,
    grandRcvCents: null,
    warnings: [],
  }

  for (const page of pages) {
    for (const line of page.lines) {
      consumeLine(state, line)
    }
  }
  flushPendingItem(state)
  flushBufferedItems(state, 'General', null)

  return {
    format: 'xactimate',
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

  const header = detectHeaderRow(line)
  if (header) {
    state.calibration = header
    state.lastItem = null
    return
  }

  if (GRAND_TOTALS_RE.test(text)) {
    state.grandRcvCents = totalsRowValue(state, line)
    state.lastItem = null
    return
  }

  const roomTotals = text.match(ROOM_TOTALS_RE)
  if (roomTotals) {
    closeSection(state, stripTrailingMoney(roomTotals[1]), line)
    return
  }

  const areaTotal = text.match(AREA_TOTAL_RE)
  if (areaTotal) {
    // An area's Total row is a rollup of already-closed rooms unless items
    // accumulated since the last close — then the area itself is the section.
    flushPendingItem(state)
    if (state.buffered.length > 0) {
      closeSection(state, stripTrailingMoney(areaTotal[1]), line)
    }
    state.lastItem = null
    return
  }

  const itemStart = text.match(ITEM_START_RE)
  if (itemStart) {
    beginItem(state, Number.parseInt(itemStart[1], 10), line)
    return
  }

  if (state.pendingItem) {
    if (tryCompleteItem(state, line)) return
    if (appendDescription(state, text)) return
    return
  }

  // Wrapped description text printed below an item's completed row.
  if (state.lastItem && isContinuationText(text)) {
    state.lastItem.description = `${state.lastItem.description} ${text}`.trim()
    return
  }
  state.lastItem = null
}

/** Close the current section: stamp buffered items and record printed total. */
function closeSection(state: ParserState, baseName: string, line: TextLine): void {
  flushPendingItem(state)
  const printed = totalsRowValue(state, line)
  flushBufferedItems(state, baseName, printed)
  state.lastItem = null
}

function flushBufferedItems(
  state: ParserState,
  baseName: string,
  printedRcvCents: number | null
): void {
  if (state.buffered.length === 0 && printedRcvCents === null) return
  const count = (state.nameCounts.get(baseName.toLowerCase()) ?? 0) + 1
  state.nameCounts.set(baseName.toLowerCase(), count)
  const name = count === 1 ? baseName : `${baseName} (#${count})`

  state.rooms.push({ name, printedTotalRcvCents: printedRcvCents })
  for (const item of state.buffered) {
    item.room = name
    state.items.push(item)
  }
  state.buffered = []
}

/** Remove trailing money tokens from a totals line, leaving the room name. */
function stripTrailingMoney(text: string): string {
  const tokens = tokenize(text)
  while (tokens.length > 0 && MONEY_TAIL_RE.test(tokens[tokens.length - 1])) {
    tokens.pop()
  }
  return tokens.join(' ')
}

/** Record a warning for an item whose numeric row never arrived. */
function flushPendingItem(state: ParserState): void {
  if (!state.pendingItem) return
  state.warnings.push(
    `Line ${state.pendingItem.lineNumber} ("${state.pendingItem.description}") had no numeric row`
  )
  state.pendingItem = null
}

function beginItem(state: ParserState, lineNumber: number, line: TextLine): void {
  flushPendingItem(state)
  state.lastItem = null
  const tokens = tokensWithX(line)
  const numericStart = findNumericStart(tokens)
  const descriptionTokens = numericStart === -1 ? tokens.slice(1) : tokens.slice(1, numericStart)
  state.pendingItem = {
    lineNumber,
    description: descriptionTokens.map((t) => t.text).join(' '),
  }
  if (numericStart !== -1) {
    completeItem(state, tokens, numericStart)
  }
}

/**
 * Index where a numeric row begins: a "qty UNIT" pair followed by either a
 * money token or the SUPPLEMENT marker. Returns -1 when the line has none.
 */
function findNumericStart(tokens: XToken[]): number {
  for (let i = 0; i < tokens.length - 2; i++) {
    if (
      parseQuantity(tokens[i].text) !== null &&
      UNIT_RE.test(tokens[i + 1].text) &&
      (isMoneyToken(tokens[i + 2].text) || tokens[i + 2].text === 'SUPPLEMENT')
    ) {
      return i
    }
  }
  return -1
}

/** Numeric row on its own line (or continuation) for the pending item. */
function tryCompleteItem(state: ParserState, line: TextLine): boolean {
  const tokens = tokensWithX(line)
  if (findNumericStart(tokens) !== 0) return false
  completeItem(state, tokens, 0)
  return true
}

function completeItem(state: ParserState, tokens: XToken[], numericStart: number): void {
  const pending = state.pendingItem
  if (!pending) return

  const qty = parseQuantity(tokens[numericStart].text)
  if (qty === null) return

  const isSupplement = tokens[numericStart + 2].text === 'SUPPLEMENT'
  const columns = isSupplement
    ? zeroMoneyColumns()
    : mapRowColumns(state, tokens.slice(numericStart + 2))
  if (!columns) return

  const item: ParsedLineItem = {
    lineNumber: pending.lineNumber,
    room: '', // stamped when the section closes
    code: null, // Final Draft PDFs print descriptions only; codes come later via lookup.
    description: pending.description,
    quantity: qty,
    unit: tokens[numericStart + 1].text.toUpperCase(),
    ...columns,
  }
  state.buffered.push(item)
  state.lastItem = item
  state.pendingItem = null
}

interface MoneyColumns {
  unitPriceCents: number
  taxCents: number
  opCents: number
  rcvCents: number
  depreciationCents: number
  acvCents: number
}

function zeroMoneyColumns(): MoneyColumns {
  return {
    unitPriceCents: 0,
    taxCents: 0,
    opCents: 0,
    rcvCents: 0,
    depreciationCents: 0,
    acvCents: 0,
  }
}

/**
 * Map a numeric row's money tokens to named amounts. Prefers calibrated
 * column positions; falls back to order-based mapping when no header has
 * been seen yet.
 */
function mapRowColumns(state: ParserState, tokens: XToken[]): MoneyColumns | null {
  if (state.calibration) {
    const values = assignMoneyToColumns(tokens, state.calibration)
    const rcvCents = values.RCV ?? values.TOTAL
    if (rcvCents !== undefined) {
      return {
        unitPriceCents:
          values.PRICE ?? values.REPLACE ?? values.REMOVE ?? values.RESET ?? 0,
        taxCents: values.TAX ?? 0,
        opCents: values.OP ?? 0,
        rcvCents,
        depreciationCents: values.DEPREC ?? 0,
        acvCents: values.ACV ?? rcvCents,
      }
    }
  }
  return mapMoneyByOrder(tokens.map((t) => t.text))
}

/**
 * Order-based fallback: depreciation is printed in parentheses/brackets; when
 * present the row ends with ... RCV (DEPREC) ACV, otherwise with RCV/TOTAL.
 */
function mapMoneyByOrder(tokens: string[]): MoneyColumns | null {
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

/** RCV/TOTAL amount from a "Totals:"/"Total:"/"Line Item Totals" row. */
function totalsRowValue(state: ParserState, line: TextLine): number | null {
  if (state.calibration) {
    const values = assignMoneyToColumns(tokensWithX(line), state.calibration)
    const rcv = values.RCV ?? values.TOTAL
    if (rcv !== undefined) return rcv
  }
  // Fallback: with DEPREC/ACV columns the RCV sits third from the right,
  // otherwise the last money token is the total.
  const money = tokenize(line.text).filter(isMoneyToken)
  if (money.length === 0) return null
  const idx = money.length >= 3 ? money.length - 3 : money.length - 1
  return parseMoneyCents(money[idx])
}

/** Multi-line descriptions: fold continuation text into the pending item. */
function appendDescription(state: ParserState, text: string): boolean {
  const pending = state.pendingItem
  if (!pending || NOISE_RE.test(text)) return false
  pending.description = `${pending.description} ${text}`.trim()
  return true
}

/** Plain wrapped-description text — not sketch dimensions, not table rows. */
function isContinuationText(text: string): boolean {
  if (NOISE_RE.test(text) || DIMENSION_RE.test(text)) return false
  if (tokenize(text).some(isMoneyToken)) return false
  return /[a-z]/.test(text)
}

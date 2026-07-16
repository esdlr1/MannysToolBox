// Column calibration for Xactimate table layouts.
//
// Final Draft reports print one of several column sets, e.g.:
//   DESCRIPTION QUANTITY UNIT PRICE TAX O&P RCV AGE/LIFE COND. DEP % DEPREC. ACV
//   DESCRIPTION QTY RESET REMOVE REPLACE TAX O&P TOTAL
// Columns may be empty on any given row, so token order is unreliable.
// Numeric columns are right-aligned: a value's right edge sits under its
// header label's right edge. We record label right-edge x-positions from each
// header row and assign money tokens to the nearest column.
import { TextLine } from './types'
import { isMoneyToken, parseMoneyCents } from './numbers'

export type ColumnLabel =
  | 'QTY'
  | 'RESET'
  | 'REMOVE'
  | 'REPLACE'
  | 'PRICE'
  | 'TAX'
  | 'OP'
  | 'RCV'
  | 'DEPREC'
  | 'ACV'
  | 'TOTAL'

export interface ColumnCalibration {
  columns: { label: ColumnLabel; xRight: number }[]
}

/** A whitespace token with the x-coordinate of its right edge. */
export interface XToken {
  text: string
  xRight: number
}

/** Max distance between a value's right edge and its column's right edge. */
const COLUMN_SNAP_DISTANCE = 30

/**
 * Split a line into whitespace tokens with right-edge x-positions. Fragments
 * holding several tokens get per-token positions estimated by character
 * proportion (close enough for column snapping).
 */
export function tokensWithX(line: TextLine): XToken[] {
  const tokens: XToken[] = []
  for (const item of line.items) {
    const parts = item.text.split(/\s+/).filter((p) => p.length > 0)
    if (parts.length === 0) continue
    if (parts.length === 1) {
      tokens.push({ text: parts[0], xRight: item.x + item.width })
      continue
    }
    const perChar = item.width / item.text.length
    let cursor = 0
    for (const part of parts) {
      const start = item.text.indexOf(part, cursor)
      cursor = start + part.length
      tokens.push({ text: part, xRight: item.x + cursor * perChar })
    }
  }
  return tokens
}

const HEADER_LABELS: { match: RegExp; label: ColumnLabel; prev?: RegExp }[] = [
  { match: /^(QTY|QUANTITY)$/i, label: 'QTY' },
  { match: /^RESET$/i, label: 'RESET' },
  { match: /^REMOVE$/i, label: 'REMOVE' },
  { match: /^REPLACE$/i, label: 'REPLACE' },
  { match: /^PRICE$/i, label: 'PRICE', prev: /^UNIT$/i },
  { match: /^TAX$/i, label: 'TAX' },
  { match: /^O&P$/i, label: 'OP' },
  { match: /^RCV$/i, label: 'RCV' },
  { match: /^DEPREC\.?$/i, label: 'DEPREC' },
  { match: /^ACV$/i, label: 'ACV' },
  { match: /^TOTAL$/i, label: 'TOTAL' },
]

/**
 * Recognize a column header row and calibrate label positions from it.
 * Returns null unless the line contains DESCRIPTION plus at least two
 * recognizable numeric columns.
 */
export function detectHeaderRow(line: TextLine): ColumnCalibration | null {
  if (!/\bDESCRIPTION\b/i.test(line.text)) return null
  const tokens = tokensWithX(line)
  const columns: ColumnCalibration['columns'] = []
  for (let i = 0; i < tokens.length; i++) {
    for (const { match, label, prev } of HEADER_LABELS) {
      if (!match.test(tokens[i].text)) continue
      if (prev && (i === 0 || !prev.test(tokens[i - 1].text))) continue
      columns.push({ label, xRight: tokens[i].xRight })
      break
    }
  }
  return columns.length >= 2 ? { columns } : null
}

/**
 * Assign each money token in a row to its column by right-edge proximity.
 * When two tokens snap to one column, the closer one wins.
 */
export function assignMoneyToColumns(
  tokens: XToken[],
  calibration: ColumnCalibration
): Partial<Record<ColumnLabel, number>> {
  const best = new Map<ColumnLabel, { cents: number; distance: number }>()
  for (const token of tokens) {
    if (!isMoneyToken(token.text)) continue
    let nearest: { label: ColumnLabel; distance: number } | null = null
    for (const column of calibration.columns) {
      const distance = Math.abs(token.xRight - column.xRight)
      if (distance <= COLUMN_SNAP_DISTANCE && (!nearest || distance < nearest.distance)) {
        nearest = { label: column.label, distance }
      }
    }
    if (!nearest) continue
    const existing = best.get(nearest.label)
    if (!existing || nearest.distance < existing.distance) {
      best.set(nearest.label, { cents: parseMoneyCents(token.text), distance: nearest.distance })
    }
  }
  const result: Partial<Record<ColumnLabel, number>> = {}
  for (const [label, { cents }] of best) result[label] = cents
  return result
}

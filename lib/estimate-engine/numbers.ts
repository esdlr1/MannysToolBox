// Numeric token parsing shared by the estimate parsers.

const MONEY_RE = /^[($<]*-?[\d,]+\.\d{2}[)>$]*$/

/** True if the token looks like a money amount ("1,234.56", "(123.45)", "<0.00>"). */
export function isMoneyToken(token: string): boolean {
  return MONEY_RE.test(token.replace(/^\$/, ''))
}

/**
 * Parse a money token to integer cents. Parentheses/angle brackets (used by
 * Xactimate for depreciation) yield a positive value — sign is contextual.
 */
export function parseMoneyCents(token: string): number {
  const cleaned = token.replace(/[($<)>$,]/g, '')
  const value = Number.parseFloat(cleaned)
  if (Number.isNaN(value)) {
    throw new Error(`Not a money token: "${token}"`)
  }
  return Math.round(Math.abs(value) * 100)
}

/** Parse a quantity like "34.33" or "1,148.67". */
export function parseQuantity(token: string): number | null {
  const cleaned = token.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Number.parseFloat(cleaned)
}

/** Split a text line into whitespace-separated tokens. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((t) => t.length > 0)
}

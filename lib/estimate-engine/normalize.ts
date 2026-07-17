// O&P normalization for fair line-level comparison.
//
// Estimates apply overhead & profit two ways: baked into every line item
// (line-item total == summary RCV), or added once on the summary page (line
// items are pre-O&P; summary RCV > line total). Comparing a per-line-O&P
// estimate against a summary-O&P one makes every line of the former look
// ~20% high — the real scope/price differences hide behind an O&P skew.
//
// Fix: scale each document's line items so they sum to that document's own
// printed RCV. Both sides then sit on the same "RCV including O&P" basis, and
// matching-scope lines actually match. Uniform scaling is an approximation
// (O&P isn't perfectly proportional across trades), so it's flagged in the UI.
import { ParsedDocument } from './types'

export interface NormalizationInfo {
  applied: boolean
  /** Per-document scale factor from line-item total to printed RCV. */
  mineFactor: number
  carrierFactor: number
}

const THRESHOLD = 0.01 // ignore <1% gaps (rounding, not an O&P treatment diff)

function lineTotalCents(doc: ParsedDocument): number {
  return doc.lineItems.reduce((sum, item) => sum + item.rcvCents, 0)
}

/** Factor to bring a document's line-item total up to its printed RCV. */
function rcvFactor(doc: ParsedDocument): number {
  const lineTotal = lineTotalCents(doc)
  const summaryRcv = doc.printedTotals.summaryRcvCents
  if (!summaryRcv || lineTotal <= 0) return 1
  const factor = summaryRcv / lineTotal
  return Math.abs(factor - 1) <= THRESHOLD ? 1 : factor
}

/** Return a copy of the document with line RCV/unit price scaled by `factor`. */
function scaleDocument(doc: ParsedDocument, factor: number): ParsedDocument {
  if (factor === 1) return doc
  return {
    ...doc,
    lineItems: doc.lineItems.map((item) => ({
      ...item,
      rcvCents: Math.round(item.rcvCents * factor),
      unitPriceCents: Math.round(item.unitPriceCents * factor),
    })),
  }
}

/**
 * Normalize both documents to their printed RCV basis so line-level deltas
 * are O&P-fair. Only acts when the two documents differ in O&P treatment
 * (one scales, the other doesn't) — identical treatment needs no adjustment.
 */
export function normalizeForComparison(
  mine: ParsedDocument,
  carrier: ParsedDocument
): { mine: ParsedDocument; carrier: ParsedDocument; info: NormalizationInfo } {
  const mineFactor = rcvFactor(mine)
  const carrierFactor = rcvFactor(carrier)
  // Only normalize when the treatments differ; if both bake in or both add at
  // summary, the bases already match and scaling would distort nothing useful.
  const applied = (mineFactor === 1) !== (carrierFactor === 1)
  if (!applied) {
    return { mine, carrier, info: { applied: false, mineFactor: 1, carrierFactor: 1 } }
  }
  return {
    mine: scaleDocument(mine, mineFactor),
    carrier: scaleDocument(carrier, carrierFactor),
    info: { applied: true, mineFactor, carrierFactor },
  }
}

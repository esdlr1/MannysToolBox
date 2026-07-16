// Estimate Engine — structured types for the deterministic comparison pipeline.
// Design doc: docs/estimate-comparison-redesign.md

export type DocumentFormat = 'xactimate' | 'symbility' | 'unknown'

export type ParseMethod = 'deterministic' | 'ai-extraction'

/** A single positioned text fragment from a PDF page. */
export interface PositionedText {
  text: string
  x: number
  y: number
  width: number
}

/** One visual line of text: fragments sharing a baseline, sorted left-to-right. */
export interface TextLine {
  y: number
  text: string
  items: PositionedText[]
}

export interface PdfPage {
  pageNumber: number
  lines: TextLine[]
}

/** Money values are stored in cents to keep reconciliation exact. */
export interface ParsedLineItem {
  /** Line number as printed in the estimate (unique within the document). */
  lineNumber: number
  room: string
  /** Xactimate CAT/SEL code when present (e.g. "RFG 240"). Symbility items often lack one. */
  code: string | null
  description: string
  quantity: number
  unit: string
  unitPriceCents: number
  taxCents: number
  opCents: number
  rcvCents: number
  depreciationCents: number
  acvCents: number
}

/** A room/area section with the totals printed in the PDF for that section. */
export interface ParsedRoom {
  name: string
  printedTotalRcvCents: number | null
}

export interface PrintedTotals {
  /** "Line Item Totals" RCV as printed in the document. */
  grandRcvCents: number | null
  grandAcvCents: number | null
}

export interface ParsedDocument {
  format: DocumentFormat
  parseMethod: ParseMethod
  rooms: ParsedRoom[]
  lineItems: ParsedLineItem[]
  printedTotals: PrintedTotals
  /** Non-fatal observations collected during parsing (unrecognized rows, etc.). */
  warnings: string[]
}

export interface RoomReconciliation {
  room: string
  computedRcvCents: number
  printedRcvCents: number | null
  deltaCents: number | null
  ok: boolean
}

/** Result of the trust gate: parsed items must sum to the PDF's own printed totals. */
export interface ReconciliationResult {
  ok: boolean
  rooms: RoomReconciliation[]
  computedGrandRcvCents: number
  printedGrandRcvCents: number | null
  grandDeltaCents: number | null
  messages: string[]
}

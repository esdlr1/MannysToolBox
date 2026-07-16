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

/** A sketch surface a quantity can be calculated from (Xactimate F/C/W vars). */
export type SurfaceBasis =
  | 'walls'
  | 'ceiling'
  | 'floor'
  | 'walls_ceiling'
  | 'flooring_sy'
  | 'floor_perimeter'
  | 'ceiling_perimeter'

/** Action implied by the printed description prefix (R&R, Remove, ...). */
export type ItemAction =
  | 'remove_replace'
  | 'remove'
  | 'replace'
  | 'install'
  | 'detach_reset'
  | 'material_only'

/** Catalog enrichment attached to a parsed item (see catalog.ts). */
export interface CatalogResolution {
  /** Canonical Xactimate code recovered from the description. */
  code: string
  /** Trade category (RFG, PNT, PLM, ...). */
  category: string | null
  /** The catalog's unit for this code — mismatch with the parsed unit is a red flag. */
  unit: string | null
  method: 'exact' | 'action-stripped' | 'fuzzy'
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
  /** Action implied by the description prefix (R&R, Remove, ...), if any. */
  action?: ItemAction | null
  /** Catalog resolution of the description to a canonical code, if found. */
  catalog?: CatalogResolution | null
  /** Surface named in the description (walls / ceiling / floor words). */
  surfaceHint?: SurfaceBasis | null
  /**
   * Sketch surface whose measurement equals this quantity. Floor and ceiling
   * SF are often identical; the description word breaks the tie, and
   * 'floor_or_ceiling' records the ambiguous case.
   */
  measurementBasis?: SurfaceBasis | 'floor_or_ceiling' | null
}

/** Surface measurements from a section's sketch block, summed with subrooms. */
export interface RoomDimensions {
  wallsSf: number | null
  ceilingSf: number | null
  floorSf: number | null
  wallsCeilingSf: number | null
  flooringSy: number | null
  floorPerimeterLf: number | null
  ceilingPerimeterLf: number | null
}

/** A room/area section with the totals printed in the PDF for that section. */
export interface ParsedRoom {
  name: string
  printedTotalRcvCents: number | null
  dimensions?: RoomDimensions | null
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

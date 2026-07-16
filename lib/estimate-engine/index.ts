// Estimate Engine — deterministic-first parsing pipeline for estimate PDFs.
// Design doc: docs/estimate-comparison-redesign.md
import { extractPositionedPages } from './extract-text'
import { detectFormat } from './detect'
import { parseXactimate } from './xactimate'
import { reconcile } from './reconcile'
import { enrichDocument } from './catalog'
import { DocumentFormat, ParsedDocument, ReconciliationResult } from './types'

export * from './types'
export { extractPositionedPages } from './extract-text'
export { detectFormat } from './detect'
export { parseXactimate } from './xactimate'
export { reconcile, formatCents } from './reconcile'
export {
  enrichDocument,
  normalizeDescription,
  resolveDescription,
  splitAction,
  surfaceHintFromDescription,
} from './catalog'

export interface ParseOutcome {
  format: DocumentFormat
  document: ParsedDocument | null
  reconciliation: ReconciliationResult | null
  /** Set when the pipeline cannot produce a trusted document. */
  error: string | null
}

/**
 * Run detect → parse → reconcile for one PDF. Never returns a document that
 * failed the trust gate without saying so; the caller decides whether to fall
 * back to AI extraction (stage 3 of the design).
 */
export async function parseEstimateFile(filePath: string): Promise<ParseOutcome> {
  const pages = await extractPositionedPages(filePath)
  const format = detectFormat(pages)

  if (format === 'symbility') {
    return {
      format,
      document: null,
      reconciliation: null,
      error: 'Symbility parsing uses AI extraction (pipeline phase 3) — not wired up yet',
    }
  }
  if (format === 'unknown') {
    return {
      format,
      document: null,
      reconciliation: null,
      error: 'Unrecognized document — expected an Xactimate or Symbility estimate PDF',
    }
  }

  const document = parseXactimate(pages)
  const reconciliation = reconcile(document)
  enrichDocument(document)
  return {
    format,
    document,
    reconciliation,
    error: reconciliation.ok ? null : 'Parse failed the reconciliation gate',
  }
}

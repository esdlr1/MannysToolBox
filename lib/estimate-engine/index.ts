// Estimate Engine — deterministic-first parsing pipeline for estimate PDFs.
// Design doc: docs/estimate-comparison-redesign.md
import { extractPositionedPages } from './extract-text'
import { detectFormat } from './detect'
import { parseXactimate } from './xactimate'
import { parseSymbility } from './symbility'
import { reconcile } from './reconcile'
import { enrichDocument } from './catalog'
import { EstimateMetadata, extractMetadata } from './metadata'
import { DocumentFormat, ParsedDocument, ReconciliationResult } from './types'

export * from './types'
export { extractPositionedPages } from './extract-text'
export { detectFormat } from './detect'
export { parseXactimate } from './xactimate'
export { parseSymbility } from './symbility'
export { reconcile, formatCents } from './reconcile'
export {
  enrichDocument,
  normalizeDescription,
  resolveDescription,
  splitAction,
  surfaceHintFromDescription,
} from './catalog'
export { extractMetadata } from './metadata'
export type { EstimateMetadata } from './metadata'

export interface ParseOutcome {
  format: DocumentFormat
  document: ParsedDocument | null
  reconciliation: ReconciliationResult | null
  metadata: EstimateMetadata | null
  /** Set when the pipeline cannot produce a trusted document. */
  error: string | null
}

/**
 * Dependency-injected AI extraction (lib/estimate-engine/ai-extract.ts).
 * Injected by server routes so the core engine stays free of the OpenAI
 * dependency for CLI/test use.
 */
export type AiExtractFallback = (pages: import('./types').PdfPage[]) => Promise<ParsedDocument | null>

/**
 * OCR for scanned PDFs (no text layer): render pages to images and read them
 * with a vision model. Injected by server routes so the core engine stays
 * dependency-free for CLI/test use.
 */
export type OcrFallback = (filePath: string) => Promise<ParsedDocument | null>

/** Thrown when a PDF has no text layer, so callers can route to OCR. */
export const NO_TEXT_LAYER = 'NO_TEXT_LAYER'

/**
 * Run detect → parse → reconcile for one PDF. Never returns a document that
 * failed the trust gate without saying so; the caller decides whether to fall
 * back to AI extraction (stage 3 of the design).
 */
export async function parseEstimateFile(
  filePath: string,
  opts?: { aiFallback?: AiExtractFallback; ocrFallback?: OcrFallback }
): Promise<ParseOutcome> {
  let pages: import('./types').PdfPage[]
  try {
    pages = await extractPositionedPages(filePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.startsWith(NO_TEXT_LAYER)) throw error
    // Scanned/image PDF: read it with OCR, still judged by the trust gate.
    return await parseScanned(filePath, opts?.ocrFallback)
  }
  const format = detectFormat(pages)
  const metadata = extractMetadata(pages)

  if (format === 'unknown') {
    return {
      format,
      document: null,
      reconciliation: null,
      metadata,
      error: 'Unrecognized document — expected an Xactimate or Symbility estimate PDF',
    }
  }

  let document = format === 'symbility' ? parseSymbility(pages) : parseXactimate(pages)
  let reconciliation = reconcile(document)

  // Deterministic parse failed the gate → one AI retry, same gate (design §3).
  if (!reconciliation.ok && opts?.aiFallback) {
    const aiDocument = await tryAiExtraction(opts.aiFallback, pages)
    if (aiDocument) {
      const aiReconciliation = reconcile(aiDocument)
      if (aiReconciliation.ok) {
        document = aiDocument
        reconciliation = aiReconciliation
      }
    }
  }

  enrichDocument(document)
  return {
    format,
    document,
    reconciliation,
    metadata,
    error: reconciliation.ok ? null : 'Parse failed the reconciliation gate',
  }
}

/** OCR path for scanned PDFs: images → vision extraction → reconciliation gate. */
async function parseScanned(
  filePath: string,
  ocrFallback: OcrFallback | undefined
): Promise<ParseOutcome> {
  if (!ocrFallback) {
    return {
      format: 'unknown',
      document: null,
      reconciliation: null,
      metadata: null,
      error:
        'This is a scanned/image PDF and OCR is unavailable here (no AI provider configured).',
    }
  }
  let document: ParsedDocument | null = null
  let failure: string | null = null
  try {
    document = await ocrFallback(filePath)
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
    console.error('[estimate-engine] OCR failed:', error)
  }
  if (!document) {
    return {
      format: 'unknown',
      document: null,
      reconciliation: null,
      metadata: null,
      // Surface the actual stage that failed — a generic message makes this
      // impossible to diagnose from the UI.
      error: `Could not read this scanned estimate: ${failure ?? 'no line items were recognized'}.`,
    }
  }
  const reconciliation = reconcile(document)
  enrichDocument(document)
  return {
    format: document.format,
    document,
    reconciliation,
    metadata: null,
    error: reconciliation.ok
      ? null
      : 'Scanned estimate read by OCR, but the figures do not reconcile against the printed totals — treat with caution.',
  }
}

async function tryAiExtraction(
  fallback: AiExtractFallback,
  pages: import('./types').PdfPage[]
): Promise<ParsedDocument | null> {
  try {
    return await fallback(pages)
  } catch (error) {
    console.error('[estimate-engine] AI extraction fallback failed:', error)
    return null
  }
}

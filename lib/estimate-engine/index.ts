// Estimate Engine — deterministic-first parsing pipeline for estimate PDFs.
// Design doc: docs/estimate-comparison-redesign.md
import { extractPositionedPages } from './extract-text'
import { detectFormat } from './detect'
import { parseXactimate } from './xactimate'
import { reconcile } from './reconcile'
import { enrichDocument } from './catalog'
import { EstimateMetadata, extractMetadata } from './metadata'
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
 * Run detect → parse → reconcile for one PDF. Never returns a document that
 * failed the trust gate without saying so; the caller decides whether to fall
 * back to AI extraction (stage 3 of the design).
 */
export async function parseEstimateFile(
  filePath: string,
  opts?: { aiFallback?: AiExtractFallback }
): Promise<ParseOutcome> {
  const pages = await extractPositionedPages(filePath)
  const format = detectFormat(pages)
  const metadata = extractMetadata(pages)

  if (format === 'symbility') {
    // No deterministic Symbility parser yet — AI extraction is the designed
    // path (still guarded by the reconciliation gate).
    const aiDocument = opts?.aiFallback ? await tryAiExtraction(opts.aiFallback, pages) : null
    if (aiDocument) {
      const reconciliation = reconcile(aiDocument)
      enrichDocument(aiDocument)
      return {
        format,
        document: aiDocument,
        reconciliation,
        metadata,
        error: reconciliation.ok ? null : 'AI extraction failed the reconciliation gate',
      }
    }
    return {
      format,
      document: null,
      reconciliation: null,
      metadata,
      error: 'Could not extract this Symbility estimate — please report this document',
    }
  }
  if (format === 'unknown') {
    return {
      format,
      document: null,
      reconciliation: null,
      metadata,
      error: 'Unrecognized document — expected an Xactimate or Symbility estimate PDF',
    }
  }

  let document = parseXactimate(pages)
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

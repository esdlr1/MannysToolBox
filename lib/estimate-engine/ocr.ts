// OCR entry point for scanned estimates: render pages → vision extraction.
// Server-side only (needs a configured AI provider). The reconciliation gate
// downstream decides whether the result is trustworthy.
import { renderPdfPages, MAX_OCR_PAGES } from './render'
import { aiExtractFromImages } from './ai-extract'
import { ParsedDocument } from './types'

export async function ocrEstimateFile(filePath: string): Promise<ParsedDocument | null> {
  const images = await renderPdfPages(filePath, MAX_OCR_PAGES)
  if (images.length === 0) return null
  console.log(`[AI OCR] rendered ${images.length} page(s) for OCR: ${filePath}`)
  return aiExtractFromImages(images)
}

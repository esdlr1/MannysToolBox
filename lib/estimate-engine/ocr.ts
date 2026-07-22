// OCR entry point for scanned estimates: render pages → vision extraction.
// Server-side only (needs a configured AI provider). The reconciliation gate
// downstream decides whether the result is trustworthy.
//
// Errors are deliberately specific — a generic "couldn't read it" leaves no
// way to tell a render failure from a missing API key from a model refusal.
import { renderPdfPages, MAX_OCR_PAGES } from './render'
import { aiExtractFromImages } from './ai-extract'
import { ParsedDocument } from './types'

export async function ocrEstimateFile(filePath: string): Promise<ParsedDocument | null> {
  const started = Date.now()

  let images: { pageNumber: number; base64: string }[]
  try {
    images = await renderPdfPages(filePath, MAX_OCR_PAGES)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[AI OCR] page rendering failed:', error)
    throw new Error(`could not render the scanned pages (${detail})`)
  }
  if (images.length === 0) throw new Error('the PDF contained no renderable pages')

  const totalKb = Math.round(images.reduce((n, i) => n + i.base64.length * 0.75, 0) / 1024)
  console.log(`[AI OCR] rendered ${images.length} page(s), ~${totalKb} KB total: ${filePath}`)

  const doc = await aiExtractFromImages(images)
  console.log(
    `[AI OCR] extracted ${doc?.lineItems.length ?? 0} item(s) in ${Math.round((Date.now() - started) / 1000)}s`
  )
  return doc
}

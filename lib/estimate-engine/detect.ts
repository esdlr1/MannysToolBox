// Document format detection — stage 1 of the pipeline.
import { DocumentFormat, PdfPage } from './types'

const XACTIMATE_MARKERS = [
  /xactimate/i,
  /\bCONTINUED\s*-\s/,
  /QUANTITY\s+UNIT\s+PRICE/i,
  /DEPREC\.?\s+ACV/i,
]

const SYMBILITY_MARKERS = [
  /symbility/i,
  /claims\s*connect/i,
  /corelogic/i,
]

/**
 * Identify the estimate platform from page text. Checks Symbility markers
 * first because some Symbility exports mimic Xactimate-style column headers.
 */
export function detectFormat(pages: PdfPage[]): DocumentFormat {
  const text = pages
    .slice(0, 3)
    .concat(pages.slice(-2))
    .flatMap((page) => page.lines.map((line) => line.text))
    .join('\n')

  if (SYMBILITY_MARKERS.some((marker) => marker.test(text))) return 'symbility'
  if (XACTIMATE_MARKERS.some((marker) => marker.test(text))) return 'xactimate'
  return 'unknown'
}

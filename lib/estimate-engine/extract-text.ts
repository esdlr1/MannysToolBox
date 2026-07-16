// Positional text extraction via pdfjs-dist (legacy Node build).
//
// The rest of the app uses pdf-parse, but its bundled pdf.js is from 2018 and
// rejects PDFs written by modern generators (pdf-lib, Chrome print-to-PDF,
// re-saved carrier files). The engine needs to accept whatever a carrier
// sends, so it extracts with a current pdf.js directly.
import { readFile } from 'fs/promises'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf'
import type { TextItem as PdfJsTextItem } from 'pdfjs-dist/types/src/display/api'
import { PdfPage, PositionedText, TextLine } from './types'

/** Fragments whose baselines are within this many PDF units belong to one line. */
const LINE_Y_TOLERANCE = 2.5

/**
 * Extract every page's text with positions. Throws for empty or image-only
 * PDFs — the caller surfaces that as "scanned PDF, not supported in v1".
 */
export async function extractPositionedPages(filePath: string): Promise<PdfPage[]> {
  const buffer = await readFile(filePath)
  if (buffer.length === 0) {
    throw new Error('PDF file is empty')
  }

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise

  const pages: PdfPage[] = []
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const items: PositionedText[] = content.items
        .filter((item): item is PdfJsTextItem => 'str' in item && item.str.trim().length > 0)
        .map((item) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
        }))
      pages.push({ pageNumber, lines: groupIntoLines(items) })
    }
  } finally {
    await doc.destroy()
  }

  const totalFragments = pages.reduce(
    (sum, page) => sum + page.lines.reduce((n, line) => n + line.items.length, 0),
    0
  )
  if (totalFragments === 0) {
    throw new Error(
      'No text layer found — this looks like a scanned/image PDF. OCR is not supported yet; please export a digital PDF.'
    )
  }

  return pages
}

/**
 * Group positioned fragments into visual lines: cluster by baseline y
 * (PDF y grows upward, so lines are sorted top-of-page first), then
 * order fragments left-to-right.
 */
export function groupIntoLines(items: PositionedText[]): TextLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TextLine[] = []

  for (const item of sorted) {
    const current = lines[lines.length - 1]
    if (current && Math.abs(current.y - item.y) <= LINE_Y_TOLERANCE) {
      current.items.push(item)
    } else {
      lines.push({ y: item.y, text: '', items: [item] })
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    line.text = joinFragments(line.items)
  }
  return lines
}

/** Join fragments with a space only where there is a real horizontal gap. */
function joinFragments(items: PositionedText[]): string {
  let text = ''
  let prevEnd: number | null = null
  for (const item of items) {
    if (prevEnd !== null && item.x - prevEnd > 1) {
      text += ' '
    }
    text += item.text
    prevEnd = item.x + item.width
  }
  return text.trim()
}

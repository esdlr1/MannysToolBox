// Render PDF pages to images — the front half of OCR for scanned estimates.
//
// Scanned/photographed estimates have no text layer, so the deterministic
// parsers have nothing to read. Rendering each page to a PNG lets a vision
// model read it; the reconciliation gate then verifies the numbers it
// reported against the totals printed in the document itself.
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { createCanvas } from '@napi-rs/canvas'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf'

/** Directory of pdf.js's bundled standard font data, resolved from the package. */
function standardFontsDir(): string {
  const pkg = require.resolve('pdfjs-dist/package.json')
  return join(dirname(pkg), 'standard_fonts') + '/'
}

/** Upscale factor: estimate tables need resolution to stay legible. */
const RENDER_SCALE = 2.0

/** Safety cap — a scanned estimate beyond this is a cost/time risk. */
export const MAX_OCR_PAGES = 30

export interface RenderedPage {
  pageNumber: number
  /** Base64-encoded PNG (no data: prefix). */
  base64: string
}

/**
 * pdf.js reaches for the native `canvas` package by default, which needs a
 * node-gyp build. Supplying our own factory backed by @napi-rs/canvas
 * (prebuilt binaries) keeps rendering working on Railway with no native build.
 */
class NapiCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height))
    return { canvas, context: canvas.getContext('2d') }
  }
  reset(canvasAndContext: { canvas: { width: number; height: number } }, width: number, height: number) {
    canvasAndContext.canvas.width = Math.ceil(width)
    canvasAndContext.canvas.height = Math.ceil(height)
  }
  destroy(canvasAndContext: { canvas: { width: number; height: number } }) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
  }
}

/**
 * Render up to `maxPages` pages to PNG images. Throws if the document can't
 * be opened; returns [] if it has no pages.
 */
export async function renderPdfPages(
  filePath: string,
  maxPages: number = MAX_OCR_PAGES
): Promise<RenderedPage[]> {
  const buffer = await readFile(filePath)
  const canvasFactory = new NapiCanvasFactory()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    canvasFactory,
    // Node has no FontFace API: without this pdf.js silently renders pages
    // with no text at all. Drawing glyphs as paths is the reliable path.
    disableFontFace: true,
    useSystemFonts: false,
    // Non-embedded fonts (Helvetica, Times) need pdf.js's bundled metrics.
    standardFontDataUrl: standardFontsDir(),
  } as Parameters<typeof pdfjs.getDocument>[0]).promise

  const pages: RenderedPage[] = []
  try {
    const count = Math.min(doc.numPages, maxPages)
    for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      // White ground: scans render transparent otherwise, which reads badly.
      context.fillStyle = '#FFFFFF'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({
        // @napi-rs/canvas context is API-compatible with the 2D context pdf.js expects
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        canvasFactory,
      } as Parameters<typeof page.render>[0]).promise
      pages.push({ pageNumber, base64: canvas.toBuffer('image/png').toString('base64') })
    }
  } finally {
    await doc.destroy()
  }
  return pages
}

declare module 'pdf-parse' {
  interface PDFData {
    numpages?: number
    numrender?: number
    info?: unknown
    metadata?: unknown
    text?: string
    version?: string
  }
  interface PDFParseOptions {
    /** Custom page renderer; receives the pdf.js page proxy. */
    pagerender?: (pageData: unknown) => string | Promise<string>
    /** Max pages to parse (0 = all). */
    max?: number
    version?: string
  }
  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: PDFParseOptions): Promise<PDFData>
  export default pdfParse
}

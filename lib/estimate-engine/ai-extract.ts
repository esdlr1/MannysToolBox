// AI extraction — the safety net of Approach C (design §3).
//
// Used only when the deterministic parser can't produce a gate-passing
// document (layout drift) or for Symbility PDFs (no deterministic parser
// yet). The model extracts line items into strict JSON; the reconciliation
// gate remains the authority — an AI extraction that doesn't sum to the
// PDF's printed totals is rejected just like a bad deterministic parse.
// Server-side only. Provider-agnostic: OpenAI / Anthropic / Google via
// lib/ai-providers.ts (AI_EXTRACT_PROVIDER / AI_EXTRACT_MODEL).
import { AIProvider, completeText, resolveTask } from '../ai-providers'
import { ParsedDocument, ParsedLineItem, ParsedRoom, PdfPage } from './types'

const MAX_CHARS = 90_000

export async function aiExtractDocument(
  pages: PdfPage[],
  override?: { provider: AIProvider; model: string }
): Promise<ParsedDocument | null> {
  const task = override ?? resolveTask('extract')
  if (!task) {
    console.error('[AI extract] no AI provider configured')
    return null
  }
  const text = pages
    .map((page) => `--- page ${page.pageNumber} ---\n${page.lines.map((l) => l.text).join('\n')}`)
    .join('\n')
    .slice(0, MAX_CHARS)

  const response = await completeText({
    provider: task.provider,
    model: task.model,
    system:
      'You extract construction estimate line items from raw PDF text. ' +
      'Return ONLY valid JSON, no prose, no code fences. All money values are dollars with 2 decimals exactly as printed. ' +
      'Never invent items or amounts; omit anything you cannot read.',
    prompt:
      `Extract every line item from this estimate.\n` +
      `JSON shape: {"rooms":[{"name":string,"printedTotal":number|null}],` +
      `"items":[{"lineNumber":number,"room":string,"description":string,"quantity":number,"unit":string,` +
      `"unitPrice":number,"tax":number,"op":number,"rcv":number,"depreciation":number,"acv":number}],` +
      `"grandTotal":number|null}\n` +
      `"rcv" is the line total (RCV or TOTAL column). "printedTotal" is the total printed for that room's section. ` +
      `Use 0 for absent money columns.\n\nESTIMATE TEXT:\n${text}`,
    temperature: 0,
    maxTokens: 16000,
  })
  if (response.error || !response.text) {
    console.error(`[AI extract] ${response.provider}/${response.model} failed:`, response.error)
    return null
  }

  const parsed = parseJson(response.text)
  if (!parsed) return null
  return toDocument(parsed)
}

/** Pages sent per vision call — keeps each request within context limits. */
const OCR_PAGE_BATCH = 4

/**
 * OCR path: read a SCANNED estimate from rendered page images. Same strict
 * JSON contract and the same reconciliation gate afterwards — if the model
 * misreads a figure, the parsed items won't sum to the document's own printed
 * totals and the gate rejects it rather than shipping wrong numbers.
 */
export async function aiExtractFromImages(
  images: { pageNumber: number; base64: string }[],
  override?: { provider: AIProvider; model: string }
): Promise<ParsedDocument | null> {
  const task = override ?? resolveTask('extract')
  if (!task) {
    console.error('[AI OCR] no AI provider configured')
    return null
  }
  if (images.length === 0) return null

  const merged: RawExtraction = { rooms: [], items: [], grandTotal: null }
  for (let i = 0; i < images.length; i += OCR_PAGE_BATCH) {
    const batch = images.slice(i, i + OCR_PAGE_BATCH)
    const response = await completeText({
      provider: task.provider,
      model: task.model,
      system:
        'You read scanned construction estimates from page images and extract their line items. ' +
        'Return ONLY valid JSON, no prose, no code fences. Transcribe money values EXACTLY as printed ' +
        '(2 decimals). Never invent items or amounts; omit anything you cannot read clearly.',
      prompt:
        `These are pages ${batch.map((b) => b.pageNumber).join(', ')} of an estimate. ` +
        `Extract every line item you can read.\n` +
        `JSON shape: {"rooms":[{"name":string,"printedTotal":number|null}],` +
        `"items":[{"lineNumber":number,"room":string,"description":string,"quantity":number,"unit":string,` +
        `"unitPrice":number,"tax":number,"op":number,"rcv":number,"depreciation":number,"acv":number}],` +
        `"grandTotal":number|null}\n` +
        `"rcv" is the line total (RCV or TOTAL column). "printedTotal" is the total printed for that ` +
        `room's section ("Totals: <room>"). "grandTotal" is the estimate's line-item grand total if ` +
        `shown on these pages. Use 0 for absent money columns. Rooms with no line items on these pages ` +
        `should be omitted.`,
      images: batch.map((b) => b.base64),
      temperature: 0,
      maxTokens: 16000,
    })
    if (response.error || !response.text) {
      console.error(`[AI OCR] pages ${batch[0].pageNumber}+ failed:`, response.error)
      continue
    }
    const parsed = parseJson(response.text)
    if (!parsed) continue

    merged.items!.push(...(parsed.items ?? []))
    for (const room of parsed.rooms ?? []) {
      if (!room.name) continue
      const existing = merged.rooms!.find((r) => r.name === room.name)
      if (existing) {
        existing.printedTotal = existing.printedTotal ?? room.printedTotal ?? null
      } else {
        merged.rooms!.push(room)
      }
    }
    if (merged.grandTotal == null && parsed.grandTotal != null) {
      merged.grandTotal = parsed.grandTotal
    }
  }

  const doc = toDocument(merged)
  if (doc) {
    doc.parseMethod = 'ai-extraction'
    doc.warnings = [
      `Read by OCR from ${images.length} scanned page${images.length === 1 ? '' : 's'} — verified by the reconciliation gate`,
    ]
  }
  return doc
}

interface RawExtraction {
  rooms?: { name?: string; printedTotal?: number | null }[]
  items?: {
    lineNumber?: number
    room?: string
    description?: string
    quantity?: number
    unit?: string
    unitPrice?: number
    tax?: number
    op?: number
    rcv?: number
    depreciation?: number
    acv?: number
  }[]
  grandTotal?: number | null
}

function parseJson(text: string): RawExtraction | null {
  const cleaned = text.replace(/^```(json)?/m, '').replace(/```\s*$/m, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as RawExtraction
  } catch (error) {
    console.error('[AI extract] JSON parse failed:', error)
    return null
  }
}

const cents = (value: number | undefined | null): number =>
  Number.isFinite(value) ? Math.round((value as number) * 100) : 0

function toDocument(raw: RawExtraction): ParsedDocument | null {
  if (!Array.isArray(raw.items) || raw.items.length === 0) return null

  const rooms: ParsedRoom[] = (raw.rooms ?? [])
    .filter((room) => typeof room.name === 'string' && room.name.length > 0)
    .map((room) => ({
      name: room.name as string,
      printedTotalRcvCents:
        room.printedTotal === null || room.printedTotal === undefined ? null : cents(room.printedTotal),
    }))

  const lineItems: ParsedLineItem[] = raw.items
    .filter((item) => typeof item.description === 'string' && Number.isFinite(item.rcv))
    .map((item, index) => ({
      lineNumber: Number.isFinite(item.lineNumber) ? (item.lineNumber as number) : index + 1,
      room: item.room && item.room.length > 0 ? item.room : 'General',
      code: null,
      description: item.description as string,
      quantity: Number.isFinite(item.quantity) ? (item.quantity as number) : 0,
      unit: (item.unit ?? 'EA').toUpperCase(),
      unitPriceCents: cents(item.unitPrice),
      taxCents: cents(item.tax),
      opCents: cents(item.op),
      rcvCents: cents(item.rcv),
      depreciationCents: cents(item.depreciation),
      acvCents: Number.isFinite(item.acv) ? cents(item.acv) : cents(item.rcv),
    }))
  if (lineItems.length === 0) return null

  // Ensure every referenced room exists, so reconciliation can roll up.
  const known = new Set(rooms.map((room) => room.name))
  for (const item of lineItems) {
    if (!known.has(item.room)) {
      known.add(item.room)
      rooms.push({ name: item.room, printedTotalRcvCents: null })
    }
  }

  return {
    format: 'xactimate',
    parseMethod: 'ai-extraction',
    rooms,
    lineItems,
    printedTotals: {
      grandRcvCents:
        raw.grandTotal === null || raw.grandTotal === undefined ? null : cents(raw.grandTotal),
      grandAcvCents: null,
    },
    warnings: ['Extracted by AI (deterministic parse unavailable) — verified by the reconciliation gate'],
  }
}

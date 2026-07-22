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
    throw new Error('no AI provider configured — set OPENAI_API_KEY (or another provider key)')
  }
  if (images.length === 0) throw new Error('no pages to read')

  const merged: RawExtraction = { rooms: [], items: [], grandTotal: null }
  const failures: string[] = []
  let batches = 0
  for (let i = 0; i < images.length; i += OCR_PAGE_BATCH) {
    batches++
    const batch = images.slice(i, i + OCR_PAGE_BATCH)
    const response = await completeText({
      provider: task.provider,
      model: task.model,
      system:
        'You read scanned construction estimates from page images and extract their line items. ' +
        'Return ONLY valid JSON, no prose, no code fences. Transcribe money values EXACTLY as printed ' +
        '(2 decimals). Never invent items or amounts; omit anything you cannot read clearly.',
      prompt:
        `These are pages ${batch.map((b) => b.pageNumber).join(', ')} of an estimate.\n\n` +
        `CRITICAL — two kinds of page exist, treat them differently:\n` +
        `1. ITEMIZED pages: a table of NUMBERED line items with quantity, unit, and price columns. ` +
        `Extract these as "items".\n` +
        `2. RECAP / SUMMARY pages: titled "Recap by Room", "Recap by Category", "Recap by Coverage", ` +
        `"Summary for", "Recap by Category with Depreciation", or showing area/room names with only a ` +
        `dollar amount and a percentage. These REPEAT totals already counted on the itemized pages. ` +
        `NEVER output them as "items" — doing so double-counts the whole estimate. From these pages ` +
        `extract ONLY the totals into "grandTotal" and "summary".\n\n` +
        `JSON shape: {"rooms":[{"name":string,"printedTotal":number|null}],` +
        `"items":[{"lineNumber":number,"room":string,"description":string,"quantity":number,"unit":string,` +
        `"unitPrice":number,"tax":number,"op":number,"rcv":number,"depreciation":number,"acv":number}],` +
        `"grandTotal":number|null,` +
        `"summary":{"salesTax":number|null,"overhead":number|null,"profit":number|null,"rcv":number|null,` +
        `"depreciation":number|null,"acv":number|null,"netClaim":number|null}|null}\n\n` +
        `"rcv" on an item is its line total (RCV or TOTAL column). "printedTotal" is the total printed ` +
        `for that room's section ("Totals: <room>") on an ITEMIZED page. "grandTotal" is the estimate's ` +
        `line-item total (e.g. the "Total" or "O&P Items Subtotal" on a recap page, or "Line Item Totals"). ` +
        `"summary" holds the summary-page figures (Overhead, Profit, tax, Replacement Cost Value, ` +
        `Actual Cash Value, Net Claim) when shown. Use 0 for absent money columns on items; use null for ` +
        `summary figures not shown on these pages. Omit rooms with no line items on these pages.`,
      images: batch.map((b) => b.base64),
      temperature: 0,
      maxTokens: 16000,
    })
    if (response.error || !response.text) {
      const detail = `pages ${batch[0].pageNumber}+ (${response.provider}/${response.model}): ${response.error ?? 'empty response'}`
      console.error(`[AI OCR] ${detail}`)
      failures.push(detail)
      continue
    }
    const parsed = parseJson(response.text)
    if (!parsed) {
      const detail = `pages ${batch[0].pageNumber}+: model returned unparseable output`
      console.error(`[AI OCR] ${detail}`, response.text.slice(0, 200))
      failures.push(detail)
      continue
    }

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
    if (parsed.summary) {
      merged.summary = { ...(merged.summary ?? {}) }
      for (const [key, value] of Object.entries(parsed.summary)) {
        if (value != null && merged.summary[key as keyof typeof merged.summary] == null) {
          merged.summary[key as keyof typeof merged.summary] = value as number
        }
      }
    }
  }

  if (failures.length === batches) {
    throw new Error(`all ${batches} OCR request(s) failed — ${failures[0]}`)
  }
  const doc = toDocument(merged)
  if (!doc) {
    throw new Error(
      `model read no usable line items from ${images.length} page(s)` +
        (failures.length ? ` (${failures.length} batch failure(s): ${failures[0]})` : '')
    )
  }
  doc.parseMethod = 'ai-extraction'
  doc.warnings = [
    `Read by OCR from ${images.length} scanned page${images.length === 1 ? '' : 's'} — verified by the reconciliation gate`,
    ...(failures.length ? [`${failures.length} page batch(es) could not be read`] : []),
  ]
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
  summary?: {
    salesTax?: number | null
    overhead?: number | null
    profit?: number | null
    rcv?: number | null
    depreciation?: number | null
    acv?: number | null
    netClaim?: number | null
  } | null
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
      salesTaxCents: raw.summary?.salesTax != null ? cents(raw.summary.salesTax) : null,
      overheadCents: raw.summary?.overhead != null ? cents(raw.summary.overhead) : null,
      profitCents: raw.summary?.profit != null ? cents(raw.summary.profit) : null,
      summaryRcvCents: raw.summary?.rcv != null ? cents(raw.summary.rcv) : null,
      depreciationCents: raw.summary?.depreciation != null ? cents(raw.summary.depreciation) : null,
      summaryAcvCents: raw.summary?.acv != null ? cents(raw.summary.acv) : null,
      netClaimCents: raw.summary?.netClaim != null ? cents(raw.summary.netClaim) : null,
    },
    warnings: ['Extracted by AI (deterministic parse unavailable) — verified by the reconciliation gate'],
  }
}

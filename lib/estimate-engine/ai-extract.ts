// AI extraction — the safety net of Approach C (design §3).
//
// Used only when the deterministic parser can't produce a gate-passing
// document (layout drift) or for Symbility PDFs (no deterministic parser
// yet). The model extracts line items into strict JSON; the reconciliation
// gate remains the authority — an AI extraction that doesn't sum to the
// PDF's printed totals is rejected just like a bad deterministic parse.
// Server-side only (needs OPENAI_API_KEY).
import { callAI } from '../ai'
import { ParsedDocument, ParsedLineItem, ParsedRoom, PdfPage } from './types'

const MAX_CHARS = 90_000

export async function aiExtractDocument(pages: PdfPage[]): Promise<ParsedDocument | null> {
  const text = pages
    .map((page) => `--- page ${page.pageNumber} ---\n${page.lines.map((l) => l.text).join('\n')}`)
    .join('\n')
    .slice(0, MAX_CHARS)

  const response = await callAI({
    systemPrompt:
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
    model: 'gpt-4o',
  })
  if (response.error || !response.result) {
    console.error('[AI extract] call failed:', response.error)
    return null
  }

  const parsed = parseJson(response.result)
  if (!parsed) return null
  return toDocument(parsed)
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

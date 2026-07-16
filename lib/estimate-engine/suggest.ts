// AI pairing suggestions — design §5 tier 4. The model only PROPOSES pairs
// for items the deterministic tiers left unmatched; every proposal carries a
// reason and goes to the user's review section. Nothing enters the report as
// fact without confirmation. Server-side only. Provider-agnostic via
// lib/ai-providers.ts (AI_SUGGEST_PROVIDER / AI_SUGGEST_MODEL).
import { AIProvider, completeText, resolveTask } from '../ai-providers'
import { ParsedLineItem } from './types'
import { actionGroup, baseDescription, normalizeRoom } from './match'

export interface PairingSuggestion {
  mineLineNumber: number
  carrierLineNumber: number
  reason: string
}

const MAX_ITEMS_PER_SIDE = 60

export async function suggestPairings(
  mineOnly: ParsedLineItem[],
  carrierOnly: ParsedLineItem[],
  override?: { provider: AIProvider; model: string }
): Promise<PairingSuggestion[]> {
  if (mineOnly.length === 0 || carrierOnly.length === 0) return []
  const task = override ?? resolveTask('suggest')
  if (!task) return []
  const mine = mineOnly.slice(0, MAX_ITEMS_PER_SIDE)
  const carrier = carrierOnly.slice(0, MAX_ITEMS_PER_SIDE)

  const list = (items: ParsedLineItem[]): string =>
    items
      .map((i) => `#${i.lineNumber} [${i.room}] ${i.description} — ${i.quantity} ${i.unit}`)
      .join('\n')

  const response = await completeText({
    provider: task.provider,
    model: task.model,
    system:
      'You match construction estimate line items that describe the SAME work using different wording ' +
      '(e.g. "R&R laminated comp. shingles" vs "Remove & replace laminated composition shingles"). ' +
      'HARD RULES: the underlying item must be the same physical thing; the action must be the same class ' +
      '(R&R only pairs with R&R/remove-and-replace, remove-only with remove-only, detach & reset with detach & reset); ' +
      'the room must be the same. When in doubt, do NOT propose the pair. Return ONLY valid JSON, no prose.',
    prompt:
      `List A (contractor estimate, unmatched):\n${list(mine)}\n\n` +
      `List B (carrier estimate, unmatched):\n${list(carrier)}\n\n` +
      `Propose pairs that are the same work item. JSON: [{"a":<A line number>,"b":<B line number>,"reason":"<one short sentence>"}]. ` +
      `Empty array if none.`,
    temperature: 0,
    maxTokens: 2000,
  })
  if (response.error || !response.text) return []

  return validate(response.text, mine, carrier)
}

function validate(
  text: string,
  mine: ParsedLineItem[],
  carrier: ParsedLineItem[]
): PairingSuggestion[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []

  const mineByNumber = new Map(mine.map((i) => [i.lineNumber, i]))
  const carrierByNumber = new Map(carrier.map((i) => [i.lineNumber, i]))
  const usedMine = new Set<number>()
  const usedCarrier = new Set<number>()
  const suggestions: PairingSuggestion[] = []
  for (const entry of raw as { a?: number; b?: number; reason?: string }[]) {
    if (typeof entry.a !== 'number' || typeof entry.b !== 'number') continue
    const mineItem = mineByNumber.get(entry.a)
    const carrierItem = carrierByNumber.get(entry.b)
    if (!mineItem || !carrierItem || usedMine.has(entry.a) || usedCarrier.has(entry.b)) continue
    if (!plausiblePair(mineItem, carrierItem)) continue
    usedMine.add(entry.a)
    usedCarrier.add(entry.b)
    suggestions.push({
      mineLineNumber: entry.a,
      carrierLineNumber: entry.b,
      reason: typeof entry.reason === 'string' ? entry.reason.slice(0, 200) : 'Suggested match',
    })
  }
  return suggestions
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'per', 'from', 'only', 'coat', 'coats',
  'standard', 'grade', 'misc', 'one', 'two', 'each', 'high', 'item', 'items',
])

/**
 * Deterministic sanity filter over AI proposals — the model's opinion is
 * never enough on its own:
 *   1. Same action class (R&R ≠ remove-only ≠ detach & reset — taught by
 *      Manny 2026-07-16 after nonsense pairings in production).
 *   2. Same room.
 *   3. The action-stripped descriptions must share at least one meaningful
 *      word (insulation can never pair with paint).
 */
function plausiblePair(mine: ParsedLineItem, carrier: ParsedLineItem): boolean {
  if (actionGroup(mine) !== actionGroup(carrier)) return false
  if (normalizeRoom(mine.room) !== normalizeRoom(carrier.room)) return false

  const words = (item: ParsedLineItem): Set<string> =>
    new Set(
      baseDescription(item)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    )
  const mineWords = words(mine)
  for (const word of words(carrier)) {
    if (mineWords.has(word)) return true
  }
  return false
}

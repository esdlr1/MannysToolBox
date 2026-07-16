// Corpus miner — evidence for scope rules from the estimate library.
//
// Deterministic statistics, no AI: for each rule, across every room in the
// corpus where the rule's trigger fires, how often is each companion also
// present? High support = the rule reflects how these estimates are actually
// written; low support = candidate for muting. Evidence is attached to rules
// and shown in Rule Studio so every approval decision cites real numbers.
import { ParsedLineItem } from '../estimate-engine'
import { ScopeRuleDef, companionPresent, itemMatchesTrigger } from './rules'

/** Minimal document shape the miner needs (works from DB rows or parses). */
export interface CorpusDoc {
  label: string
  items: ParsedLineItem[]
}

export interface CompanionEvidence {
  label: string
  presentIn: number
}

export interface RuleEvidence {
  docsScanned: number
  roomsWithTrigger: number
  companions: CompanionEvidence[]
  /** Average companion presence across triggered rooms, 0–100; null if never triggered. */
  supportPct: number | null
}

export function mineRuleEvidence(
  docs: CorpusDoc[],
  rules: ScopeRuleDef[]
): Map<string, RuleEvidence> {
  const evidence = new Map<string, RuleEvidence>()

  for (const rule of rules) {
    let roomsWithTrigger = 0
    const presentCounts = rule.companions.map(() => 0)

    for (const doc of docs) {
      for (const items of roomsOf(doc).values()) {
        if (!items.some((item) => itemMatchesTrigger(item, rule.trigger))) continue
        roomsWithTrigger++
        rule.companions.forEach((companion, i) => {
          if (companionPresent(items, companion)) presentCounts[i]++
        })
      }
    }

    const supportPct =
      roomsWithTrigger === 0
        ? null
        : Math.round(
            (presentCounts.reduce((sum, n) => sum + n, 0) /
              (roomsWithTrigger * rule.companions.length)) *
              100
          )

    evidence.set(rule.name, {
      docsScanned: docs.length,
      roomsWithTrigger,
      companions: rule.companions.map((companion, i) => ({
        label: companion.label,
        presentIn: presentCounts[i],
      })),
      supportPct,
    })
  }
  return evidence
}

function roomsOf(doc: CorpusDoc): Map<string, ParsedLineItem[]> {
  const rooms = new Map<string, ParsedLineItem[]>()
  for (const item of doc.items) {
    const list = rooms.get(item.room)
    if (list) list.push(item)
    else rooms.set(item.room, [item])
  }
  return rooms
}

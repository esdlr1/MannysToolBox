# Estimate Comparison — Engine Redesign

**Status:** Design locked (2026-07-15) · Approach C accepted · Implementation not started
**Owner:** Manny (estimator / file reviewer)

---

## 1. Understanding Summary

- Rebuild the Estimate Comparison tool's engine so uploading **my Xactimate PDF** + **the carrier's Xactimate or Symbility PDF** produces a trustworthy difference report: per room, per line item (qty / unit price / totals deltas), missing & extra items, reconciled totals.
- The existing tool fails at every stage (extraction, matching, rooms, totals) because it hands two raw PDFs to GPT-4o and asks for everything at once. The rebuild inverts this: **deterministic parsing and math first, AI only at the edges, human review for anything uncertain.**
- Users: Manny today, **company-wide eventually** — wrong-but-confident output is the cardinal sin.
- Two output modes: **fast internal diff view** (daily file review) and **polished supplement export** (PDF/Excel negotiation packet).
- Uncertainty handling: exact matches are automatic; uncertain pairings go to a one-click **review queue**. Nothing silently guessed.
- Inputs: PDFs only, both sides. Mine = Xactimate; carrier = Xactimate or Symbility. Real sample PDFs will be provided for parser development.
- Platform: stays in MannysToolbox (Next.js / Prisma / Railway), reusing auth, upload, and the existing tool slot.

## 2. Assumptions

1. **Performance:** comparison completes in < ~30 s (deterministic parse is near-instant; only AI fuzzy matching costs time).
2. **Trust gate:** parsed line items must reconcile against the totals printed in the PDF itself; otherwise the tool fails loudly.
3. **PDFs are digital** (text layer present). OCR of scans is v2.
4. **Privacy:** claim PII stays in the existing private DB; no new exposure; no retention change.
5. **Maintenance:** carrier layouts will drift; parser failures must be loud and easy to report, never silent.

## 3. Architecture (Approach C — deterministic core + AI safety net)

Pipeline, each stage independent and testable:

1. **Detect** — identify Xactimate vs Symbility and report style; reject unsupported docs clearly.
2. **Parse** —
   - Xactimate → deterministic parser using positional text extraction (column x-coordinates, room section headers, printed room/grand totals).
   - Symbility → AI extraction into a strict JSON schema, page by page; promote to deterministic parser later if samples show one consistent layout.
3. **Reconcile (trust gate)** — extracted items must sum to the PDF's printed room totals and grand total (within pennies). Deterministic parse fails gate → auto-retry with AI extraction → still fails → honest error. Every report displays its reconciliation status.
4. **Match** — pure code, tiered (see §5).
5. **Render** — diff view + exports; all totals computed in code, never by an LLM.

## 4. Data model (new Prisma tables; replaces the single JSON blob)

- **EstimateDocument** — file ref, side (mine/carrier), format, parse method used, reconciliation status, printed totals.
- **EstimateLineItem** — document ref, room, line number, code (CAT/SEL), description, qty, unit, unit price, tax, O&P, RCV, depreciation, ACV.
- **Comparison** — the two documents, client/claim info, status, who ran it.
- **LineItemMatch** — item pairs with match type (`exact` | `code-only` | `fuzzy-confirmed` | `ai-suggested` | `manual`) and computed deltas.

Line items as rows (not a blob) enable the review queue, re-matching without re-parsing, and cross-claim analytics later.

## 5. Matching engine

Tiers; each tier only sees items the previous tier didn't claim:

1. **Exact** — same Xactimate code + same normalized room → auto-match.
2. **Code-only** — same code, different/missing room → auto-match, labeled (keeps room totals honest).
3. **Normalized description** — for code-less items (common in Symbility): canonicalization ("R&R" = "Remove & Replace", etc.) + the existing `logic-rules` synonyms table, which grows as matches are confirmed.
4. **AI suggestion** — leftovers go to the model, which *proposes* pairings with a one-line reason. Never enters the report as fact.

**Review queue:** post-processing screen shows match stats ("142 exact, 9 code-only, 6 need review") and uncertain pairs side-by-side — confirm / reject / re-pair in one click. Confirmed fuzzy matches are remembered as synonyms, so the queue shrinks over time. Review is skippable; unresolved items report as "unmatched — in mine only / in carrier's only."

**Deltas per match:** qty, unit price, tax, O&P, RCV, depreciation, ACV — carrier vs mine vs difference; rolled up per room and per category; three headline buckets: *missing from carrier's*, *only in carrier's*, *priced/measured differently*.

## 6. Reports

- **Fast diff view** — room-grouped table with real parsed room names, color-coded deltas, existing filters (code search, price range, category), reconciliation badge on top. Loads from DB instantly on revisit; re-match without re-parse.
- **Supplement export** — professional PDF/Excel: executive summary (total underpayment, top drivers), per-room carrier-vs-mine-vs-delta tables, appendix with match provenance (exact / confirmed / manual) so numbers are defensible. Bucket selection: a supplement usually includes only "missing" and "underpriced."

## 7. Error handling & edge cases

- Scanned/image PDFs → detected and rejected with a clear message (OCR = v2).
- Password-protected PDFs → rejected explicitly.
- Duplicate line items within an estimate → kept distinct via line numbers.
- Sales tax and O&P differences → reported at estimate level, not forced per-item.
- Partial parses (one bad page) → fail the gate rather than silently dropping items.

## 8. Testing strategy

- Real sample PDFs become a **golden-file suite**: each sample gets a hand-verified expected JSON; parser changes must keep all goldens green.
- The reconciliation gate doubles as a **production canary**: every failure is logged with the document's layout fingerprint, so carrier format changes surface in logs, not in wrong reports.

## 9. Rollout

Engine swaps in behind the existing tool URL. UI keeps its shell (upload → info → results) with the review-queue step added between processing and results.

---

## Decision Log

| # | Decision | Alternatives considered | Why |
|---|----------|------------------------|-----|
| 1 | Rebuild the engine, not patch prompts | Prompt tuning on current design | All four stages fail; root cause is architectural (LLM does extraction + matching + math in one shot) |
| 2 | Approach C: deterministic Xactimate parser + AI extraction for Symbility + reconciliation-gated AI fallback | A: fully deterministic; B: AI extraction everywhere | Best trust-to-effort ratio; Xactimate-vs-Xactimate (majority case) becomes fast and near-free |
| 3 | Uncertain matches → human review queue | Auto-AI matching; strict-only matching | Company-wide rollout demands zero silent guessing; queue shrinks via learned synonyms |
| 4 | Inputs are PDFs only | ESX upload for own estimates | User's real workflow provides PDFs only |
| 5 | Reconciliation gate is a hard gate | Best-effort display with warnings | A plausible-looking wrong report is worse than an honest failure |
| 6 | Line items stored as DB rows | Keep single JSON blob | Enables review queue, re-match without re-parse, cross-claim analytics |
| 7 | Two report modes (diff view + supplement export) | Single report | Daily review and negotiation have different audiences and content needs |
| 8 | OCR out of scope for v1 | Include OCR now | Samples are digital PDFs; OCR adds large surface area for little v1 value |
| 9 | Keep existing UI shell, swap engine | Full UI rewrite | UI structure is serviceable; trust problem lives in the engine |

---

# Addendum (2026-07-15): Scope Check — the recommendation layer

Designed in a follow-up session. Supersedes the idea of a standalone
"estimate writer": there is no separate writing tool and no manual dimension
entry — the line-item library works inside the flows that already exist.

## Understanding Summary

- **Scope Check** is a recommendation engine with two entry points:
  1. **Pre-flight mode** — upload your estimate PDF alone, before submission,
     and get a "what's missing / what looks off" report.
  2. **Comparison mode** — the same recommendations render as a panel inside
     the comparison report (alongside carrier-missing items).
- **No new inputs, ever**: rooms, dimensions, client name, claim number, and
  estimator are parsed from the PDF. Which side is "mine" is auto-detected
  (estimator/company on page 1), confirmable with one click. The wizard's
  manual client-info step is removed.
- **Three recommendation sources, deterministic-first**: catalog dependency
  rules, geometry checks (quantities vs. parsed sketch surfaces), and — as
  history accumulates — patterns mined from the user's own estimates.
- **Action-ready output**: every recommendation carries catalog code, unit,
  and a quantity computed from the room's geometry; exportable as a scope
  sheet in the supplement packet.
- **Non-goals**: standalone estimate writer, manual dimension entry,
  Xactimate UI automation, ESX generation.

## Where construction knowledge comes from

Rules are **data with provenance**, never hardcoded opinion:

- **ScopeRule** (new table): trigger (catalog code/category), required
  companions (codes, units, quantity surface), conditions (loss type, room
  type), priority, `source` (seeded | mined | ai-drafted | manual),
  `status` (proposed | approved | muted), evidence (occurrence counts,
  claim refs).
- **Feeders**: (a) seeder importing ESTIMATE_AUDIT_RULES.md drywall rules +
  xactimate-dependency-builder patterns; (b) **corpus miner** — deterministic
  co-occurrence stats over every stored parsed estimate ("tape & mud present
  in 7/8 estimates containing drywall replacement"); (c) **scope-expert
  agent** — a custom Claude agent with a restoration-construction brief that
  drafts per-trade rule candidates with reasons.
- **The user is the gate**: nothing fires until approved in Rule Studio
  (a simple proposed/approved/muted list showing each rule's evidence).
  In production, accept/dismiss clicks tune rule confidence; dismissed rules
  quiet down. The bot is the memory; the estimator is the expert.

## Build order (revised)

1. **Data model** — Prisma tables (documents, line items, comparisons,
   matches, scope rules); one schema serves comparison + Scope Check.
2. **Pre-flight MVP** — single PDF → existing parser + trust gate → rule
   engine with seeded rules → zero-typing report. Ships before the matching
   engine (needs none of it); every upload grows the mining corpus.
3. **Rule Studio + corpus miner** — approve/mute UI; miner runs over stored
   estimates (the 8 goldens seed it).
4. **Comparison matching + review queue** (per main design) with the
   recommendations panel embedded.
5. **Learned carrier patterns** once comparison history accumulates.

## Decision Log (addendum)

| # | Decision | Alternatives considered | Why |
|---|----------|------------------------|-----|
| 10 | No standalone estimate writer; library powers recommendations inside pre-flight + comparison | Dimension-entry scope builder; Xactimate UI automation; ESX generation | User's flow is PDF-based with zero typing; the valuable moment is review, not a new writing surface |
| 11 | Single-PDF pre-flight mode alongside comparison mode | Comparison-only recommendations | Catch omissions before the carrier ever sees the estimate; technically a subset of the comparison pipeline |
| 12 | Rules are data with provenance + human approval gate | Hardcoded rules; AI judging live with no gate | Trust and defensibility: every flag can cite its evidence and approval; no silent AI opinions |
| 13 | Knowledge = corpus mining + AI drafting + user approval | "Self-learning" agent | The scarce ingredient is the estimator's validated judgment, not construction text; mining own estimates grounds rules in actual practice |
| 14 | Pre-flight ships before the matching engine | Finish comparison first | Standalone value sooner, smaller surface, populates the mining corpus, de-risks the shared data model |
| 15 | Old estimate-audit tool retires into Scope Check | Keep both | One engine on better data; avoids divergent rule sets |
| 16 | Auto-extract client/claim/estimator from PDFs; drop manual info step | Keep manual entry step | Ease of use: two files in, zero typing; metadata is printed on page 1 of every estimate |

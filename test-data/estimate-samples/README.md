# Estimate sample PDFs (parser development)

Drop real estimate PDFs here so the parsers can be built and regression-tested
against them (design doc: `docs/estimate-comparison-redesign.md`).

## What to drop

| Folder      | Contents                                              | Ideal count |
|-------------|-------------------------------------------------------|-------------|
| `mine/`     | Your own Xactimate estimate PDFs (Final Draft export) | 3–5         |
| `carrier-xm/` | Carrier estimates in Xactimate PDF format           | 3–5         |
| `carrier-symbility/` | Carrier estimates from Symbility / Claims Connect | 3–5   |

Variety beats volume: different claim types (roof, water, fire), different
carriers, small and large estimates.

## Privacy

**Everything in this folder is gitignored** (see `.gitignore`) — these files
contain real claim PII and must never be committed or pushed. They stay on
this machine only. Golden-file expectations (`*.expected.json`) generated from
them are gitignored for the same reason.

## Trying the parser against a sample

```bash
npm run parse:estimate -- "test-data/estimate-samples/mine/<file>.pdf"
npm run parse:estimate -- "<file>.pdf" --lines   # raw extracted lines (debugging)
npm run parse:estimate -- "<file>.pdf" --json    # full parsed document
```

The output ends with the trust-gate verdict: the parse only counts as correct
when extracted line items sum to the totals printed in the PDF itself.

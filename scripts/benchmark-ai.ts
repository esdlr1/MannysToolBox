// Benchmark AI providers on real estimate work, refereed by the engine's own
// verification: an extraction either reconciles to the PDF's printed totals
// or it doesn't — no subjective judging.
//
//   npm run benchmark:ai -- "<estimate.pdf>"                 extraction shootout
//   npm run benchmark:ai -- "<mine.pdf>" "<carrier.pdf>"     + pairing suggestions
//
// Runs against every provider with an API key set (OPENAI_API_KEY,
// ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY). Set *_MODEL env vars to try
// specific models.
import { existsSync, readFileSync } from 'fs'
import {
  extractPositionedPages,
  parseEstimateFile,
  formatCents,
  reconcile,
} from '../lib/estimate-engine'
import { aiExtractDocument } from '../lib/estimate-engine/ai-extract'
import { suggestPairings } from '../lib/estimate-engine/suggest'
import { matchDocuments } from '../lib/estimate-engine/match'
import { AIProvider, availableProviders, defaultModel } from '../lib/ai-providers'

async function benchmarkExtraction(filePath: string, providers: AIProvider[]): Promise<void> {
  console.log(`\n== Extraction shootout: ${filePath}`)
  console.log('(deterministic parser result shown first as the reference)\n')

  const reference = await parseEstimateFile(filePath)
  if (reference.document && reference.reconciliation) {
    console.log(
      `deterministic: gate ${reference.reconciliation.ok ? 'PASS' : 'FAIL'} · ` +
        `${reference.document.lineItems.length} items · parsed ${formatCents(reference.reconciliation.computedGrandRcvCents)}` +
        (reference.reconciliation.printedGrandRcvCents !== null
          ? ` vs printed ${formatCents(reference.reconciliation.printedGrandRcvCents)}`
          : '')
    )
  } else {
    console.log(`deterministic: ${reference.error}`)
  }

  const pages = await extractPositionedPages(filePath)
  for (const provider of providers) {
    const model = process.env[`BENCH_${provider.toUpperCase()}_MODEL`] ?? defaultModel(provider, 'large')
    const started = Date.now()
    const doc = await aiExtractDocument(pages, { provider, model })
    const ms = Date.now() - started
    if (!doc) {
      console.log(`${provider} (${model}): extraction failed (${ms} ms)`)
      continue
    }
    const rec = reconcile(doc)
    console.log(
      `${provider} (${model}): gate ${rec.ok ? 'PASS ✓' : 'FAIL ✗'} · ${doc.lineItems.length} items · ` +
        `parsed ${formatCents(rec.computedGrandRcvCents)}` +
        (rec.printedGrandRcvCents !== null ? ` vs printed ${formatCents(rec.printedGrandRcvCents)}` : ' (no printed total found)') +
        ` · ${(ms / 1000).toFixed(1)}s`
    )
  }
}

async function benchmarkSuggestions(
  minePath: string,
  carrierPath: string,
  providers: AIProvider[]
): Promise<void> {
  console.log(`\n== Pairing-suggestion shootout: ${minePath} vs ${carrierPath}\n`)
  const [mine, carrier] = await Promise.all([
    parseEstimateFile(minePath),
    parseEstimateFile(carrierPath),
  ])
  if (!mine.document || !carrier.document) {
    console.log('one of the documents did not parse — skipping suggestions')
    return
  }
  const result = matchDocuments(mine.document, carrier.document)
  console.log(
    `deterministic matching left ${result.mineOnly.length} mine-only and ${result.carrierOnly.length} carrier-only items\n`
  )
  for (const provider of providers) {
    const model = process.env[`BENCH_${provider.toUpperCase()}_MODEL`] ?? defaultModel(provider, 'small')
    const started = Date.now()
    const suggestions = await suggestPairings(result.mineOnly, result.carrierOnly, { provider, model })
    const ms = Date.now() - started
    console.log(`${provider} (${model}): ${suggestions.length} proposals · ${(ms / 1000).toFixed(1)}s`)
    for (const s of suggestions.slice(0, 6)) {
      const m = result.mineOnly.find((i) => i.lineNumber === s.mineLineNumber)
      const c = result.carrierOnly.find((i) => i.lineNumber === s.carrierLineNumber)
      console.log(`   "${m?.description.slice(0, 45)}" ↔ "${c?.description.slice(0, 45)}" — ${s.reason.slice(0, 60)}`)
    }
    console.log('')
  }
}

/** Standalone scripts don't get Next's .env loading — read ./.env ourselves. */
function loadDotEnv(): void {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || line.trim().startsWith('#')) continue
    const value = match[2].replace(/^["']|["']$/g, '')
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

async function main(): Promise<void> {
  loadDotEnv()
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (files.length === 0) {
    console.error('Usage: npm run benchmark:ai -- <estimate.pdf> [<carrier.pdf>]')
    process.exit(1)
  }
  const providers = availableProviders()
  if (providers.length === 0) {
    console.error(
      'No provider API keys set. Set any of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY'
    )
    process.exit(1)
  }
  console.log(`providers with keys: ${providers.join(', ')}`)

  await benchmarkExtraction(files[0], providers)
  if (files[1]) await benchmarkSuggestions(files[0], files[1], providers)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

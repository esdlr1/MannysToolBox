// CLI harness for iterating on the estimate parsers against real PDFs.
//
//   npm run parse:estimate -- "test-data/estimate-samples/mine/claim-123.pdf"
//   npm run parse:estimate -- <file.pdf> --json     (dump full parsed document)
//   npm run parse:estimate -- <file.pdf> --lines    (dump raw positioned lines)
import { extractPositionedPages, detectFormat, parseEstimateFile, formatCents } from '../lib/estimate-engine'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const filePath = args.find((a) => !a.startsWith('--'))
  if (!filePath) {
    console.error('Usage: npm run parse:estimate -- <estimate.pdf> [--json] [--lines]')
    process.exit(1)
  }

  if (args.includes('--lines')) {
    const pages = await extractPositionedPages(filePath)
    console.log(`format: ${detectFormat(pages)}`)
    for (const page of pages) {
      console.log(`\n===== page ${page.pageNumber} =====`)
      for (const line of page.lines) {
        console.log(`[y=${line.y.toFixed(1)}] ${line.text}`)
      }
    }
    return
  }

  const outcome = await parseEstimateFile(filePath)
  console.log(`format:      ${outcome.format}`)

  if (!outcome.document || !outcome.reconciliation) {
    console.log(`result:      ${outcome.error}`)
    process.exit(2)
  }

  const { document, reconciliation } = outcome
  console.log(`rooms:       ${document.rooms.length}`)
  console.log(`line items:  ${document.lineItems.length}`)
  console.log(`parsed RCV:  ${formatCents(reconciliation.computedGrandRcvCents)}`)
  console.log(
    `printed RCV: ${reconciliation.printedGrandRcvCents === null ? '(not found)' : formatCents(reconciliation.printedGrandRcvCents)}`
  )
  console.log(`trust gate:  ${reconciliation.ok ? 'PASS ✓' : 'FAIL ✗'}`)

  for (const message of reconciliation.messages) console.log(`  ! ${message}`)
  for (const warning of document.warnings) console.log(`  ~ ${warning}`)

  console.log('\nper-room:')
  for (const room of reconciliation.rooms) {
    const printed = room.printedRcvCents === null ? 'no printed total' : formatCents(room.printedRcvCents)
    console.log(
      `  ${room.ok ? '✓' : '✗'} ${room.room}: parsed ${formatCents(room.computedRcvCents)} vs ${printed}`
    )
  }

  const items = document.lineItems
  const resolved = items.filter((i) => i.catalog)
  const exact = resolved.filter((i) => i.catalog?.method === 'exact').length
  const stripped = resolved.filter((i) => i.catalog?.method === 'action-stripped').length
  const unitMismatch = resolved.filter(
    (i) => i.catalog?.unit && i.catalog.unit !== i.unit
  ).length
  const withBasis = items.filter((i) => i.measurementBasis).length
  const pct = (n: number, d: number): string => (d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`)
  console.log('\ncatalog enrichment:')
  console.log(
    `  codes resolved:  ${resolved.length}/${items.length} (${pct(resolved.length, items.length)}) — ${exact} exact, ${stripped} action-stripped`
  )
  console.log(`  unit mismatches: ${unitMismatch} (parsed unit ≠ catalog unit)`)
  console.log(
    `  qty ↔ sketch:    ${withBasis}/${items.length} (${pct(withBasis, items.length)}) quantities attributed to a sketch surface`
  )

  if (args.includes('--preflight')) {
    const { SEED_RULES, evaluateScopeRules } = await import('../lib/scope-check/rules')
    const recommendations = evaluateScopeRules(document, SEED_RULES)
    console.log(`\npre-flight (${SEED_RULES.filter((r) => r.status === 'approved').length} approved seed rules):`)
    if (recommendations.length === 0) console.log('  no findings')
    for (const rec of recommendations) {
      const qty = rec.suggestedQty !== null ? ` — suggest ${rec.suggestedQty} ${rec.suggestedUnit ?? ''}` : ''
      console.log(`  [${rec.priority}] ${rec.room}: missing "${rec.missing}"${qty}`)
      console.log(`      triggered by: ${rec.triggeredBy.slice(0, 70)}`)
    }
  }

  if (args.includes('--unresolved')) {
    const unresolvedDescriptions = new Set(
      items.filter((i) => !i.catalog).map((i) => i.description)
    )
    console.log('\nunresolved descriptions:')
    for (const description of Array.from(unresolvedDescriptions).slice(0, 40)) {
      console.log(`  - ${description}`)
    }
  }

  if (args.includes('--json')) {
    console.log('\n' + JSON.stringify(document, null, 2))
  }
  if (!reconciliation.ok) process.exit(2)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

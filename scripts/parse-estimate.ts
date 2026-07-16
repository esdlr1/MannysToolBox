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

  if (args.includes('--json')) {
    console.log('\n' + JSON.stringify(document, null, 2))
  }
  if (!reconciliation.ok) process.exit(2)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

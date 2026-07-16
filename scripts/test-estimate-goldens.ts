// Golden-file regression suite for the estimate parsers.
//
//   npm run test:goldens             — parse every sample PDF and compare
//                                      against its .expected.json snapshot
//   npm run test:goldens -- --update — (re)write snapshots from current output
//
// Samples and snapshots live under test-data/estimate-samples/ and are
// gitignored (real claim PII) — this suite runs locally only. No parser
// change should ship if a golden that previously passed starts failing.
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parseEstimateFile } from '../lib/estimate-engine'

const SAMPLES_DIR = 'test-data/estimate-samples'

interface GoldenSnapshot {
  format: string
  gateOk: boolean
  roomCount: number
  itemCount: number
  computedGrandRcvCents: number
  printedGrandRcvCents: number | null
  rooms: { name: string; printedTotalRcvCents: number | null }[]
  items: unknown[]
}

async function findSamplePdfs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findSamplePdfs(path)))
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(path)
    }
  }
  return files
}

async function snapshot(pdfPath: string): Promise<GoldenSnapshot> {
  const outcome = await parseEstimateFile(pdfPath)
  if (!outcome.document || !outcome.reconciliation) {
    throw new Error(outcome.error ?? 'no document produced')
  }
  return {
    format: outcome.format,
    gateOk: outcome.reconciliation.ok,
    roomCount: outcome.document.rooms.length,
    itemCount: outcome.document.lineItems.length,
    computedGrandRcvCents: outcome.reconciliation.computedGrandRcvCents,
    printedGrandRcvCents: outcome.reconciliation.printedGrandRcvCents,
    rooms: outcome.document.rooms,
    items: outcome.document.lineItems,
  }
}

/** First differing JSON path between two snapshots, for a readable failure. */
function firstDifference(expected: unknown, actual: unknown, path = '$'): string | null {
  if (typeof expected !== typeof actual) return path
  if (expected === null || actual === null || typeof expected !== 'object') {
    return Object.is(expected, actual) ? null : path
  }
  const a = expected as Record<string, unknown>
  const b = actual as Record<string, unknown>
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const diff = firstDifference(a[key], b[key], `${path}.${key}`)
    if (diff) return diff
  }
  return null
}

async function main(): Promise<void> {
  const update = process.argv.includes('--update')
  const pdfs = await findSamplePdfs(SAMPLES_DIR)
  if (pdfs.length === 0) {
    console.log(`No sample PDFs under ${SAMPLES_DIR} — drop files there first (see its README).`)
    return
  }

  let failures = 0
  for (const pdf of pdfs) {
    const goldenPath = `${pdf}.expected.json`
    let current: GoldenSnapshot
    try {
      current = await snapshot(pdf)
    } catch (error) {
      failures++
      console.log(`✗ ${pdf} — parse error: ${error instanceof Error ? error.message : error}`)
      continue
    }

    if (update) {
      await writeFile(goldenPath, JSON.stringify(current, null, 2))
      console.log(`${current.gateOk ? '✓' : '⚠'} ${pdf} — snapshot ${current.gateOk ? 'written' : 'written (GATE FAILING)'}`)
      if (!current.gateOk) failures++
      continue
    }

    let expected: GoldenSnapshot
    try {
      expected = JSON.parse(await readFile(goldenPath, 'utf8')) as GoldenSnapshot
    } catch {
      failures++
      console.log(`✗ ${pdf} — no golden snapshot (run with --update to create)`)
      continue
    }

    const diff = firstDifference(expected, current)
    if (diff) {
      failures++
      console.log(`✗ ${pdf} — differs from golden at ${diff}`)
    } else {
      console.log(`✓ ${pdf}`)
    }
  }

  console.log(`\n${pdfs.length - failures}/${pdfs.length} golden${pdfs.length === 1 ? '' : 's'} passing`)
  if (failures > 0) process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

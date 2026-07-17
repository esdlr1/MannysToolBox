// CLI harness for the deterministic comparison engine (no DB required).
//   npm run compare:estimates -- "<mine.pdf>" "<carrier.pdf>"
import { formatCents, parseEstimateFile } from '../lib/estimate-engine'
import { matchDocuments, roomRollups } from '../lib/estimate-engine/match'
import { inferRoomPairs } from '../lib/estimate-engine/room-pairs'
import { normalizeForComparison } from '../lib/estimate-engine/normalize'

async function main(): Promise<void> {
  const [minePath, carrierPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!minePath || !carrierPath) {
    console.error('Usage: npm run compare:estimates -- <mine.pdf> <carrier.pdf>')
    process.exit(1)
  }

  const [mine, carrier] = await Promise.all([
    parseEstimateFile(minePath),
    parseEstimateFile(carrierPath),
  ])
  for (const [label, outcome] of [
    ['mine', mine],
    ['carrier', carrier],
  ] as const) {
    if (!outcome.document || !outcome.reconciliation) {
      console.error(`${label}: ${outcome.error}`)
      process.exit(2)
    }
    console.log(
      `${label}: ${outcome.document.lineItems.length} items, gate ${outcome.reconciliation.ok ? 'PASS' : 'FAIL'}`
    )
  }

  const norm = normalizeForComparison(mine.document!, carrier.document!)
  if (norm.info.applied) {
    console.log(
      `\nO&P normalized: mine ×${norm.info.mineFactor.toFixed(3)}, carrier ×${norm.info.carrierFactor.toFixed(3)}`
    )
  }
  const result = matchDocuments(norm.mine, norm.carrier)
  const byTier = new Map<string, number>()
  for (const pair of result.pairs) byTier.set(pair.tier, (byTier.get(pair.tier) ?? 0) + 1)

  console.log(`\ntotals: mine ${formatCents(result.totals.mineRcvCents)} | carrier ${formatCents(result.totals.carrierRcvCents)} | delta ${formatCents(result.totals.deltaRcvCents)}`)
  console.log(`matched: ${result.pairs.length} (${Array.from(byTier.entries()).map(([t, n]) => `${t}: ${n}`).join(', ')})`)
  console.log(`mine-only: ${result.mineOnly.length} | carrier-only: ${result.carrierOnly.length}`)

  const differences = result.pairs
    .filter((pair) => pair.rcvDeltaCents !== 0)
    .sort((a, b) => Math.abs(b.rcvDeltaCents) - Math.abs(a.rcvDeltaCents))
  console.log(`\ntop differences (${differences.length} pairs differ):`)
  for (const pair of differences.slice(0, 8)) {
    console.log(
      `  ${formatCents(pair.rcvDeltaCents)} [${pair.tier}] ${pair.mine.room}: ${pair.mine.description.slice(0, 60)}`
    )
  }

  const roomPairs = inferRoomPairs(norm.mine, norm.carrier, result, [])
  if (roomPairs.length > 0) {
    console.log('\nroom pairings inferred:')
    for (const p of roomPairs) {
      console.log(
        `  [${p.confidence}] "${p.mineRoom}" ↔ "${p.carrierRoom}" — ${p.sharedItems} shared items${p.geometry ? `, ${p.geometry}` : ''}`
      )
    }
  }

  console.log('\nroom rollups:')
  for (const rollup of roomRollups(norm.mine, norm.carrier).slice(0, 12)) {
    console.log(
      `  ${rollup.room}: mine ${formatCents(rollup.mineRcvCents)} | carrier ${formatCents(rollup.carrierRcvCents)} | delta ${formatCents(rollup.deltaRcvCents)}`
    )
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

// Mine evidence for scope rules from the estimate corpus.
//
//   npm run mine:scope-rules -- --samples          local sample PDFs, print only
//   npm run mine:scope-rules                       DB corpus, print only
//   npm run mine:scope-rules -- --write            DB corpus, write evidence to rules
import { readdir } from 'fs/promises'
import { join } from 'path'
import { Prisma } from '@prisma/client'
import { parseEstimateFile, ParsedLineItem } from '../lib/estimate-engine'
import { SEED_RULES } from '../lib/scope-check/rules'
import { CorpusDoc, mineRuleEvidence } from '../lib/scope-check/miner'

const SAMPLES_DIR = 'test-data/estimate-samples'

async function loadSampleDocs(): Promise<CorpusDoc[]> {
  const docs: CorpusDoc[] = []
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.name.toLowerCase().endsWith('.pdf')) {
        const outcome = await parseEstimateFile(path)
        if (outcome.document) docs.push({ label: entry.name, items: outcome.document.lineItems })
      }
    }
  }
  await walk(SAMPLES_DIR)
  return docs
}

async function loadDbDocs(): Promise<CorpusDoc[]> {
  const { prisma } = await import('../lib/prisma')
  const documents = await prisma.estimateDocument.findMany({ include: { lines: true } })
  return documents.map((doc) => ({
    label: doc.id,
    items: doc.lines.map(
      (line): ParsedLineItem => ({
        lineNumber: line.lineNumber,
        room: line.room,
        code: null,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceCents: line.unitPriceCents,
        taxCents: line.taxCents,
        opCents: line.opCents,
        rcvCents: line.rcvCents,
        depreciationCents: line.depreciationCents,
        acvCents: line.acvCents,
        catalog: line.code
          ? { code: line.code, category: line.category, unit: null, method: 'exact' }
          : null,
      })
    ),
  }))
}

async function main(): Promise<void> {
  const useSamples = process.argv.includes('--samples')
  const write = process.argv.includes('--write')

  const docs = useSamples ? await loadSampleDocs() : await loadDbDocs()
  console.log(`corpus: ${docs.length} document${docs.length === 1 ? '' : 's'} (${useSamples ? 'sample PDFs' : 'database'})\n`)

  const evidence = mineRuleEvidence(docs, SEED_RULES)
  for (const rule of SEED_RULES) {
    const ev = evidence.get(rule.name)
    if (!ev) continue
    const support = ev.supportPct === null ? 'never triggered' : `${ev.supportPct}% support`
    console.log(`${rule.name} [${rule.status}] — ${ev.roomsWithTrigger} triggered rooms, ${support}`)
    for (const companion of ev.companions) {
      console.log(`    ${companion.label}: present in ${companion.presentIn}/${ev.roomsWithTrigger}`)
    }
  }

  if (write) {
    const { prisma } = await import('../lib/prisma')
    for (const rule of SEED_RULES) {
      const ev = evidence.get(rule.name)
      if (!ev) continue
      await prisma.scopeRule.updateMany({
        where: { name: rule.name },
        data: { evidence: ev as unknown as Prisma.InputJsonValue },
      })
    }
    console.log('\nevidence written to scope_rules')
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

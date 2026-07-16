// Upsert the Scope Check seed rules into the database (idempotent by name).
//   npm run seed:scope-rules
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { SEED_RULES } from '../lib/scope-check/rules'

async function main(): Promise<void> {
  for (const rule of SEED_RULES) {
    const trigger = rule.trigger as unknown as Prisma.InputJsonValue
    const companions = rule.companions as unknown as Prisma.InputJsonValue
    await prisma.scopeRule.upsert({
      where: { name: rule.name },
      create: {
        name: rule.name,
        trigger,
        companions,
        priority: rule.priority,
        source: rule.source,
        status: rule.status,
        reason: rule.reason,
      },
      update: {
        trigger,
        companions,
        priority: rule.priority,
        reason: rule.reason,
        // status intentionally NOT updated: approvals/mutes made in Rule
        // Studio survive reseeding.
      },
    })
    console.log(`✓ ${rule.name} (${rule.status})`)
  }
  console.log(`${SEED_RULES.length} rules seeded`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

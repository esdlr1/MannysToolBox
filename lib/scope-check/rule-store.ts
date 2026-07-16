// Server-side rule loading with seed synchronization.
//
// Seed rules are code (reviewed, versioned); their trigger/companion/reason
// definitions must reach the database on deploy without manual steps — but
// STATUS is the user's (Rule Studio approvals/mutes always survive a sync).
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { SEED_RULES, ScopeRuleDef, dismissalKey } from './rules'

/** Upsert seed definitions, preserving user-managed status. Idempotent. */
export async function syncSeedRules(): Promise<void> {
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
      update: { trigger, companions, priority: rule.priority, reason: rule.reason },
    })
  }
}

/**
 * Rules for evaluation: sync seeds, then read the table (which may also hold
 * mined/manual rules). Falls back to the in-code seed set if the database is
 * unavailable (e.g. before first db push).
 */
export async function loadScopeRules(): Promise<ScopeRuleDef[]> {
  try {
    await syncSeedRules()
    const rows = await prisma.scopeRule.findMany({ orderBy: { createdAt: 'asc' } })
    return rows.map((row) => ({
      name: row.name,
      trigger: row.trigger as unknown as ScopeRuleDef['trigger'],
      companions: row.companions as unknown as ScopeRuleDef['companions'],
      priority: row.priority as ScopeRuleDef['priority'],
      source: row.source as ScopeRuleDef['source'],
      status: row.status as ScopeRuleDef['status'],
      reason: row.reason,
    }))
  } catch (error) {
    console.error('[Scope Check] Rule store unavailable, using seed set:', error)
    return SEED_RULES
  }
}

/** dismissalKey() strings for the user's "doesn't apply" decisions. */
export async function loadDismissals(userId: string): Promise<Set<string>> {
  try {
    const rows = await prisma.scopeRuleDismissal.findMany({ where: { userId } })
    return new Set(rows.map((row) => dismissalKey(row.ruleName, row.triggerKey, row.companionLabel)))
  } catch (error) {
    console.error('[Scope Check] Dismissal load failed:', error)
    return new Set()
  }
}

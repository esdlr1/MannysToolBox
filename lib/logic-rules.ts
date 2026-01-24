// User-taught logic: fetch and merge with built-in rules for estimate audit, comparison, etc.

import { prisma } from '@/lib/prisma'
import { keywordSynonyms } from './estimate-dependency-matcher'
import type { DependencyRule } from './estimate-dependencies'

const AUDIT_SCOPES = ['estimate_audit', 'all']
const COMPARISON_SCOPES = ['estimate_comparison', 'all']

/**
 * Fetch taught dependency rules for estimate audit (scope: estimate_audit | all)
 */
export async function getDependencyRules(): Promise<DependencyRule[]> {
  const rows = await prisma.logicRule.findMany({
    where: {
      ruleType: 'dependency_rule',
      scope: { in: AUDIT_SCOPES },
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows
    .map((r) => {
      const p = r.payload as Record<string, unknown>
      if (!p || !p.category || !p.trigger || !p.required || !p.missingItem || !p.reason) return null
      const trigger = p.trigger as { keywords?: unknown; description?: string; excludeKeywords?: string[][] }
      const required = p.required as { keywords?: unknown; description?: string }
      const excludeIf = p.excludeIf as { keywords: string[][]; description?: string } | undefined
      return {
        category: String(p.category),
        trigger: {
          keywords: (trigger?.keywords ?? []) as string[][],
          description: trigger?.description,
          excludeKeywords: trigger?.excludeKeywords,
        },
        required: {
          keywords: (required?.keywords ?? []) as string[],
          description: required?.description,
        },
        missingItem: String(p.missingItem),
        reason: String(p.reason),
        priority: ((p.priority as string) === 'minor' ? 'minor' : 'critical') as 'critical' | 'minor',
        ...(excludeIf?.keywords?.length ? { excludeIf } : {}),
      } as DependencyRule
    })
    .filter((r): r is DependencyRule => r !== null)
}

/**
 * Build Record<string, string[]> from taught synonym pairs.
 * For { termA, termB } we set synonyms[termA] = [..., termB] and synonyms[termB] = [..., termA].
 */
export async function getSynonyms(): Promise<Record<string, string[]>> {
  const rows = await prisma.logicRule.findMany({
    where: { ruleType: 'synonym', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  const out: Record<string, string[]> = {}
  for (const r of rows) {
    const p = r.payload as { termA?: string; termB?: string }
    if (!p?.termA || !p?.termB) continue
    const a = String(p.termA).trim()
    const b = String(p.termB).trim()
    if (!a || !b) continue
    if (!out[a]) out[a] = []
    if (!out[a].includes(b)) out[a].push(b)
    if (!out[b]) out[b] = []
    if (!out[b].includes(a)) out[b].push(a)
  }
  return out
}

/**
 * Synonym pairs for prompt text (e.g. "A = B")
 */
export async function getSynonymPairs(): Promise<{ termA: string; termB: string }[]> {
  const rows = await prisma.logicRule.findMany({
    where: { ruleType: 'synonym', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  return rows
    .map((r) => {
      const p = r.payload as { termA?: string; termB?: string }
      if (!p?.termA || !p?.termB) return null
      const a = String(p.termA).trim()
      const b = String(p.termB).trim()
      return a && b ? { termA: a, termB: b } : null
    })
    .filter((r): r is { termA: string; termB: string } => r !== null)
}

/**
 * Merge built-in keywordSynonyms with taught synonyms (taught appended to existing arrays, new keys added).
 */
export async function getMergedKeywordSynonyms(): Promise<Record<string, string[]>> {
  const taught = await getSynonyms()
  const merged: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(keywordSynonyms)) {
    merged[k] = [...v]
  }
  for (const [k, arr] of Object.entries(taught)) {
    const existing = merged[k] || []
    const toAdd = arr.filter((x) => !existing.includes(x))
    merged[k] = [...existing, ...toAdd]
  }
  return merged
}

/**
 * Fetch prompt hints for a scope (injected into AI prompts).
 */
export async function getPromptHints(scope: string): Promise<string[]> {
  const rows = await prisma.logicRule.findMany({
    where: {
      ruleType: 'prompt_hint',
      isActive: true,
      OR: [{ scope }, { scope: 'all' }],
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows
    .map((r) => (r.payload as { text?: string })?.text)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
}

/**
 * List all logic rules with optional filters (for API / UI).
 */
export async function listLogicRules(filters?: {
  ruleType?: string
  scope?: string
  userId?: string
}) {
  const where: Record<string, unknown> = {}
  if (filters?.ruleType) where.ruleType = filters.ruleType
  if (filters?.scope) where.scope = filters.scope
  if (filters?.userId) where.userId = filters.userId

  const rows = await prisma.logicRule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  return rows
}

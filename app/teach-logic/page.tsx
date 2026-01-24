'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, ChevronDown, Loader2, AlertCircle } from 'lucide-react'

type RuleType = 'dependency_rule' | 'synonym' | 'prompt_hint'
type Scope = 'estimate_audit' | 'estimate_comparison' | 'whats_xact_photo' | 'photoxact' | 'all'

interface LogicRuleRow {
  id: string
  ruleType: string
  scope: string
  name: string | null
  payload: Record<string, unknown>
  isActive: boolean
  createdAt: string
  user?: { id: string; name: string | null; email: string }
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'estimate_audit', label: 'Estimate Audit' },
  { value: 'estimate_comparison', label: 'Estimate Comparison' },
  { value: 'whats_xact_photo', label: 'Whats Xact – Photo' },
  { value: 'photoxact', label: 'PhotoXact' },
  { value: 'all', label: 'All tools' },
]

// Recommended PhotoXact rules (from kitchen cabinet/plumbing feedback)
const PHOTOXACT_RECOMMENDED_HINTS: string[] = [
  'When the scope includes drywall hung/taped/floated/ready for paint, or paint/seal/prime, include a line item for wall texture (match existing) unless the visible wall surface clearly shows no texture (smooth/level 5).',
  'When the photo shows a kitchen cabinet with exposed plumbing (P-trap, supply lines under a sink), the estimate MUST include: R&R (removal and reset) of P-trap, plumbing supply lines, sink, and countertop. A supply line only is not sufficient; include the full plumbing and fixture scope.',
  'When the scope includes paint, texture, demolition, or work that produces dust or debris, include masking and protection: floor protection, countertop protection, and masking of adjacent surfaces as applicable.',
  'For cabinetry and countertop: do NOT assume or estimate square footage from the photo. Add a note or line that the user must provide cabinet and countertop square footage (or unit counts) for an accurate estimate. Do not guess SF from the image.',
  'When mitigation or water-damage restoration is in scope, include ALL removal/demolition line items: remove cabinet components, remove flooring, remove baseboard, remove affected drywall, etc., as needed for access, drying, or replacement. Do not omit removals.',
  'When mitigation or water-damage restoration is in scope, include drying equipment: air movers (air mover, carpet fan), dehumidifiers, and wall cavity or under-cabinet drying as applicable. If "wall cavity drying" or "fill holes" is in scope, drying equipment must be included.',
  'For kitchen floor: do NOT assume or estimate square footage from the photo. Add a note or line that the user must provide kitchen floor measurements for an accurate estimate. Do not guess floor area from the image.',
]

function parseKeywordGroups(text: string): string[][] {
  const groups: string[][] = []
  let current: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t === '---' || t === '--') {
      if (current.length) {
        groups.push(current)
        current = []
      }
    } else if (t) {
      current.push(t)
    }
  }
  if (current.length) groups.push(current)
  return groups
}

function formatKeywordGroups(groups: string[][]): string {
  return groups.map((g) => g.join('\n')).join('\n---\n')
}

export default function TeachLogicPage() {
  const { data: session } = useSession()
  const [rules, setRules] = useState<LogicRuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<RuleType>('dependency_rule')
  const [expanded, setExpanded] = useState<Partial<Record<RuleType, boolean>>>({
    dependency_rule: false,
    synonym: false,
    prompt_hint: false,
  })

  // Form state for dependency_rule
  const [depCategory, setDepCategory] = useState('')
  const [depTrigger, setDepTrigger] = useState('')
  const [depRequired, setDepRequired] = useState('')
  const [depMissingItem, setDepMissingItem] = useState('')
  const [depReason, setDepReason] = useState('')
  const [depPriority, setDepPriority] = useState<'critical' | 'minor'>('critical')
  const [depExclude, setDepExclude] = useState('')
  const [depExcludeIf, setDepExcludeIf] = useState('')

  // Form state for synonym
  const [synTermA, setSynTermA] = useState('')
  const [synTermB, setSynTermB] = useState('')

  // Form state for prompt_hint
  const [hintScope, setHintScope] = useState<Scope>('estimate_comparison')
  const [hintText, setHintText] = useState('')
  const [addingRecommended, setAddingRecommended] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/logic-rules')
      if (!res.ok) throw new Error('Failed to load rules')
      const data = await res.json()
      setRules(data.rules || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) load()
  }, [session?.user?.id])

  const create = async (ruleType: RuleType, scope: Scope, payload: Record<string, unknown>) => {
    setError('')
    try {
      const res = await fetch('/api/logic-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleType, scope, payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create')
      await load()
      setExpanded((e) => ({ ...e, [ruleType]: false }))
      if (ruleType === 'dependency_rule') {
        setDepCategory('')
        setDepTrigger('')
        setDepRequired('')
        setDepMissingItem('')
        setDepReason('')
        setDepExclude('')
        setDepExcludeIf('')
      } else if (ruleType === 'synonym') {
        setSynTermA('')
        setSynTermB('')
      } else {
        setHintText('')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this rule?')) return
    setError('')
    try {
      const res = await fetch(`/api/logic-rules/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d?.error || 'Failed to delete')
      }
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete')
    }
  }

  const submitDependency = () => {
    const triggerGroups = parseKeywordGroups(depTrigger)
    if (triggerGroups.length < 2) {
      setError('Trigger needs at least 2 groups (separate with ---)')
      return
    }
    const requiredKw = depRequired.split(/,\s*/).map((s) => s.trim()).filter(Boolean)
    if (!requiredKw.length) {
      setError('Required keywords are needed')
      return
    }
    if (!depMissingItem.trim() || !depReason.trim()) {
      setError('Missing item and reason are required')
      return
    }
    const trigger: Record<string, unknown> = { keywords: triggerGroups }
    const excludeGroups = parseKeywordGroups(depExclude)
    if (excludeGroups.length) trigger.excludeKeywords = excludeGroups
    const excludeIfGroups = parseKeywordGroups(depExcludeIf)
    const payload: Record<string, unknown> = {
      category: depCategory.trim() || 'General',
      trigger,
      required: { keywords: requiredKw },
      missingItem: depMissingItem.trim(),
      reason: depReason.trim(),
      priority: depPriority,
    }
    if (excludeIfGroups.length) payload.excludeIf = { keywords: excludeIfGroups }
    create('dependency_rule', 'estimate_audit', payload)
  }

  const submitSynonym = () => {
    const a = synTermA.trim()
    const b = synTermB.trim()
    if (!a || !b) {
      setError('Both terms are required')
      return
    }
    create('synonym', 'all', { termA: a, termB: b })
  }

  const submitHint = () => {
    const t = hintText.trim()
    if (!t) {
      setError('Hint text is required')
      return
    }
    create('prompt_hint', hintScope, { text: t })
  }

  const addRecommendedPhotoXact = async () => {
    setError('')
    setAddingRecommended(true)
    const existing = new Set(
      byType('prompt_hint')
        .filter((r) => r.scope === 'photoxact')
        .map((r) => (r.payload as { text?: string })?.text ?? '')
    )
    let added = 0
    for (const text of PHOTOXACT_RECOMMENDED_HINTS) {
      if (existing.has(text)) continue
      try {
        const res = await fetch('/api/logic-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruleType: 'prompt_hint', scope: 'photoxact', payload: { text } }),
        })
        const data = await res.json()
        if (res.ok) {
          added++
          existing.add(text)
        } else {
          setError(data?.error || 'Failed to add one or more rules')
        }
      } catch {
        setError('Failed to add recommended rules')
      }
    }
    setAddingRecommended(false)
    await load()
  }

  const byType = (t: RuleType) => rules.filter((r) => r.ruleType === t)

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Sign in to teach the logic</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Teach the logic</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add your own rules so Estimate Audit, Estimate Comparison, and other tools use your
            preferences.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {(['dependency_rule', 'synonym', 'prompt_hint'] as RuleType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t
                  ? 'bg-red-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {t === 'dependency_rule' && 'Dependency rules'}
              {t === 'synonym' && 'Synonyms'}
              {t === 'prompt_hint' && 'Prompt hints'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : (
          <>
            {/* Dependency rules */}
            {tab === 'dependency_rule' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Estimate Audit: when to flag missing items
                  </h2>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, dependency_rule: !e.dependency_rule }))}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1"
                  >
                    {expanded.dependency_rule ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Add rule
                  </button>
                </div>
                {expanded.dependency_rule && (
                  <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                      <input
                        type="text"
                        value={depCategory}
                        onChange={(e) => setDepCategory(e.target.value)}
                        placeholder="e.g. Drywall, Plumbing"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trigger keywords (one per line; separate groups with a line containing <code>---</code>)
                      </label>
                      <textarea
                        value={depTrigger}
                        onChange={(e) => setDepTrigger(e.target.value)}
                        placeholder={'drywall\nsheetrock\n---\nreplace\ninstall'}
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Required keywords (comma‑separated) that must be present
                      </label>
                      <input
                        type="text"
                        value={depRequired}
                        onChange={(e) => setDepRequired(e.target.value)}
                        placeholder="tape, mud, joint compound"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        If missing, suggest this item
                      </label>
                      <input
                        type="text"
                        value={depMissingItem}
                        onChange={(e) => setDepMissingItem(e.target.value)}
                        placeholder="Drywall tape and mud"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                      <input
                        type="text"
                        value={depReason}
                        onChange={(e) => setDepReason(e.target.value)}
                        placeholder="Drywall replacement typically requires taping and joint compound."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                      <select
                        value={depPriority}
                        onChange={(e) => setDepPriority(e.target.value as 'critical' | 'minor')}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      >
                        <option value="critical">Critical</option>
                        <option value="minor">Minor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Exclude if estimate contains (optional; same format as trigger)
                      </label>
                      <textarea
                        value={depExclude}
                        onChange={(e) => setDepExclude(e.target.value)}
                        placeholder={'drywall\nper\nlf'}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Do not flag if estimate contains (optional; same format as trigger)
                      </label>
                      <textarea
                        value={depExcludeIf}
                        onChange={(e) => setDepExcludeIf(e.target.value)}
                        placeholder={'wall\ncalculation'}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={submitDependency}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
                      >
                        Add dependency rule
                      </button>
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, dependency_rule: false }))}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <ul className="space-y-2">
                  {byType('dependency_rule').map((r) => {
                    const p = r.payload as Record<string, unknown>
                    const trigger = (p?.trigger as { keywords?: string[][] })?.keywords
                    const req = (p?.required as { keywords?: string[] })?.keywords
                    return (
                      <li
                        key={r.id}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-start"
                      >
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {String(p?.category || 'General')} → {String(p?.missingItem || '')}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Trigger: {trigger?.map((g) => g.join(', ')).join(' AND ')} → Required: {req?.join(', ')}
                          </div>
                        </div>
                        <button
                          onClick={() => remove(r.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {byType('dependency_rule').length === 0 && !expanded.dependency_rule && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No dependency rules yet. Add one to customize when Estimate Audit flags missing items.</p>
                )}
              </section>
            )}

            {/* Synonyms */}
            {tab === 'synonym' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Terms that mean the same (Estimate Comparison & Audit)
                  </h2>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, synonym: !e.synonym }))}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1"
                  >
                    {expanded.synonym ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Add
                  </button>
                </div>
                {expanded.synonym && (
                  <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-wrap items-end gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Term A</label>
                      <input
                        type="text"
                        value={synTermA}
                        onChange={(e) => setSynTermA(e.target.value)}
                        placeholder="e.g. junction box"
                        className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div className="text-gray-500">=</div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Term B</label>
                      <input
                        type="text"
                        value={synTermB}
                        onChange={(e) => setSynTermB(e.target.value)}
                        placeholder="e.g. electrical box"
                        className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                    <button
                      onClick={submitSynonym}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, synonym: false }))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <ul className="space-y-2">
                  {byType('synonym').map((r) => {
                    const p = r.payload as { termA?: string; termB?: string }
                    return (
                      <li
                        key={r.id}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center"
                      >
                        <span className="text-gray-900 dark:text-white">
                          &quot;{p?.termA ?? ''}&quot; = &quot;{p?.termB ?? ''}&quot;
                        </span>
                        <button
                          onClick={() => remove(r.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {byType('synonym').length === 0 && !expanded.synonym && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No synonyms yet. e.g. &quot;junction box&quot; = &quot;electrical box&quot; so both are treated as the same.
                  </p>
                )}
              </section>
            )}

            {/* Prompt hints */}
            {tab === 'prompt_hint' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Extra instructions for AI (injected into prompts)
                  </h2>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, prompt_hint: !e.prompt_hint }))}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1"
                  >
                    {expanded.prompt_hint ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Add
                  </button>
                </div>
                {expanded.prompt_hint && (
                  <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tool</label>
                      <select
                        value={hintScope}
                        onChange={(e) => setHintScope(e.target.value as Scope)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      >
                        {SCOPES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruction</label>
                      <textarea
                        value={hintText}
                        onChange={(e) => setHintText(e.target.value)}
                        placeholder="e.g. In our company we never add texture unless it is clearly visible in the photo."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={submitHint}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
                      >
                        Add hint
                      </button>
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, prompt_hint: false }))}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Recommended PhotoXact rules (from kitchen/plumbing feedback) */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                    Recommended PhotoXact rules
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                    These 7 rules address: texture when drywall/paint; full plumbing R&amp;R under kitchen sink (P-trap, supply, sink, countertop); masking; asking for cabinet/counter/floor SF instead of assuming; mitigation removals; and drying equipment.
                  </p>
                  <button
                    onClick={addRecommendedPhotoXact}
                    disabled={addingRecommended}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2"
                  >
                    {addingRecommended ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Add all 7 recommended PhotoXact rules
                  </button>
                </div>

                <ul className="space-y-2">
                  {byType('prompt_hint').map((r) => {
                    const p = r.payload as { text?: string }
                    return (
                      <li
                        key={r.id}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-start"
                      >
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{r.scope}</span>
                          <p className="text-gray-900 dark:text-white mt-1">{p?.text ?? ''}</p>
                        </div>
                        <button
                          onClick={() => remove(r.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {byType('prompt_hint').length === 0 && !expanded.prompt_hint && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No hints yet. Use these to add company-specific or project-specific instructions to the AI.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Type definitions for estimate completeness audit

export interface EstimateAuditItem {
  requiredItem: string
  reason: string
  priority: 'critical' | 'minor'
  relatedItemsFound?: string[]
  room?: string
}

export interface EstimateAuditResult {
  missingLineItems: EstimateAuditItem[]
  summary: {
    checkedRules: number
    missingCount: number
    criticalCount: number
    minorCount: number
  }
  notes: string[]
}

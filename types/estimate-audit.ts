// Type definitions for estimate completeness audit

export interface EstimateAuditItem {
  requiredItem: string
  xactimateCode?: string
  reason: string
  priority: 'critical' | 'minor'
  relatedItemsFound?: string[]
  suggestedLineItems?: string[] // List of ALL specific Xactimate line items needed
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

// Type definitions for estimate comparison

export interface MatchedItem {
  contractorItem: string
  adjusterItem: string
  contractorCode?: string
  adjusterCode?: string
  contractorQuantity?: number
  adjusterQuantity?: number
  contractorPrice?: number
  adjusterPrice?: number
  confidence: number
  matchReason: 'code_match' | 'description_match' | 'quantity_price_match' | 'similarity_match' | 'manual_match'
  manuallyMatched?: boolean
  manuallyUnmatched?: boolean
}

export interface ComparisonResult {
  matchedItems?: MatchedItem[]
  missingItems: Array<{
    item: string
    quantity: number
    unitPrice: number
    totalPrice: number
    category?: string
    priority: 'critical' | 'minor'
    code?: string
    room?: string
    selected?: boolean
  }>
  adjusterOnlyItems?: Array<{
    item: string
    quantity: number
    unitPrice: number
    totalPrice: number
    category?: string
    priority: 'critical' | 'minor'
    code?: string
    room?: string
    selected?: boolean
  }>
  discrepancies: Array<{
    item: string
    adjusterValue: number | string
    contractorValue: number | string
    difference: number | string
    differencePercent: number
    type: 'quantity' | 'price' | 'measurement'
    priority: 'critical' | 'minor'
    code?: string
    selected?: boolean
  }>
  summary: {
    totalCostDifference: number
    matchedItemsCount?: number
    missingItemsCount: number
    adjusterOnlyItemsCount?: number
    discrepanciesCount: number
    criticalIssues: number
    minorIssues: number
  }
  processingTime?: number
  tokenUsage?: number
}

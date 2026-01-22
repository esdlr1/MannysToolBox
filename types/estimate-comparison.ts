// Type definitions for estimate comparison

export interface MatchedItem {
  contractorItem: string
  adjusterItem: string
  confidence: number
  matchReason: 'code_match' | 'description_match' | 'quantity_price_match' | 'similarity_match'
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
  }>
  discrepancies: Array<{
    item: string
    adjusterValue: number | string
    contractorValue: number | string
    difference: number | string
    differencePercent: number
    type: 'quantity' | 'price' | 'measurement'
    priority: 'critical' | 'minor'
  }>
  summary: {
    totalCostDifference: number
    matchedItemsCount?: number
    missingItemsCount: number
    discrepanciesCount: number
    criticalIssues: number
    minorIssues: number
  }
}

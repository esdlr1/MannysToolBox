// Type definitions for estimate comparison

export interface ComparisonResult {
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
    missingItemsCount: number
    discrepanciesCount: number
    criticalIssues: number
    minorIssues: number
  }
}

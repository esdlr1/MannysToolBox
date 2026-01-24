// Xactimate line item lookup system
// Uses the shared line items service for consistency across all tools
// This file maintains backward compatibility while using the new service

import * as lineItemsService from './line-items-service'

export interface XactimateLineItem {
  code: string
  description: string
  category?: string
  unit?: string
}

// Re-export functions from the shared service for backward compatibility
export function findByCode(code: string): XactimateLineItem | undefined {
  return lineItemsService.findByCode(code) as XactimateLineItem | undefined
}

export function findByDescription(description: string): XactimateLineItem[] {
  return lineItemsService.findByDescription(description) as XactimateLineItem[]
}

export function getAllLineItems(): XactimateLineItem[] {
  return lineItemsService.getAllLineItems() as XactimateLineItem[]
}

export function searchByKeyword(keyword: string, limit: number = 10): XactimateLineItem[] {
  return lineItemsService.searchByKeyword(keyword, limit) as XactimateLineItem[]
}

// Helper function for normalization (used by itemExistsInXactimate)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if a required item exists in the estimate using Xactimate lookup
 */
export function itemExistsInXactimate(
  lineItems: Array<{ description?: string; item?: string; code?: string }>,
  requiredKeywords: string[]
): boolean {
  // First, check if any line item code matches
  for (const item of lineItems) {
    const code = item.code?.toString().trim().toUpperCase()
    if (code) {
      const xactItem = findByCode(code)
      if (xactItem) {
        // Check if the Xactimate item description matches required keywords
        const xactDesc = normalize(xactItem.description)
        if (requiredKeywords.some((kw) => xactDesc.includes(normalize(kw)))) {
          return true
        }
      }
    }
    
    // Check description against Xactimate database
    const description = item.description || item.item || ''
    if (description) {
      const matches = findByDescription(description)
      for (const match of matches) {
        const matchDesc = normalize(match.description)
        if (requiredKeywords.some((kw) => matchDesc.includes(normalize(kw)))) {
          return true
        }
      }
    }
  }
  
  return false
}

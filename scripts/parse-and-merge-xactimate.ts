import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface XactimateLineItem {
  code: string
  description: string
  category?: string
  unit?: string
}

/**
 * Parse Xactimate line items from Excel file
 */
function parseXactimateLineItems(filePath: string, categoryName?: string): XactimateLineItem[] {
  const workbook = XLSX.readFile(filePath)
  console.log('Available sheets:', workbook.SheetNames)
  
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  
  // Find header row (usually first row)
  const headers = data[0] || []
  console.log('Headers found:', headers)
  
  // Find column indices
  // Prefer "Sel" over "Group Code" as Sel is the actual line item code
  let codeIndex = -1
  let selIndex = -1
  
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.toString().toLowerCase() || ''
    if (h === 'sel' || h === 'selector') {
      selIndex = i
    } else if (h.includes('code') && !h.includes('group')) {
      if (codeIndex === -1) codeIndex = i
    } else if (h.includes('group code')) {
      // Group code is secondary - we'll use it if Sel is not found
      if (codeIndex === -1) codeIndex = i
    }
  }
  
  // Prefer Sel over Group Code
  if (selIndex >= 0) {
    codeIndex = selIndex
    console.log(`Found Sel column at index ${selIndex}: "${headers[selIndex]}"`)
  } else if (codeIndex >= 0) {
    console.log(`Found code column at index ${codeIndex}: "${headers[codeIndex]}"`)
  }
  
  // If still not found, check last column
  if (codeIndex === -1 && data.length > 1) {
    const lastColIndex = headers.length - 1
    const lastColHeader = headers[lastColIndex]?.toString().toLowerCase() || ''
    if (lastColHeader === 'sel' || lastColHeader.includes('code')) {
      codeIndex = lastColIndex
      console.log(`Using last column as code: "${headers[lastColIndex]}"`)
    }
  }
  
  // Find description column - prefer "Desc" over "Group Description"
  let descIndex = -1
  let groupDescIndex = -1
  
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.toString().toLowerCase() || ''
    if (h === 'desc' && !h.includes('group')) {
      descIndex = i
    } else if (h.includes('group description')) {
      groupDescIndex = i
    } else if (h.includes('description') && !h.includes('group') && descIndex === -1) {
      descIndex = i
    }
  }
  
  // Prefer "Desc" over "Group Description"
  const finalDescIndex = descIndex >= 0 ? descIndex : (groupDescIndex >= 0 ? groupDescIndex : (codeIndex >= 0 ? codeIndex + 1 : 0))
  
  const categoryIndex = headers.findIndex((h: string) => 
    h && (h.toString().toLowerCase().includes('category') || 
         h.toString().toLowerCase().includes('trade') ||
         h.toString().toLowerCase().includes('cat'))
  )
  
  const unitIndex = headers.findIndex((h: string) => 
    h && (h.toString().toLowerCase().includes('unit') || 
         h.toString().toLowerCase().includes('uom'))
  )
  
  console.log('Column indices:', { codeIndex, descIndex: finalDescIndex, categoryIndex, unitIndex })
  
  // Parse rows (skip header)
  const lineItems: XactimateLineItem[] = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue
    
    const code = codeIndex >= 0 ? (row[codeIndex]?.toString().trim() || '') : ''
    const description = row[finalDescIndex]?.toString().trim() || ''
    
    // Skip empty rows
    if (!code && !description) continue
    
    // Use provided category name or extract from file
    let category = categoryName
    if (!category && categoryIndex >= 0) {
      category = row[categoryIndex]?.toString().trim() || undefined
    }
    // If still no category, try to infer from file name
    if (!category) {
      const fileName = filePath.split(/[/\\]/).pop() || ''
      if (fileName.toUpperCase().includes('APP')) {
        category = 'APP' // Appliances
      }
    }
    
    lineItems.push({
      code: code,
      description: description,
      category: category,
      unit: unitIndex >= 0 ? row[unitIndex]?.toString().trim() : undefined,
    })
  }
  
  return lineItems
}

// Main execution - parse multiple files and merge
// First, load existing data if it exists
const existingDataPath = join(process.cwd(), 'lib', 'xactimate-line-items.json')
const fs = require('fs')
let allLineItems: XactimateLineItem[] = []

if (fs.existsSync(existingDataPath)) {
  try {
    const existingData = JSON.parse(fs.readFileSync(existingDataPath, 'utf-8'))
    allLineItems = existingData as XactimateLineItem[]
    console.log(`\n=== Loaded ${allLineItems.length} existing line items ===`)
  } catch (error) {
    console.log('Could not load existing data, starting fresh')
  }
}

const files = [
  { path: 'C:\\Users\\esdlr\\Downloads\\SUERO-TEST.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\APP.xlsx', category: 'APP' },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix1.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix2.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix3.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix4.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix5.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix6.xlsx', category: undefined },
  { path: 'C:\\Users\\esdlr\\Downloads\\Mix7.xlsx', category: undefined },
]

for (const file of files) {
  console.log(`\n=== Parsing ${file.path} ===`)
  try {
    // Check if file exists first
    const fs = require('fs')
    if (!fs.existsSync(file.path)) {
      console.log(`File not found, skipping: ${file.path}`)
      continue
    }
    
    const items = parseXactimateLineItems(file.path, file.category)
    console.log(`Parsed ${items.length} line items`)
    allLineItems.push(...items)
  } catch (error: any) {
    console.error(`Error parsing ${file.path}:`, error.message)
  }
}

  // Remove duplicates - be smarter about what constitutes a duplicate
  // Use code + description as unique key, but allow variations
  const uniqueItems = new Map<string, XactimateLineItem>()
  for (const item of allLineItems) {
    const normalizedDesc = (item.description || '').trim()
    if (!normalizedDesc || normalizedDesc.length < 3) continue // Skip items without meaningful descriptions
    
    // Create a unique key - prefer code if available, otherwise use description
    let key: string
    if (item.code && item.code.trim()) {
      key = `${item.code.trim().toUpperCase()}-${normalizedDesc.toUpperCase()}`
    } else {
      // For items without codes, use description only (might have duplicates, but that's okay)
      key = normalizedDesc.toUpperCase()
    }
    
    // Only add if we don't have this exact combination
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, item)
    } else {
      // If we have the same key but one has a code and the other doesn't, prefer the one with code
      const existing = uniqueItems.get(key)!
      if (!existing.code && item.code && item.code.trim()) {
        uniqueItems.set(key, item)
      }
    }
  }

const finalItems = Array.from(uniqueItems.values())

console.log(`\n=== Summary ===`)
console.log(`Total unique line items: ${finalItems.length}`)

// Group by category
const byCategory = new Map<string, number>()
for (const item of finalItems) {
  const cat = item.category || 'UNKNOWN'
  byCategory.set(cat, (byCategory.get(cat) || 0) + 1)
}

console.log('\nItems by category:')
for (const [cat, count] of Array.from(byCategory.entries()).sort()) {
  console.log(`  ${cat}: ${count}`)
}

// Save to JSON file
const outputPath = join(process.cwd(), 'lib', 'xactimate-line-items.json')
writeFileSync(outputPath, JSON.stringify(finalItems, null, 2), 'utf-8')

console.log(`\nSaved to ${outputPath}`)
console.log('\nSample items:')
finalItems.slice(0, 15).forEach((item, i) => {
  console.log(`${i + 1}. [${item.code || 'NO CODE'}] ${item.description} (${item.category || 'NO CAT'})`)
})

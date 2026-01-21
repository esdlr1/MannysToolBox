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
function parseXactimateLineItems(filePath: string): XactimateLineItem[] {
  const workbook = XLSX.readFile(filePath)
  console.log('Available sheets:', workbook.SheetNames)
  
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  
  // Find header row (usually first row)
  const headers = data[0] || []
  console.log('Headers found:', headers)
  
  // Show first few data rows for debugging
  console.log('\nFirst 3 data rows:')
  for (let i = 1; i < Math.min(4, data.length); i++) {
    console.log(`Row ${i}:`, data[i])
  }
  
  // Find column indices - check all columns
  console.log('All headers:', headers)
  
  // Try to find code column - check for "Sel", "Code", "Line Item", etc.
  let codeIndex = -1
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.toString().toLowerCase() || ''
    if (h.includes('code') || 
        h.includes('line item') || 
        h.includes('item code') || 
        h === 'code' ||
        h === 'sel' ||
        h.includes('select')) {
      codeIndex = i
      console.log(`Found code column at index ${i}: "${headers[i]}"`)
      break
    }
  }
  
  // If still not found, check last column (often codes are at the end)
  if (codeIndex === -1 && data.length > 1) {
    const lastColIndex = headers.length - 1
    const lastColHeader = headers[lastColIndex]?.toString().toLowerCase() || ''
    if (lastColHeader === 'sel' || lastColHeader.includes('code')) {
      codeIndex = lastColIndex
      console.log(`Using last column as code: "${headers[lastColIndex]}"`)
    }
  }
  
  const descIndex = headers.findIndex((h: string) => 
    h && (h.toString().toLowerCase().includes('description') || 
         h.toString().toLowerCase().includes('desc') ||
         (h.toString().toLowerCase().includes('item') && !h.toString().toLowerCase().includes('code')))
  )
  
  // If descIndex not found, use index 0 (first column after code)
  const finalDescIndex = descIndex >= 0 ? descIndex : (codeIndex >= 0 ? codeIndex + 1 : 0)
  const categoryIndex = headers.findIndex((h: string) => 
    h && (h.toString().toLowerCase().includes('category') || 
         h.toString().toLowerCase().includes('trade') ||
         h.toString().toLowerCase().includes('cat'))
  )
  const unitIndex = headers.findIndex((h: string) => 
    h && (h.toString().toLowerCase().includes('unit') || 
         h.toString().toLowerCase().includes('uom'))
  )
  
  console.log('Column indices:', { codeIndex, descIndex, categoryIndex, unitIndex })
  
  // Parse rows (skip header)
  const lineItems: XactimateLineItem[] = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue
    
    const code = codeIndex >= 0 ? (row[codeIndex]?.toString().trim() || '') : ''
    const description = row[finalDescIndex]?.toString().trim() || ''
    
    // Skip empty rows
    if (!code && !description) continue
    
    // Extract code from description if it's in format like "CODE - Description" or at the start
    let extractedCode = code
    if (!extractedCode && description) {
      // Check if description starts with something that looks like a code
      const codeMatch = description.match(/^([A-Z0-9\-\.]+)\s*[-–—]\s*(.+)$/i)
      if (codeMatch) {
        extractedCode = codeMatch[1].trim()
        // Update description to remove code
        const updatedDesc = codeMatch[2].trim()
        if (updatedDesc) {
          // Use the description without code
        }
      }
    }
    
    lineItems.push({
      code: extractedCode,
      description: description,
      category: categoryIndex >= 0 ? row[categoryIndex]?.toString().trim() : undefined,
      unit: unitIndex >= 0 ? row[unitIndex]?.toString().trim() : undefined,
    })
  }
  
  return lineItems
}

// Main execution
const filePath = 'C:\\Users\\esdlr\\Downloads\\SUERO-TEST.xlsx'
console.log('Reading file:', filePath)

try {
  const lineItems = parseXactimateLineItems(filePath)
  console.log(`Parsed ${lineItems.length} line items`)
  
  // Save to JSON file
  const outputPath = join(process.cwd(), 'lib', 'xactimate-line-items.json')
  writeFileSync(outputPath, JSON.stringify(lineItems, null, 2), 'utf-8')
  
  console.log(`Saved to ${outputPath}`)
  console.log('\nSample items:')
  lineItems.slice(0, 10).forEach((item, i) => {
    console.log(`${i + 1}. [${item.code}] ${item.description}`)
  })
} catch (error) {
  console.error('Error parsing file:', error)
  process.exit(1)
}

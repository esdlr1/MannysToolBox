// PDF parsing utilities for construction estimates
import pdfParse from 'pdf-parse'
import { readFile } from 'fs/promises'
import { ParsedEstimate, LineItem, Measurement } from './estimate-parser'
import { callAI } from './ai'

/**
 * Fix duplicate keys in JSON string by keeping the last occurrence
 */
function fixDuplicateKeys(jsonString: string): string {
  try {
    // Try to parse and stringify to remove duplicates (JSON.parse automatically keeps last)
    // But we need to handle the case where it's already invalid
    // So we'll use a regex approach for common cases
    
    // Fix duplicate keys in objects (simple case: same key appears twice in a row)
    let fixed = jsonString
    
    // Remove duplicate consecutive keys (keep last)
    fixed = fixed.replace(/"([^"]+)":\s*([^,}\]]+),?\s*"([^"]+)":\s*\2(?=\s*[,}])/g, '"$3": $2')
    
    // Fix common patterns like "unitPrice": 0.37, "unitPrice": 187.08 -> keep last
    const duplicateKeyPattern = /"([^"]+)":\s*([^,}\]]+),?\s*"(\1)":\s*([^,}\]]+)/g
    fixed = fixed.replace(duplicateKeyPattern, '"$1": $4')
    
    return fixed
  } catch {
    return jsonString
  }
}

/**
 * Extract text from PDF file
 */
export async function extractPDFText(filePath: string): Promise<string> {
  try {
    console.log('[PDF Parser] Reading file:', filePath)
    const dataBuffer = await readFile(filePath)
    console.log('[PDF Parser] File size:', dataBuffer.length, 'bytes')
    
    if (dataBuffer.length === 0) {
      throw new Error('PDF file is empty')
    }
    
    console.log('[PDF Parser] Parsing PDF...')
    const data = await pdfParse(dataBuffer)
    const extractedText = data.text || ''
    console.log('[PDF Parser] Extracted text length:', extractedText.length, 'characters')
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('PDF appears to be image-based (scanned document). No text could be extracted. Please use a PDF with selectable text or convert the scanned PDF using OCR.')
    }
    
    return extractedText
  } catch (error: any) {
    console.error('[PDF Parser] Extraction error:', {
      message: error.message,
      code: error.code,
      path: filePath,
    })
    
    if (error.code === 'ENOENT') {
      throw new Error(`PDF file not found: ${filePath}`)
    }
    
    if (error.message?.includes('image-based') || error.message?.includes('scanned')) {
      throw error
    }
    
    throw new Error(`Failed to extract text from PDF: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Detect estimate format from text
 */
export function detectEstimateFormat(text: string): 'xactimate' | 'symbility' | 'pdf' | 'unknown' {
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('xactimate') || lowerText.includes('xact')) {
    return 'xactimate'
  }
  
  if (lowerText.includes('symbility') || lowerText.includes('sym')) {
    return 'symbility'
  }
  
  // Check for common construction estimate patterns
  if (lowerText.includes('line item') || lowerText.includes('quantity') || lowerText.includes('unit price')) {
    return 'pdf'
  }
  
  return 'unknown'
}

/**
 * Parse estimate text into structured data using AI
 */
export async function parseEstimateTextWithAI(
  text: string,
  format: 'xactimate' | 'symbility' | 'pdf' | 'unknown'
): Promise<ParsedEstimate> {
  // Truncate text if too long (keep first and last parts)
  const maxLength = 15000 // Leave room for prompt
  let processedText = text
  
  if (text.length > maxLength) {
    const firstPart = text.substring(0, maxLength / 2)
    const lastPart = text.substring(text.length - maxLength / 2)
    processedText = `${firstPart}\n\n[... middle content truncated ...]\n\n${lastPart}`
  }

  const formatSpecific = format === 'xactimate' 
    ? 'Xactimate format with line item codes'
    : format === 'symbility'
    ? 'Symbility format'
    : 'Standard construction estimate format'

  const parsePrompt = `
Extract structured data from this construction estimate.

Format: ${formatSpecific}

Extract the following information:
1. Line Items - Each item should include:
   - Item description/name
   - Quantity
   - Unit (sq ft, lf, ea, etc.)
   - Unit price
   - Total price
   - Category (if available: roofing, siding, interior, etc.)
   - Code (Xactimate/Symbility code if present)

2. Measurements - Extract any measurements mentioned:
   - Type (area, linear, volume, count)
   - Description
   - Value
   - Unit
   - Location (if mentioned)

3. Total Cost - The grand total of the estimate

4. Subtotals - Any category subtotals (roofing, siding, etc.)

ESTIMATE TEXT:
${processedText}

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  "lineItems": [
    {
      "item": "string (item name/code)",
      "description": "string (full description)",
      "quantity": number,
      "unit": "string (sq ft, lf, ea, etc.)",
      "unitPrice": number,
      "totalPrice": number,
      "category": "string (optional)",
      "code": "string (Xactimate/Symbility code if available)"
    }
  ],
  "measurements": [
    {
      "type": "area" | "linear" | "volume" | "count",
      "description": "string",
      "value": number,
      "unit": "string",
      "location": "string (optional)"
    }
  ],
  "totalCost": number,
  "subtotals": {
    "category1": number,
    "category2": number
  },
  "metadata": {
    "format": "${format}",
    "date": "string (if found)",
    "projectName": "string (if found)"
  }
}

IMPORTANT:
- Extract ALL line items you can find
- Be accurate with numbers (quantities, prices)
- If a field is not available, use null or empty string
- Return ONLY the JSON object, nothing else
`

  try {
    console.log('[PDF Parser] Calling AI to parse estimate text...', {
      textLength: processedText.length,
      format,
    })
    
    const aiResponse = await callAI({
      prompt: parsePrompt,
      toolId: 'estimate-comparison',
      systemPrompt: `You are an expert at parsing construction estimates. You understand:
- Xactimate line item codes and format
- Symbility estimate structure
- Standard construction estimate formats
- Construction terminology and abbreviations
- How to extract line items, quantities, prices, and measurements accurately

Your task is to extract structured data from estimate text and return it as valid JSON.
IMPORTANT: Always return COMPLETE, valid JSON. Never truncate the response mid-JSON.`,
      temperature: 0.1, // Very low for accuracy
      maxTokens: 8000, // Increased to handle larger estimates
    })

    if (aiResponse.error) {
      console.error('[PDF Parser] AI returned error:', aiResponse.error)
      throw new Error(`AI parsing failed: ${aiResponse.error}`)
    }
    
    console.log('[PDF Parser] AI response received:', {
      responseLength: aiResponse.result?.length || 0,
      hasResult: !!aiResponse.result,
    })

    // Parse AI response
    let parsedData: ParsedEstimate
    
    try {
      // Clean response - remove markdown if present
      let cleanedResponse = aiResponse.result.trim()
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      // Fix common AI JSON errors
      // Fix truncated null values
      cleanedResponse = cleanedResponse.replace(/:\s*nul\b/g, ': null')
      cleanedResponse = cleanedResponse.replace(/:\s*"nul"/g, ': null')
      
      // Fix duplicate keys by removing duplicates (keep last occurrence)
      // This is a simple approach - for complex cases, we'd need a proper JSON parser
      // But first, let's try to extract and fix the JSON
      
      // Extract JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }
      
      let jsonString = jsonMatch[0]
      
      // Try to fix duplicate keys in lineItems array
      // This regex finds duplicate keys within objects and removes the first occurrence
      // Note: This is a heuristic approach - proper solution would require a full JSON parser
      jsonString = jsonString.replace(/"([^"]+)":\s*([^,}\]]+),?\s*"([^"]+)":\s*\2/g, '"$3": $2')
      
      // Try parsing - if it fails, attempt to fix common issues
      try {
        parsedData = JSON.parse(jsonString)
      } catch (parseError: any) {
        console.warn('[PDF Parser] Initial JSON parse failed, attempting to fix...', {
          error: parseError.message,
          position: parseError.message.match(/position (\d+)/)?.[1],
        })
        
        // More aggressive fixes
        let fixedJson = fixDuplicateKeys(jsonString)
        
        // Additional fixes for common JSON errors
        // Fix missing commas between array elements
        fixedJson = fixedJson.replace(/\}\s*\{/g, '}, {')
        fixedJson = fixedJson.replace(/\}\s*"/g, '}, "')
        
        // Fix unquoted keys (if any)
        fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
        
        // Try parsing again
        try {
          parsedData = JSON.parse(fixedJson)
        } catch (secondError: any) {
          // If still failing, try to extract just the lineItems array
          console.warn('[PDF Parser] Second parse attempt failed, trying to extract lineItems...', {
            error: secondError.message,
            position: secondError.message.match(/position (\d+)/)?.[1],
          })
          throw secondError // Will be caught by outer catch
        }
      }
      
      // Validate and set defaults
      if (!parsedData.lineItems) parsedData.lineItems = []
      if (!parsedData.measurements) parsedData.measurements = []
      if (!parsedData.totalCost) parsedData.totalCost = 0
      if (!parsedData.subtotals) parsedData.subtotals = {}
      if (!parsedData.metadata) {
        parsedData.metadata = {
          format,
          date: undefined,
          projectName: undefined,
        }
      }
      
      // Ensure all line items have required fields
      parsedData.lineItems = parsedData.lineItems.map((item: any) => ({
        item: item.item || item.description || '',
        description: item.description || item.item || '',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || '',
        unitPrice: Number(item.unitPrice) || 0,
        totalPrice: Number(item.totalPrice) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        category: item.category || '',
        code: item.code || '',
      }))
      
    } catch (parseError: any) {
      console.error('[PDF Parser] Failed to parse AI response:', parseError)
      console.error('[PDF Parser] AI Response length:', aiResponse.result?.length || 0)
      console.error('[PDF Parser] AI Response preview:', aiResponse.result?.substring(0, 500) || 'No response')
      console.error('[PDF Parser] AI Response end:', aiResponse.result?.substring(Math.max(0, (aiResponse.result?.length || 0) - 200)) || 'No response')
      
      // Try one more time with more aggressive fixes
      try {
        console.log('[PDF Parser] Attempting aggressive JSON fix...')
        let lastAttempt = aiResponse.result.trim()
        lastAttempt = lastAttempt.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        
        // Fix truncated null
        lastAttempt = lastAttempt.replace(/:\s*nul\b/g, ': null')
        lastAttempt = lastAttempt.replace(/:\s*"nul"/g, ': null')
        
        // Remove trailing commas
        lastAttempt = lastAttempt.replace(/,(\s*[}\]])/g, '$1')
        
        // Try to extract just the lineItems array if the root object is broken
        const lineItemsMatch = lastAttempt.match(/"lineItems":\s*\[([\s\S]*?)\]/)
        const totalCostMatch = lastAttempt.match(/"totalCost":\s*([\d.]+)/)
        
        if (lineItemsMatch || totalCostMatch) {
          // Reconstruct a minimal valid JSON
          let lineItems: any[] = []
          if (lineItemsMatch) {
            try {
              // Try to parse the lineItems array
              const itemsJson = `[${lineItemsMatch[1]}]`
              // Fix common issues in the array
              const fixedItems = itemsJson
                .replace(/:\s*nul\b/g, ': null')
                .replace(/,(\s*[}\]])/g, '$1')
              lineItems = JSON.parse(fixedItems)
            } catch {
              // If we can't parse the array, try to extract individual items
              const itemMatches = lineItemsMatch[1].match(/\{[^}]*"item"[^}]*\}/g)
              if (itemMatches) {
                lineItems = itemMatches.map((itemStr: string) => {
                  try {
                    return JSON.parse(itemStr.replace(/:\s*nul\b/g, ': null'))
                  } catch {
                    return null
                  }
                }).filter((item: any) => item !== null)
              }
            }
          }
          
          const totalCost = totalCostMatch ? parseFloat(totalCostMatch[1]) : 0
          
          parsedData = {
            lineItems: lineItems.map((item: any) => ({
              item: item.item || item.description || '',
              description: item.description || item.item || '',
              quantity: Number(item.quantity) || 0,
              unit: item.unit || '',
              unitPrice: Number(item.unitPrice) || 0,
              totalPrice: Number(item.totalPrice) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
              category: item.category || '',
              code: item.code || '',
            })),
            measurements: [],
            totalCost,
            subtotals: {},
            metadata: { format, date: undefined, projectName: undefined },
          }
          
          console.log('[PDF Parser] Successfully recovered partial data:', {
            lineItems: parsedData.lineItems.length,
            totalCost: parsedData.totalCost,
          })
        } else {
          throw parseError
        }
      } catch (recoveryError: any) {
        console.error('[PDF Parser] Recovery attempt failed:', recoveryError)
        
        // If JSON is incomplete, provide helpful error
        if (parseError.message?.includes('Unexpected end of JSON') || parseError.message?.includes('end of JSON')) {
          throw new Error(`AI response was truncated. The response may be too long. Try reducing the estimate size or contact support. Error: ${parseError.message}`)
        }
        
        throw new Error(`Failed to parse estimate data: ${parseError.message}`)
      }
    }

    return parsedData
  } catch (error: any) {
    console.error('AI parsing error:', error)
    throw error
  }
}

/**
 * Main function to parse PDF estimate file
 */
export async function parseEstimatePDF(filePath: string): Promise<ParsedEstimate> {
  try {
    console.log('[PDF Parser] Starting PDF parsing for:', filePath)
    
    // Step 1: Extract text from PDF
    const text = await extractPDFText(filePath)
    
    if (!text || text.trim().length === 0) {
      throw new Error('PDF appears to be empty or image-based. OCR may be required.')
    }
    
    // Step 2: Detect format
    const format = detectEstimateFormat(text)
    console.log('[PDF Parser] Detected format:', format)
    
    // Step 3: Parse with AI
    console.log('[PDF Parser] Parsing with AI...')
    const parsedData = await parseEstimateTextWithAI(text, format)
    console.log('[PDF Parser] Parsing completed:', {
      lineItems: parsedData.lineItems?.length || 0,
      totalCost: parsedData.totalCost,
    })
    
    return parsedData
  } catch (error: any) {
    console.error('[PDF Parser] PDF parsing error:', {
      message: error.message,
      stack: error.stack,
      filePath,
    })
    
    // Preserve specific error messages
    if (error.message?.includes('image-based') || 
        error.message?.includes('scanned') ||
        error.message?.includes('not found') ||
        error.message?.includes('empty')) {
      throw error
    }
    
    throw new Error(`Failed to parse PDF: ${error.message || 'Unknown error'}`)
  }
}

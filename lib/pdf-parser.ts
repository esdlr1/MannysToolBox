// PDF parsing utilities for construction estimates
import pdfParse from 'pdf-parse'
import { readFile } from 'fs/promises'
import { ParsedEstimate, LineItem, Measurement } from './estimate-parser'
import { callAI } from './ai'

/**
 * Extract text from PDF file
 */
export async function extractPDFText(filePath: string): Promise<string> {
  try {
    const dataBuffer = await readFile(filePath)
    const data = await pdfParse(dataBuffer)
    return data.text
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract text from PDF')
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
      throw new Error(aiResponse.error)
    }

    // Parse AI response
    let parsedData: ParsedEstimate
    
    try {
      // Clean response - remove markdown if present
      let cleanedResponse = aiResponse.result.trim()
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      // Extract JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }
      
      parsedData = JSON.parse(jsonMatch[0])
      
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
      console.error('Failed to parse AI response:', parseError)
      console.error('AI Response length:', aiResponse.result?.length || 0)
      console.error('AI Response preview:', aiResponse.result?.substring(0, 500) || 'No response')
      console.error('AI Response end:', aiResponse.result?.substring(Math.max(0, (aiResponse.result?.length || 0) - 200)) || 'No response')
      
      // If JSON is incomplete, provide helpful error
      if (parseError.message?.includes('Unexpected end of JSON') || parseError.message?.includes('end of JSON')) {
        throw new Error(`AI response was truncated. The response may be too long. Try reducing the estimate size or contact support. Error: ${parseError.message}`)
      }
      
      throw new Error(`Failed to parse estimate data: ${parseError.message}`)
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
    // Step 1: Extract text from PDF
    const text = await extractPDFText(filePath)
    
    if (!text || text.trim().length === 0) {
      throw new Error('PDF appears to be empty or image-based. OCR may be required.')
    }
    
    // Step 2: Detect format
    const format = detectEstimateFormat(text)
    
    // Step 3: Parse with AI
    const parsedData = await parseEstimateTextWithAI(text, format)
    
    return parsedData
  } catch (error: any) {
    console.error('PDF parsing error:', error)
    throw new Error(`Failed to parse PDF: ${error.message}`)
  }
}

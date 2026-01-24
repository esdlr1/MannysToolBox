import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { searchByKeyword, findByCode } from '@/lib/xactimate-lookup'
import { generateTCSAnalysis } from '@/lib/tcs-analysis-service'
import { getPromptHints } from '@/lib/logic-rules'
import { XactimateAnalysis, getAllLineItems, XactimateLineItem } from '@/types/xactimate-analysis'

export const dynamic = 'force-dynamic'

// Helper function to generate estimate from TCS Analysis
async function generateEstimateFromTCSAnalysis(
  analysis: XactimateAnalysis,
  projectInfo: { projectName: string; claimNumber: string; propertyAddress: string }
) {
  const allLineItems = getAllLineItems(analysis)
  
  // Convert TCS line items to estimate line items
  const estimateLineItems = allLineItems.map((item: XactimateLineItem, idx: number) => {
    // Find the room for this item
    const room = analysis.rooms.find(r => r.lineItems.includes(item))
    
    // Try to find Xactimate code if not already set
    let code = item.code
    if (!code && item.category && item.description) {
      const matches = searchByKeyword(`${item.category} ${item.description}`, 5)
      if (matches.length > 0) {
        code = matches[0].code
      }
    }
    
    // Estimate quantity and pricing (basic estimates)
    const quantity = item.quantity || 1.0
    const unit = item.unit || 'EA'
    const unitPrice = item.unitPrice || (code ? 50.0 : 100.0) // Default pricing
    const totalPrice = quantity * unitPrice
    
    return {
      code: code || `ITEM${idx + 1}`,
      description: item.description || item.title,
      quantity,
      unit,
      unitPrice,
      totalPrice,
      room: room?.roomType || 'General',
      category: item.category || 'Other',
    }
  })
  
  // Calculate summary
  const totalCost = estimateLineItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const byCategory: Record<string, number> = {}
  const byRoom: Record<string, number> = {}
  
  estimateLineItems.forEach(item => {
    byCategory[item.category] = (byCategory[item.category] || 0) + item.totalPrice
    byRoom[item.room] = (byRoom[item.room] || 0) + item.totalPrice
  })
  
  return {
    estimate: {
      projectName: projectInfo.projectName,
      claimNumber: projectInfo.claimNumber,
      propertyAddress: projectInfo.propertyAddress,
      date: new Date().toISOString().split('T')[0],
      lineItems: estimateLineItems,
      summary: {
        totalLineItems: estimateLineItems.length,
        totalCost,
        byCategory,
        byRoom,
      },
      rooms: Array.from(new Set(estimateLineItems.map(item => item.room))),
    },
    notes: [
      `Generated from TCS Professional Analysis`,
      `Overall Damage Category: ${analysis.overallDamageCategory}`,
      analysis.projectNotes || '',
    ].filter(Boolean),
  }
}

function isOpenAIAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  const normalized = message.toLowerCase()
  return (
    normalized.includes('incorrect api key') ||
    normalized.includes('invalid_api_key') ||
    normalized.includes('openai_api_key') ||
    normalized.includes('missing api key') ||
    normalized.includes('api key') ||
    normalized.includes('format is invalid')
  )
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId, projectName, claimNumber, propertyAddress } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 })
    }

    const fileRecord = await prisma.file.findUnique({
      where: { id: fileId },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (fileRecord.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if file exists on filesystem
    if (!existsSync(fileRecord.path)) {
      console.error('[PhotoXact] File not found:', fileRecord.path)
      return NextResponse.json(
        { error: 'File not found on server. Please upload the file again.' },
        { status: 404 }
      )
    }

    // Read image file and convert to base64
    const imageBuffer = await readFile(fileRecord.path)
    const base64Image = imageBuffer.toString('base64')
    
    // Determine MIME type from file extension or mimeType
    let mimeType = fileRecord.mimeType || 'image/jpeg'
    if (!mimeType.startsWith('image/')) {
      const ext = fileRecord.originalName.split('.').pop()?.toLowerCase()
      if (ext === 'png') mimeType = 'image/png'
      else if (ext === 'gif') mimeType = 'image/gif'
      else if (ext === 'webp') mimeType = 'image/webp'
      else mimeType = 'image/jpeg'
    }

    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Generate TCS Professional Analysis (Xactimate Analysis) - TheClearScope logic
    console.log('[PhotoXact] Generating TCS Professional Analysis...')
    let xactimateAnalysis: XactimateAnalysis | null = null
    try {
      xactimateAnalysis = await generateTCSAnalysis({
        images: [imageDataUrl],
        damageDescription: propertyAddress || projectName || 'Property damage assessment',
        userLocation: propertyAddress,
      })
      console.log('[PhotoXact] TCS Analysis complete:', {
        rooms: xactimateAnalysis.rooms.length,
        totalLineItems: getAllLineItems(xactimateAnalysis).length,
      })
    } catch (tcsError: any) {
      console.error('[PhotoXact] TCS Analysis error:', tcsError)
      // Continue with regular estimate even if TCS Analysis fails
    }

    // User-taught PhotoXact rules (from Teach the logic)
    const promptHints = await getPromptHints('photoxact')
    const taughtRulesBlock =
      promptHints.length > 0
        ? `
ADDITIONAL RULES (user-taught – follow these):
${promptHints.map((h) => `- ${h}`).join('\n')}

`
        : ''

    // Use TCS Analysis results to inform the estimate if available
    const tcsContext = xactimateAnalysis ? `
TCS PROFESSIONAL ANALYSIS RESULTS (use this to inform your estimate):
- Overall Damage Category: ${xactimateAnalysis.overallDamageCategory}
- Rooms Identified: ${xactimateAnalysis.rooms.map(r => r.roomType).join(', ')}
- Total Line Items: ${getAllLineItems(xactimateAnalysis).length}
- Project Notes: ${xactimateAnalysis.projectNotes || 'None'}

Use this analysis to create a comprehensive estimate with proper Xactimate codes, quantities, and pricing.
` : ''

    // Create comprehensive prompt for full estimate generation
    const estimatePrompt = `
Analyze this construction/damage photo and create a COMPLETE, PROFESSIONAL construction estimate.

YOUR GOAL: Create a FULL, READY-TO-USE estimate with all necessary line items, quantities, and pricing.

${tcsContext}

PROJECT INFORMATION:
${projectName ? `Project Name: ${projectName}` : ''}
${claimNumber ? `Claim Number: ${claimNumber}` : ''}
${propertyAddress ? `Property Address: ${propertyAddress}` : ''}

ESTIMATE REQUIREMENTS:
1. Analyze ALL visible damage and restoration needs - be thorough
2. Include ALL line items needed for complete restoration to pre-loss condition
3. Use ACTUAL Xactimate codes from the 13,000+ database (search if you're not sure of a code)
4. Provide accurate quantities based on what's visible (estimate reasonably)
5. Include unit prices (use standard Xactimate pricing - estimate if needed)
6. Calculate total prices for each line item
7. Organize by rooms/locations
8. Include summary totals

WHAT TO INCLUDE (be comprehensive):
- VISIBLE DAMAGE: What you can clearly see in the photo
- PREP WORK: Protection, demolition, cleanup, debris removal
- REPAIR WORK: All materials and labor needed for restoration
- FINISH WORK: Paint, texture, trim, caulking, final touches
- RELATED ITEMS: Complete scope (e.g., if drywall is damaged, include: demo, drywall, texture, paint, trim)
- FIXTURES: All fixtures that need repair/replacement
- MEASUREMENTS: Room dimensions, areas, linear feet (estimate from photo)

IMPORTANT RULES:
- Use Xactimate codes from the 13k+ database - if unsure, use descriptive codes or search by description
- Match codes to descriptions as closely as possible
- Use proper Xactimate descriptions from the database
- Calculate quantities based on visible damage (reasonable estimates are acceptable)
- Include all related items for complete restoration
- Organize by room/location when applicable
- If you can see work/damage in the photo, include it in the estimate
${taughtRulesBlock}
Return your response as JSON in this exact format:
{
  "estimate": {
    "projectName": "${projectName || 'Photo Estimate'}",
    "claimNumber": "${claimNumber || ''}",
    "propertyAddress": "${propertyAddress || ''}",
    "date": "${new Date().toISOString().split('T')[0]}",
    "lineItems": [
      {
        "code": "XACTIMATE CODE (required - must exist in database)",
        "description": "Full Xactimate description",
        "quantity": 1.0,
        "unit": "EA",
        "unitPrice": 100.00,
        "totalPrice": 100.00,
        "room": "Kitchen",
        "category": "Drywall"
      }
    ],
    "summary": {
      "totalLineItems": 0,
      "totalCost": 0.00,
      "byCategory": {
        "Drywall": 0.00,
        "Paint": 0.00,
        "Plumbing": 0.00,
        "Electrical": 0.00
      },
      "byRoom": {
        "Kitchen": 0.00,
        "Living Room": 0.00
      }
    },
    "measurements": [
      {
        "type": "Area",
        "description": "Kitchen floor",
        "value": 120,
        "unit": "sq ft"
      }
    ],
    "rooms": ["Kitchen", "Living Room"]
  },
  "notes": ["Any relevant notes about the estimate"]
}

CRITICAL: 
- Return ONLY valid JSON. No markdown, no explanations. 
- This must be a complete, professional estimate.
- If you can see damage or work in the photo, include it in the estimate.
- Use reasonable estimates for quantities and prices.
- DO NOT say "I'm unable to create an estimate" - create the best estimate you can based on what's visible.
`

    console.log('[PhotoXact] Generating estimate from photo...', {
      fileId,
      fileName: fileRecord.originalName,
      imageSize: imageBuffer.length,
      projectName,
      claimNumber,
    })

    const aiResponse = await callAI({
      prompt: estimatePrompt,
      toolId: 'photoxact',
      systemPrompt: `You are an expert Xactimate estimator creating complete, professional construction estimates from photos.

Your expertise includes:
- Complete restoration scope analysis
- Accurate quantity calculations from photos
- Proper Xactimate code selection from 13k+ database
- Standard Xactimate pricing
- Professional estimate formatting
- Room/location organization
- Complete dependency inclusion (prep, repair, finish work)

CRITICAL REQUIREMENTS:
1. Create a COMPLETE estimate - analyze the photo and create a full estimate document
2. Use codes from the 13k+ Xactimate database (search by description if needed)
3. Calculate quantities based on visible damage (reasonable estimates are acceptable)
4. Include ALL items needed for complete restoration
5. Organize by rooms/locations
6. Calculate accurate totals
7. Use proper Xactimate descriptions and formatting
8. ALWAYS create an estimate - never say you're unable to create one
9. If you can see damage or work in the photo, include it in the estimate
10. Be thorough and comprehensive - include all visible work and needed repairs

Your estimate must be professional, complete, and ready to use. Always return valid JSON with a complete estimate structure.`,
      imageUrl: imageDataUrl,
      temperature: 0.3, // Slightly higher for more creative/complete estimates
      maxTokens: 8000,
      model: 'gpt-4o',
    })

    if (aiResponse.error) {
      if (isOpenAIAuthError(aiResponse.error)) {
        return NextResponse.json(
          { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
          { status: 401 }
        )
      }
      throw new Error(aiResponse.error)
    }

    // Parse AI response
    let result
    try {
      let cleaned = aiResponse.result.trim()
      
      // Log the raw response for debugging
      console.log('[PhotoXact] Raw AI Response (first 1000 chars):', cleaned.substring(0, 1000))
      
      // Remove markdown code blocks
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      // Try to find JSON in the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        // If no JSON found and we have TCS Analysis, use it to create estimate
        if (xactimateAnalysis) {
          console.log('[PhotoXact] No JSON in response, using TCS Analysis to generate estimate')
          result = await generateEstimateFromTCSAnalysis(xactimateAnalysis, {
            projectName: projectName || 'Photo Estimate',
            claimNumber: claimNumber || '',
            propertyAddress: propertyAddress || '',
          })
        } else {
          console.error('[PhotoXact] No JSON found and no TCS Analysis available')
          console.error('[PhotoXact] Full AI Response:', cleaned)
          throw new Error('No JSON found in AI response. AI said: ' + cleaned.substring(0, 200))
        }
      } else {
        result = JSON.parse(jsonMatch[0])
      }
    } catch (parseError: any) {
      console.error('[PhotoXact] AI response parse error:', parseError)
      console.error('[PhotoXact] AI Response (full):', aiResponse.result)
      
      // If we have TCS Analysis, try to use it as fallback
      if (xactimateAnalysis) {
        console.log('[PhotoXact] Using TCS Analysis as fallback to generate estimate')
        try {
          result = await generateEstimateFromTCSAnalysis(xactimateAnalysis, {
            projectName: projectName || 'Photo Estimate',
            claimNumber: claimNumber || '',
            propertyAddress: propertyAddress || '',
          })
        } catch (fallbackError: any) {
          return NextResponse.json(
            { error: 'Failed to generate estimate', details: parseError.message, fallbackError: fallbackError.message },
            { status: 500 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Failed to parse estimate', details: parseError.message },
          { status: 500 }
        )
      }
    }

    // Validate and enhance estimate structure
    if (!result.estimate) {
      return NextResponse.json(
        { error: 'Invalid estimate structure from AI' },
        { status: 500 }
      )
    }

    // Post-process: Validation with correction - prefer fixing over rejecting
    const validatedLineItems = []
    const rejectedItems: Array<{ code: string; description: string; reason: string }> = []
    const correctedItems: Array<{ oldCode: string; newCode: string; reason: string }> = []
    
    console.log('[PhotoXact] Validating', result.estimate.lineItems?.length || 0, 'items from AI response')
    
    for (const item of result.estimate.lineItems || []) {
      const code = item.code?.toString().trim().toUpperCase()
      const description = (item.description || '').trim()
      
      if (!code || code === 'UNKNOWN') {
        // No code provided - search by description
        if (description) {
          const matches = searchByKeyword(description, 15) // Increased from 5 to 15
          if (matches.length > 0) {
            // Use the best match that actually matches the description
            const bestMatch = matches.find(m => {
              const matchDesc = m.description.toLowerCase()
              const itemDesc = description.toLowerCase()
              // Check if key words match
              const itemWords = itemDesc.split(/\s+/).filter((w: string) => w.length > 3)
              return itemWords.some((word: string) => matchDesc.includes(word))
            }) || matches[0]
            
            item.code = bestMatch.code
            item.description = bestMatch.description // Use official description from database
            validatedLineItems.push(item)
            correctedItems.push({ oldCode: code || 'UNKNOWN', newCode: bestMatch.code, reason: 'Found code by description search' })
            console.log('[PhotoXact] Corrected item:', { oldCode: code || 'UNKNOWN', newCode: bestMatch.code, description })
            continue
          }
        }
        // Even if no match found, if description is meaningful, try broader search
        if (description && description.length > 5) {
          // Try searching with individual keywords
          const keywords = description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4)
          for (const keyword of keywords) {
            const matches = searchByKeyword(keyword, 5)
            if (matches.length > 0) {
              item.code = matches[0].code
              item.description = matches[0].description
              validatedLineItems.push(item)
              correctedItems.push({ oldCode: code || 'UNKNOWN', newCode: matches[0].code, reason: `Found code by keyword search: ${keyword}` })
              console.log('[PhotoXact] Corrected item by keyword:', { keyword, newCode: matches[0].code })
              break
            }
          }
          if (item.code) continue // Found a match, skip rejection
        }
        rejectedItems.push({ code: code || 'UNKNOWN', description, reason: 'No code and no match found in database' })
        console.log('[PhotoXact] Rejected item (no code):', { description })
        continue
      }
      
      // Validate code exists in database
      const xactItem = findByCode(code)
      if (!xactItem) {
        // Code doesn't exist - search by description to find correct code
        if (description) {
          const matches = searchByKeyword(description, 15) // Increased from 5 to 15
          if (matches.length > 0) {
            const bestMatch = matches.find(m => {
              const matchDesc = m.description.toLowerCase()
              const itemDesc = description.toLowerCase()
              const itemWords = itemDesc.split(/\s+/).filter((w: string) => w.length > 3)
              return itemWords.some((word: string) => matchDesc.includes(word))
            }) || matches[0]
            
            item.code = bestMatch.code
            item.description = bestMatch.description
            validatedLineItems.push(item)
            correctedItems.push({ oldCode: code, newCode: bestMatch.code, reason: `Code ${code} not found, replaced with ${bestMatch.code}` })
            console.log('[PhotoXact] Corrected invalid code:', { oldCode: code, newCode: bestMatch.code })
            continue
          }
          // Try keyword-based search as fallback
          const keywords = description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4)
          for (const keyword of keywords) {
            const matches = searchByKeyword(keyword, 5)
            if (matches.length > 0) {
              item.code = matches[0].code
              item.description = matches[0].description
              validatedLineItems.push(item)
              correctedItems.push({ oldCode: code, newCode: matches[0].code, reason: `Code ${code} not found, found by keyword: ${keyword}` })
              console.log('[PhotoXact] Corrected by keyword:', { oldCode: code, keyword, newCode: matches[0].code })
              break
            }
          }
          if (item.code && item.code !== code) continue // Found a match
        }
        rejectedItems.push({ code, description, reason: `Code ${code} not found in database and no description match` })
        console.log('[PhotoXact] Rejected item (invalid code):', { code, description })
        continue
      }
      
      // Code exists - verify description matches AND check for obvious mismatches
      const xactDesc = xactItem.description.toLowerCase()
      const itemDesc = description.toLowerCase()
      
      // Check for obvious mismatches first - reject codes that don't match descriptions
      const obviousMismatches = [
        { 
          code: 'PLM', 
          wrong: ['timber', 'pile', 'equipment', 'mobilization', 'bid item'], 
          correct: ['plumber', 'plumbing'],
          actualDescription: 'Plumber - per hour' // PLM is LABOR, not a material item
        },
        { 
          code: 'TEXMK', 
          wrong: ['smooth', 'no texture', 'flat', 'plain'], 
          correct: ['texture', 'knockdown'],
          actualDescription: 'Texture drywall - machine - knockdown'
        },
        { 
          code: 'BTF10', 
          wrong: ['no insulation', 'empty', 'no batt', 'exposed', 'no insulation visible', 'bare'], 
          correct: ['insulation', 'batt'],
          actualDescription: 'Batt insulation - 10" - R30 - paper / foil faced'
        }
      ]
      
      let shouldReject = false
      let rejectReason = ''
      
      for (const mismatch of obviousMismatches) {
        if (code === mismatch.code) {
          // Check if description contains wrong keywords
          const hasWrong = mismatch.wrong.some(w => 
            itemDesc.includes(w) || description.toLowerCase().includes(w)
          )
          
          // Check if description contains correct keywords
          const hasCorrect = mismatch.correct.some(c => 
            itemDesc.includes(c) || xactDesc.includes(c) || description.toLowerCase().includes(c)
          )
          
          // Special check for PLM - it's labor, not a material item
          if (code === 'PLM' && !xactDesc.includes('plumber') && !xactDesc.includes('hour')) {
            // Try to find a better code for plumbing materials
            const plumbingMatches = searchByKeyword('plumbing', 10)
            const materialMatch = plumbingMatches.find(m => 
              !m.description.toLowerCase().includes('hour') && 
              !m.description.toLowerCase().includes('labor') &&
              !m.description.toLowerCase().includes('plumber')
            )
            if (materialMatch) {
              item.code = materialMatch.code
              item.description = materialMatch.description
              validatedLineItems.push(item)
              correctedItems.push({ oldCode: code, newCode: materialMatch.code, reason: 'PLM is labor, replaced with material code' })
              console.log('[PhotoXact] Corrected PLM to material code:', { newCode: materialMatch.code })
              shouldReject = false
              break
            }
            shouldReject = true
            rejectReason = `PLM is "Plumber - per hour" (labor), not a material item. Description doesn't match.`
            break
          }
          
          // If description has wrong keywords and doesn't have correct ones, reject
          if (hasWrong && !hasCorrect) {
            shouldReject = true
            rejectReason = `Code ${code} (${mismatch.actualDescription}) doesn't match description "${description}" - obvious mismatch`
            break
          }
          
          // If code is TEXMK or BTF10 and description suggests item is NOT visible, reject
          if ((code === 'TEXMK' || code === 'BTF10') && hasWrong) {
            shouldReject = true
            rejectReason = `Code ${code} (${mismatch.actualDescription}) - item not visible in photo based on description`
            break
          }
        }
      }
      
      if (shouldReject) {
        rejectedItems.push({ code, description, reason: rejectReason })
        console.log('[PhotoXact] Rejected item (mismatch):', { code, description, reason: rejectReason })
        continue
      }
      
      // Check if description is reasonably close to the database description
      const xactWords = new Set<string>(xactDesc.split(/\s+/).filter((w: string) => w.length > 2))
      const itemWords = new Set<string>(itemDesc.split(/\s+/).filter((w: string) => w.length > 2))
      const commonWords = Array.from(itemWords).filter((w: string) => xactWords.has(w))
      const similarity = commonWords.length / Math.max(xactWords.size, itemWords.size, 1)
      
      // Lowered threshold from 0.3 to 0.15 - be more lenient
      if (similarity < 0.15) {
        // Code exists but doesn't match description - search by description for correct code
        const matches = searchByKeyword(description, 15) // Increased from 5
        if (matches.length > 0) {
          const bestMatch = matches.find(m => {
            const matchDesc = m.description.toLowerCase()
            const itemWords = itemDesc.split(/\s+/).filter((w: string) => w.length > 3)
            return itemWords.some((word: string) => matchDesc.includes(word))
          }) || matches[0]
          
          // Only replace if the new code is a better match
          const newMatchDesc = bestMatch.description.toLowerCase()
          const newCommonWords = Array.from(itemWords).filter((w: string) => newMatchDesc.includes(w))
          const newSimilarity = newCommonWords.length / Math.max(newMatchDesc.split(/\s+/).length, itemWords.size, 1)
          
          if (newSimilarity > similarity) {
            item.code = bestMatch.code
            item.description = bestMatch.description
            validatedLineItems.push(item)
            correctedItems.push({ oldCode: code, newCode: bestMatch.code, reason: `Code ${code} (${xactItem.description}) doesn't match description, replaced with ${bestMatch.code}` })
            console.log('[PhotoXact] Corrected low similarity:', { oldCode: code, newCode: bestMatch.code, oldSimilarity: similarity.toFixed(2), newSimilarity: newSimilarity.toFixed(2) })
            continue
          }
        }
        // Even if similarity is low, if we have a valid code, keep it but use the official description
        // This is more lenient - we keep items with valid codes even if description doesn't match perfectly
        item.code = xactItem.code
        item.description = xactItem.description
        validatedLineItems.push(item)
        correctedItems.push({ oldCode: code, newCode: code, reason: `Low similarity (${similarity.toFixed(2)}), but code is valid - using official description` })
        console.log('[PhotoXact] Kept item with low similarity:', { code, similarity: similarity.toFixed(2) })
        continue
      }
      
      // Code exists and description matches - use official description
      item.code = xactItem.code
      item.description = xactItem.description
      validatedLineItems.push(item)
    }
    
    console.log('[PhotoXact] Validation complete:', {
      total: result.estimate.lineItems?.length || 0,
      validated: validatedLineItems.length,
      rejected: rejectedItems.length,
      corrected: correctedItems.length
    })
    
    // Update estimate with validated items
    result.estimate.lineItems = validatedLineItems
    
    // Recalculate summary
    result.estimate.summary.totalLineItems = validatedLineItems.length
    result.estimate.summary.totalCost = validatedLineItems.reduce(
      (sum: number, item: any) => sum + (item.totalPrice || 0),
      0
    )
    
    // Recalculate by category
    const byCategory: Record<string, number> = {}
    validatedLineItems.forEach((item: any) => {
      const category = item.category || 'Other'
      byCategory[category] = (byCategory[category] || 0) + (item.totalPrice || 0)
    })
    result.estimate.summary.byCategory = byCategory
    
    // Recalculate by room
    const byRoom: Record<string, number> = {}
    validatedLineItems.forEach((item: any) => {
      const room = item.room || 'General'
      byRoom[room] = (byRoom[room] || 0) + (item.totalPrice || 0)
    })
    result.estimate.summary.byRoom = byRoom
    
    // Add image URL and metadata
    result.imageUrl = `/api/files/${fileId}`
    result.fileName = fileRecord.originalName
    
    // Add Xactimate Analysis (TCS Professional Analysis) - TheClearScope feature
    if (xactimateAnalysis) {
      result.xactimateAnalysis = {
        rooms: xactimateAnalysis.rooms,
        overallDamageCategory: xactimateAnalysis.overallDamageCategory,
        projectNotes: xactimateAnalysis.projectNotes,
        createdAt: xactimateAnalysis.createdAt.toISOString(),
        mainReportContent: xactimateAnalysis.mainReportContent,
        summary: {
          totalRooms: xactimateAnalysis.rooms.length,
          totalLineItems: getAllLineItems(xactimateAnalysis).length,
          categories: new Set(getAllLineItems(xactimateAnalysis).map(item => item.category)).size,
          damageCodes: new Set(getAllLineItems(xactimateAnalysis).map(item => item.damageCode)).size,
          laborTypes: new Set(getAllLineItems(xactimateAnalysis).map(item => item.laborType)).size,
        },
      }
    }
    
    // Add warnings for rejected and corrected items
    if (rejectedItems.length > 0 || correctedItems.length > 0) {
      result.warnings = result.warnings || []
      
      if (correctedItems.length > 0) {
        result.warnings.push(`${correctedItems.length} items were corrected:`)
        correctedItems.forEach(corrected => {
          result.warnings!.push(`- ${corrected.oldCode} → ${corrected.newCode}: ${corrected.reason}`)
        })
      }
      
      if (rejectedItems.length > 0) {
        result.warnings.push(`${rejectedItems.length} items were rejected:`)
        rejectedItems.forEach(rejected => {
          result.warnings!.push(`- ${rejected.code}: ${rejected.reason}`)
        })
      }
    }

    // Auto-save the estimate
    try {
      await prisma.savedWork.create({
        data: {
          userId: session.user.id,
          toolId: 'photoxact',
          title: `PhotoXact Estimate${projectName ? ` - ${projectName}` : ''}`,
          description: claimNumber ? `Claim #${claimNumber}` : `Generated from ${fileRecord.originalName}`,
          data: {
            estimate: result.estimate,
            projectName: projectName || '',
            claimNumber: claimNumber || '',
            propertyAddress: propertyAddress || '',
            fileName: fileRecord.originalName,
            createdAt: new Date().toISOString(),
          },
          files: [fileId],
        },
      })
      console.log('[PhotoXact] Auto-saved estimate')
    } catch (saveError) {
      console.error('[PhotoXact] Failed to auto-save:', saveError)
    }

    // Log usage
    await prisma.usageHistory.create({
      data: {
        userId: session.user.id,
        toolId: 'photoxact',
        action: 'estimate_generated',
        metadata: {
          lineItemsCount: validatedLineItems.length,
          totalCost: result.estimate.summary.totalCost,
          fileName: fileRecord.originalName,
        },
      },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[PhotoXact] Error:', error)
    if (isOpenAIAuthError(error)) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to generate estimate', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

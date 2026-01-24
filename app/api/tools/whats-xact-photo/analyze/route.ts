import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { searchByKeyword, findByCode } from '@/lib/xactimate-lookup'

export const dynamic = 'force-dynamic'

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

    const { fileId } = await request.json()

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
      console.error('[Whats Xact Photo] File not found:', fileRecord.path)
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
      // Fallback based on extension
      const ext = fileRecord.originalName.split('.').pop()?.toLowerCase()
      if (ext === 'png') mimeType = 'image/png'
      else if (ext === 'gif') mimeType = 'image/gif'
      else if (ext === 'webp') mimeType = 'image/webp'
      else mimeType = 'image/jpeg'
    }

    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Create prompt for vision API with Xactimate code examples
    // Focus on ONLY WHAT IS VISIBLE - no hallucinations
    const visionPrompt = `
Analyze this construction/damage photo and identify ONLY line items that are VISIBLY present or clearly needed based on what you can ACTUALLY SEE.

CRITICAL RULES - ONLY INCLUDE IF:
1. The item is VISIBLY present in the photo (you can see it)
2. The item is CLEARLY needed based on visible damage (e.g., if you see exposed pipes, plumbing repair is needed)
3. The item is OBVIOUS from context (e.g., if drywall is removed, you can see what's behind it)

DO NOT INCLUDE:
- Items you CANNOT see (e.g., don't add insulation if you can't see it in the exposed wall)
- Items that are NOT visible (e.g., don't add texture if walls appear smooth)
- Items that are SPECULATIVE (e.g., don't assume hidden damage)
- Items that don't match what's visible (e.g., don't add "timber pile" for kitchen work)

CRITICAL: You MUST provide actual Xactimate codes for each item. Do NOT use "UNKNOWN" unless absolutely necessary.

CRITICAL: You MUST use ACTUAL codes from the 13,000+ Xactimate database. Do NOT make up codes.

COMMON XACTIMATE CODES (examples - verify these exist in database):
- Drywall: MASKSF (masking), MASKLF (masking linear feet), MASKLFT (masking linear feet trim)
- Paint: BTF4, BTF6, BTF10, BTF12 (base coat), FINALR (final roll), TEXMK (texture)
- Cabinets: CTDK (countertop subdeck - NOT cabinet door), CTFL (cabinet face lift), CTGE (cabinet general), CTGM (cabinet general medium)
- Countertops: CTCON (countertop construction), CTDK (countertop subdeck - plywood), CTFL (countertop face lift)
- Plumbing: PLK (plumbing kitchen), PLM (plumbing), SNKRS (sink remove and set), FAURS (faucet remove and set), PTRAPRS (p-trap remove and set)
- Electrical: ELE (electrical), RECEPT (receptacle), SWR (switch), WHRS (wire remove and set)
- Flooring: FL (flooring), LAM (laminate), QR (quarter round), SHOE1 (shoe molding)
- Trim: TRIM, CROWN (crown molding), BS (base shoe), BSS (base shoe set)
- Doors: DOR (door), DORH (door hardware), SDORRS (sliding door remove and set)
- Windows: WINA (window), WINC (window construction), WINV (window vinyl)
- Demolition: D (demolition), D- (demolition minus), D+ (demolition plus)
- Insulation: INS (insulation), INSC (insulation ceiling), INSN (insulation new)
- Roofing: SH12 (shingle 12"), SHW (shingle wood), OH (overhead)
- Siding: S (siding), SILL (sill)
- HVAC: AHAC2 (air handler AC 2 ton), REG (register), VENTGM (vent grille metal)

IMPORTANT NOTES:
- CTDK = "Countertop subdeck - plywood" NOT "cabinet door kitchen" or "tear out countertop"
- COUNTER = "Service counter" (specific item, not generic countertop)
- If you're not sure of a code, search the database by description
- NEVER make up codes - only use codes that exist in the 13k+ database

For each item you can ACTUALLY SEE, provide:
1. Xactimate code (REQUIRED - use actual codes from the 13k+ database, verify they exist)
2. Full description matching Xactimate format from the database
3. Estimated quantity/measurement based on what's VISIBLE (e.g., measure visible damage area)
4. Location/room where visible (if applicable)

VALIDATION CHECKLIST before including each item:
- Can I see this item in the photo? (If no, don't include)
- Is this code correct for what I see? (Verify against database)
- Does the description match what's visible? (Don't add texture if walls are smooth)
- Is the quantity reasonable based on what's visible? (Don't guess)

Focus on identifying ONLY WHAT IS VISIBLE:
- VISIBLE DAMAGE: What you can clearly see damaged in the photo (e.g., removed drywall, exposed pipes)
- VISIBLE MATERIALS: What you can actually see (e.g., if you see exposed wall cavity, note if insulation is VISIBLE or NOT)
- VISIBLE FIXTURES: What fixtures are present (cabinets, sink, etc.)
- OBVIOUS REPAIRS: Only what's clearly needed from visible damage (e.g., if drywall is removed, drywall repair is needed)

DO NOT ASSUME:
- Don't add texture if walls appear smooth
- Don't add insulation if you can't see it in exposed areas
- Don't add items that aren't visible or clearly needed
- Don't use wrong codes (e.g., PLM is PLUMBING, not "timber pile")

CODE ACCURACY:
- PLM = Plumbing (NOT timber pile)
- TEXMK = Texture drywall - machine - knockdown (only if you can SEE knockdown texture)
- BTF10 = Batt insulation - 10" (only if you can SEE insulation)
- Verify codes match what's actually visible

Return your response as JSON in this exact format:
{
  "lineItems": [
    {
      "code": "XACTIMATE CODE (required - use actual code, not UNKNOWN)",
      "description": "Full item description in Xactimate format",
      "quantity": "Estimated quantity with unit (e.g., '120 sq ft', '3 each')",
      "location": "Room/location where visible (optional)"
    }
  ],
  "summary": {
    "totalItems": 0,
    "rooms": ["list of rooms/locations identified"]
  },
  "notes": ["Any relevant notes about the photo"]
}

IMPORTANT: 
- Return ONLY valid JSON. No markdown, no explanations.
- Use actual Xactimate codes - avoid "UNKNOWN" unless absolutely necessary.
- Match the code format to the item type (e.g., MASKSF for drywall masking, BTF10 for paint base coat).
`

    console.log('[Whats Xact Photo] Analyzing image with vision API...', {
      fileId,
      fileName: fileRecord.originalName,
      imageSize: imageBuffer.length,
    })

    const aiResponse = await callAI({
      prompt: visionPrompt,
      toolId: 'whats-xact-photo',
      systemPrompt: `You are an expert Xactimate estimator analyzing photos. Your task is to identify ONLY items that are VISIBLY present or clearly needed based on what you can ACTUALLY SEE.

CRITICAL REQUIREMENTS:
1. ONLY identify what you can SEE in the photo - no hallucinations
2. If you can't see it, DON'T include it (e.g., no insulation if you can't see it in exposed walls)
3. If walls appear smooth, DON'T add texture items
4. Verify codes exist in the 13,000+ database before using them
5. Use correct codes: PLM = Plumbing (NOT timber pile), TEXMK = Texture (only if texture is visible)
6. Match descriptions to what's actually visible
7. Be conservative - when in doubt, exclude items

CODE ACCURACY:
- PLM = Plumbing (NOT timber pile, NOT equipment mobilization)
- TEXMK = Texture drywall - machine - knockdown (only if knockdown texture is VISIBLE)
- BTF10 = Batt insulation - 10" (only if insulation is VISIBLE in exposed areas)
- Verify every code against the database

Your response will be validated against the 13k+ Xactimate database. Invalid codes or mismatched descriptions will be rejected.`,
      imageUrl: imageDataUrl,
      temperature: 0.1, // Low temperature for consistent results
      maxTokens: 4000,
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
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }
      result = JSON.parse(jsonMatch[0])
    } catch (parseError: any) {
      console.error('[Whats Xact Photo] AI response parse error:', parseError)
      console.error('[Whats Xact Photo] AI Response:', aiResponse.result.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: parseError.message },
        { status: 500 }
      )
    }

    // Validate result structure
    if (!result.lineItems || !Array.isArray(result.lineItems)) {
      result.lineItems = []
    }
    if (!result.summary) {
      result.summary = {
        totalItems: result.lineItems.length,
        rooms: [],
      }
    }
    if (!result.notes) {
      result.notes = []
    }

    // Post-process: STRICT validation - codes MUST match descriptions from 13k+ database
    const validatedLineItems = []
    const rejectedItems: Array<{ code: string; description: string; reason: string }> = []
    
    for (const item of result.lineItems) {
      const code = item.code?.toString().trim().toUpperCase()
      const description = (item.description || '').trim()
      
      if (!code || code === 'UNKNOWN') {
        // No code provided - search by description
        if (description) {
          const matches = searchByKeyword(description, 10)
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
            continue
          }
        }
        rejectedItems.push({ code: code || 'UNKNOWN', description, reason: 'No code and no match found in database' })
        continue
      }
      
      // Validate code exists in database
      const xactItem = findByCode(code)
      if (!xactItem) {
        // Code doesn't exist - search by description to find correct code
        if (description) {
          const matches = searchByKeyword(description, 10)
          if (matches.length > 0) {
            const bestMatch = matches.find(m => {
              const matchDesc = m.description.toLowerCase()
              const itemDesc = description.toLowerCase()
              const itemWords = itemDesc.split(/\s+/).filter(w => w.length > 3)
              return itemWords.some(word => matchDesc.includes(word))
            }) || matches[0]
            
            item.code = bestMatch.code
            item.description = bestMatch.description
            validatedLineItems.push(item)
            rejectedItems.push({ code, description, reason: `Code ${code} not found, replaced with ${bestMatch.code}` })
            continue
          }
        }
        rejectedItems.push({ code, description, reason: `Code ${code} not found in database and no description match` })
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
            rejectedItems.push({ 
              code, 
              description, 
              reason: `PLM is "Plumber - per hour" (labor), not a material item. Description doesn't match.` 
            })
            continue
          }
          
          // If description has wrong keywords and doesn't have correct ones, reject
          if (hasWrong && !hasCorrect) {
            rejectedItems.push({ 
              code, 
              description, 
              reason: `Code ${code} (${mismatch.actualDescription}) doesn't match description "${description}" - obvious mismatch` 
            })
            continue
          }
          
          // If code is TEXMK or BTF10 and description suggests item is NOT visible, reject
          if ((code === 'TEXMK' || code === 'BTF10') && hasWrong) {
            rejectedItems.push({ 
              code, 
              description, 
              reason: `Code ${code} (${mismatch.actualDescription}) - item not visible in photo based on description` 
            })
            continue
          }
        }
      }
      
      // Check if description is reasonably close to the database description
      const xactWords = new Set(xactDesc.split(/\s+/).filter((w: string) => w.length > 2))
      const itemWords = new Set(itemDesc.split(/\s+/).filter((w: string) => w.length > 2))
      const commonWords = [...itemWords].filter((w: string) => xactWords.has(w))
      const similarity = commonWords.length / Math.max(xactWords.size, itemWords.size, 1)
      
      // If similarity is too low (< 30%), the code doesn't match the description
      if (similarity < 0.3) {
        // Code exists but doesn't match description - search by description for correct code
        const matches = searchByKeyword(description, 10)
        if (matches.length > 0) {
          const bestMatch = matches.find(m => {
            const matchDesc = m.description.toLowerCase()
            const itemWords = itemDesc.split(/\s+/).filter((w: string) => w.length > 3)
            return itemWords.some((word: string) => matchDesc.includes(word))
          }) || matches[0]
          
          // Only replace if the new code is a better match
          const newMatchDesc = bestMatch.description.toLowerCase()
          const newCommonWords = [...itemWords].filter((w: string) => newMatchDesc.includes(w))
          const newSimilarity = newCommonWords.length / Math.max(newMatchDesc.split(/\s+/).length, itemWords.size, 1)
          
          if (newSimilarity > similarity) {
            item.code = bestMatch.code
            item.description = bestMatch.description
            validatedLineItems.push(item)
            rejectedItems.push({ code, description, reason: `Code ${code} (${xactItem.description}) doesn't match description, replaced with ${bestMatch.code}` })
            continue
          }
        }
        // Code doesn't match but no better match found - reject it
        rejectedItems.push({ code, description, reason: `Code ${code} (${xactItem.description}) doesn't match description "${description}"` })
        continue
      }
      
      // Code exists and description matches - use official description
      item.code = xactItem.code
      item.description = xactItem.description
      validatedLineItems.push(item)
    }
    
    // Update result with validated items
    result.lineItems = validatedLineItems
    result.summary.totalItems = validatedLineItems.length
    
    // Add warnings for rejected items
    if (rejectedItems.length > 0) {
      result.warnings = result.warnings || []
      result.warnings.push(`${rejectedItems.length} items were rejected or corrected:`)
      rejectedItems.forEach(rejected => {
        result.warnings!.push(`- ${rejected.code}: ${rejected.reason}`)
      })
    }
    
    // Add image URL for frontend display
    result.imageUrl = `/api/files/${fileId}`
    result.fileName = fileRecord.originalName

    // Auto-save the result
    try {
      await prisma.savedWork.create({
        data: {
          userId: session.user.id,
          toolId: 'whats-xact-photo',
          title: `Photo Analysis - ${fileRecord.originalName}`,
          description: `Identified ${result.lineItems.length} line items`,
          data: {
            result,
            fileName: fileRecord.originalName,
            createdAt: new Date().toISOString(),
          },
          files: [fileId],
        },
      })
      console.log('[Whats Xact Photo] Auto-saved analysis result')
    } catch (saveError) {
      console.error('[Whats Xact Photo] Failed to auto-save:', saveError)
    }

    // Log usage
    await prisma.usageHistory.create({
      data: {
        userId: session.user.id,
        toolId: 'whats-xact-photo',
        action: 'photo_analyzed',
        metadata: {
          itemsFound: result.lineItems.length,
          fileName: fileRecord.originalName,
        },
      },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Whats Xact Photo] Error:', error)
    if (isOpenAIAuthError(error)) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to analyze photo', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

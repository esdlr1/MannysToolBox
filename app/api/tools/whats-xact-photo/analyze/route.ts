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
    // Focus on FULL RESTORATION SCOPE, not just visible damage
    const visionPrompt = `
Analyze this construction/damage photo and identify ALL line items needed to restore the property to PRE-LOSS CONDITION.

CRITICAL: This is a RESTORATION ESTIMATE, not just visible damage. You must think about:
1. What is VISIBLY damaged (what you can see)
2. What is LIKELY damaged but not visible (behind walls, under floors, etc.)
3. What PREP WORK is needed (protection, demolition, cleanup)
4. What FINISH WORK is needed (paint, trim, final touches)
5. What RELATED ITEMS are needed (if drywall is damaged, you need paint, texture, etc.)

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

For each item you see, provide:
1. Xactimate code (REQUIRED - use actual codes from the list above or similar standard Xactimate codes)
2. Full description matching Xactimate format (e.g., "Remove and replace drywall", "Paint wall", "Install cabinet")
3. Estimated quantity/measurement (e.g., "120 sq ft", "3 each", "15 linear feet")
4. Location/room where visible (if applicable)

Focus on identifying COMPLETE RESTORATION SCOPE:
- VISIBLE DAMAGE: What you can clearly see damaged in the photo
- HIDDEN DAMAGE: What is likely damaged but not visible (e.g., if water damage is visible, think about what's behind walls, under floors)
- PREP WORK: Protection (COUNTER, drop cloths), demolition (D, D+, D-), cleanup (MUCK, MUCK-)
- REPAIR WORK: Building materials (drywall MASKSF/MASKLF, flooring FL, paint BTF10/FINALR, etc.)
- FINISH WORK: Paint (BTF10, FINALR, TEXMK), texture, trim (TRIM, CROWN, BS), caulking
- RELATED ITEMS: If drywall is damaged, you need: demolition, drywall, texture, paint, trim
- FIXTURES: Cabinets (CTDK, CTFL, CTGE), countertops (COUNTER, CTCON), plumbing (PLK, SNKRS, FAURS), electrical (ELE, RECEPT, SWR)
- STRUCTURAL: Framing, beams, studs if visible or likely affected
- CLEANUP: MUCK (muck out), debris removal, final cleanup

RESTORATION THINKING:
- If you see water damage, think: water extraction, drying, demolition of wet materials, replacement, paint, cleanup
- If you see fire damage, think: soot cleanup, demolition, replacement, paint, odor treatment
- If you see structural damage, think: structural repair, framing, drywall, paint, finish work
- ALWAYS include prep work (protection, demolition) and finish work (paint, texture, trim)

Be COMPREHENSIVE - think about the ENTIRE restoration process, not just what's visible.

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
      systemPrompt: `You are an expert Xactimate RESTORATION estimator with deep knowledge of:
- Xactimate line item codes and their exact formats (e.g., MASKSF, BTF10, CTDK, PLK, ELE)
- Standard Xactimate code patterns (e.g., codes ending in RS = "remove and set", codes with +/- = quality levels)
- Construction materials and finishes with their specific Xactimate codes
- Building components and systems with proper code assignments
- COMPLETE RESTORATION SCOPE - not just visible damage, but full restoration to pre-loss condition
- Construction terminology and measurements
- Restoration workflow: prep → demolition → repair → finish → cleanup

Your task is to analyze construction photos and identify ALL line items needed for COMPLETE RESTORATION to pre-loss condition.

CRITICAL REQUIREMENTS:
1. Think about FULL RESTORATION SCOPE, not just visible damage
2. Include prep work (protection, demolition, cleanup)
3. Include finish work (paint, texture, trim, caulking)
4. Include related items (if drywall is damaged, include paint, texture, trim)
5. Think about hidden damage (if water damage is visible, what's behind walls?)
6. You MUST provide actual Xactimate codes for each item - do NOT use "UNKNOWN"
7. Use standard Xactimate code formats matching the 13,000+ line item database
8. Match codes to the specific item type and quality level
9. Use proper Xactimate descriptions (e.g., "Remove and replace" not "R&R")

Common code patterns:
- RS suffix = Remove and Set
- + = Better quality/material
- - = Lower quality/material
- Numbers = Specific sizes or types`,
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
              const itemWords = itemDesc.split(/\s+/).filter(w => w.length > 3)
              return itemWords.some(word => matchDesc.includes(word))
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
      
      // Code exists - verify description matches
      const xactDesc = xactItem.description.toLowerCase()
      const itemDesc = description.toLowerCase()
      
      // Check if description is reasonably close to the database description
      const xactWords = new Set(xactDesc.split(/\s+/).filter(w => w.length > 2))
      const itemWords = new Set(itemDesc.split(/\s+/).filter(w => w.length > 2))
      const commonWords = [...itemWords].filter(w => xactWords.has(w))
      const similarity = commonWords.length / Math.max(xactWords.size, itemWords.size, 1)
      
      // If similarity is too low (< 30%), the code doesn't match the description
      if (similarity < 0.3) {
        // Code exists but doesn't match description - search by description for correct code
        const matches = searchByKeyword(description, 10)
        if (matches.length > 0) {
          const bestMatch = matches.find(m => {
            const matchDesc = m.description.toLowerCase()
            const itemWords = itemDesc.split(/\s+/).filter(w => w.length > 3)
            return itemWords.some(word => matchDesc.includes(word))
          }) || matches[0]
          
          // Only replace if the new code is a better match
          const newMatchDesc = bestMatch.description.toLowerCase()
          const newCommonWords = [...itemWords].filter(w => newMatchDesc.includes(w))
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

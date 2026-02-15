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
    // Focus on identifying visible work and needed repairs
    const visionPrompt = `
Analyze this construction/damage photo and identify ALL line items that are VISIBLY present or clearly needed based on what you can ACTUALLY SEE.

YOUR GOAL: Identify every visible item of work, damage, or repair needed. Be thorough - if you can see it, include it.

CRITICAL RULES - INCLUDE IF:
1. The item is VISIBLY present in the photo (you can see it)
2. The item is CLEARLY needed based on visible damage (e.g., if you see exposed pipes, plumbing repair is needed)
3. The item is OBVIOUS from context (e.g., if drywall is removed, drywall repair is needed)
4. The work is clearly in progress or damage is visible (e.g., removed drywall, exposed plumbing, open cabinets)

COMMON SCENARIOS AND WHAT TO INCLUDE:
- DRYWALL REMOVED: Include drywall removal/demolition codes, drywall repair/replacement codes
- EXPOSED PLUMBING: Include plumbing repair codes, pipe work, fixture codes
- OPEN CABINETS: Include cabinet work if cabinets are affected or being worked on
- VISIBLE DAMAGE: Include all repair items needed to fix visible damage
- WORK IN PROGRESS: Include all items related to work that's clearly happening

DO NOT INCLUDE:
- Items you CANNOT see (e.g., don't add insulation if you can't see it in the exposed wall)
- Items that are NOT visible (e.g., don't add texture if walls appear smooth and you can't see texture)
- Items that are SPECULATIVE (e.g., don't assume hidden damage beyond what's visible)
- Items that don't match what's visible (e.g., don't add "timber pile" for kitchen work)

CRITICAL: You MUST provide actual Xactimate codes for each item. Do NOT use "UNKNOWN" unless absolutely necessary.

CRITICAL: You MUST use ACTUAL codes from the 13,000+ Xactimate database. Do NOT make up codes.

COMMON XACTIMATE CODES (examples - verify these exist in database):
- Drywall: DRYW (drywall), DRYWSF (drywall square feet), DRYWR (drywall repair), MASKSF (masking), MASKLF (masking linear feet)
- Demolition: D (demolition), DRYWD (drywall demolition), DRYWSFD (drywall square feet demolition)
- Paint: BTF4, BTF6, BTF10, BTF12 (base coat), FINALR (final roll), TEXMK (texture - only if texture is visible)
- Cabinets: CTDK (countertop subdeck - NOT cabinet door), CTFL (cabinet face lift), CTGE (cabinet general), CTGM (cabinet general medium)
- Countertops: CTCON (countertop construction), CTDK (countertop subdeck - plywood), CTFL (countertop face lift)
- Plumbing: PLK (plumbing kitchen), PLM (plumber - per hour, LABOR), PLUMB (plumbing), SNKRS (sink remove and set), FAURS (faucet remove and set), PTRAPRS (p-trap remove and set)
- Electrical: ELE (electrical), RECEPT (receptacle), SWR (switch), WHRS (wire remove and set)
- Flooring: FL (flooring), LAM (laminate), QR (quarter round), SHOE1 (shoe molding)
- Trim: TRIM, CROWN (crown molding), BS (base shoe), BSS (base shoe set)
- Doors: DOR (door), DORH (door hardware), SDORRS (sliding door remove and set)
- Windows: WINA (window), WINC (window construction), WINV (window vinyl)
- Insulation: INS (insulation), INSC (insulation ceiling), INSN (insulation new) - ONLY if visible
- Roofing: SH12 (shingle 12"), SHW (shingle wood), OH (overhead)
- Siding: S (siding), SILL (sill)
- HVAC: AHAC2 (air handler AC 2 ton), REG (register), VENTGM (vent grille metal)

IMPORTANT NOTES:
- CTDK = "Countertop subdeck - plywood" NOT "cabinet door kitchen" or "tear out countertop"
- PLM = "Plumber - per hour" (LABOR code, not a material item)
- If you see plumbing work, search for plumbing material codes, not just PLM
- If you're not sure of a code, use descriptive keywords to find the right code
- NEVER make up codes - only use codes that exist in the 13k+ database

For each item you can ACTUALLY SEE, provide:
1. Xactimate code (REQUIRED - use actual codes from the 13k+ database, verify they exist)
2. Full description matching Xactimate format from the database
3. Estimated quantity/measurement based on what's VISIBLE (e.g., measure visible damage area)
4. Location/room where visible (if applicable)

EXAMPLES OF WHAT TO IDENTIFY:
- If you see removed drywall: Include drywall demolition, drywall repair/replacement, possibly paint/texture if walls need finishing
- If you see exposed plumbing: Include plumbing repair codes, pipe work, fixture codes
- If you see open cabinets: Include cabinet work codes if cabinets are being worked on
- If you see visible damage: Include all repair items needed

VALIDATION CHECKLIST before including each item:
- Can I see this item or its effects in the photo? (If yes, include it)
- Is this code correct for what I see? (Use best match from database)
- Does the description match what's visible? (Use official Xactimate description)
- Is the quantity reasonable based on what's visible? (Estimate from photo)

Focus on identifying WHAT IS VISIBLE:
- VISIBLE DAMAGE: What you can clearly see damaged in the photo (e.g., removed drywall, exposed pipes)
- VISIBLE MATERIALS: What you can actually see (e.g., if you see exposed wall cavity, note what's visible)
- VISIBLE FIXTURES: What fixtures are present (cabinets, sink, etc.) and if they need work
- OBVIOUS REPAIRS: What's clearly needed from visible damage (e.g., if drywall is removed, drywall repair is needed)

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
- Be thorough - identify ALL visible work and needed repairs.
- If you see work happening, include related line items.
`

    console.log('[Whats Xact Photo] Analyzing image with vision API...', {
      fileId,
      fileName: fileRecord.originalName,
      imageSize: imageBuffer.length,
    })

    const aiResponse = await callAI({
      prompt: visionPrompt,
      toolId: 'whats-xact-photo',
      systemPrompt: `You are an expert Xactimate estimator analyzing photos. Your task is to identify ALL items that are VISIBLY present or clearly needed based on what you can ACTUALLY SEE.

CRITICAL REQUIREMENTS:
1. Identify what you can SEE in the photo - be thorough and complete
2. Include all visible work, damage, and needed repairs
3. If you see work in progress (e.g., removed drywall, exposed plumbing), include all related line items
4. Verify codes exist in the 13,000+ database before using them
5. Use correct codes: PLM = Plumber per hour (LABOR), search for plumbing material codes for materials
6. Match descriptions to what's actually visible using official Xactimate descriptions
7. Be thorough - if you can see it or its effects, include it

CODE ACCURACY:
- PLM = "Plumber - per hour" (LABOR code, not a material item)
- For plumbing materials, search for codes like PLUMB, PLK, or specific fixture codes
- TEXMK = Texture drywall - machine - knockdown (only if knockdown texture is VISIBLE)
- BTF10 = Batt insulation - 10" (only if insulation is VISIBLE in exposed areas)
- DRYWD or DRYWSFD = Drywall demolition (for removed drywall)
- DRYW or DRYWSF = Drywall installation/repair
- Verify every code against the database

Your response will be validated against the 13k+ Xactimate database. The system will help correct codes if needed, but try to use accurate codes from the start.`,
      imageUrl: imageDataUrl,
      temperature: 0.1, // Low temperature for consistent results
      maxTokens: 4000,
    })

    if (aiResponse.error) {
      console.error('[Whats Xact Photo Analyze] OpenAI error:', aiResponse.error)
      if (isOpenAIAuthError(aiResponse.error)) {
        return NextResponse.json(
          { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
          { status: 503 }
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

    // Post-process: Validation with correction - prefer fixing over rejecting
    const validatedLineItems = []
    const rejectedItems: Array<{ code: string; description: string; reason: string }> = []
    const correctedItems: Array<{ oldCode: string; newCode: string; reason: string }> = []
    
    console.log('[Whats Xact Photo] Validating', result.lineItems.length, 'items from AI response')
    
    for (const item of result.lineItems) {
      const code = item.code?.toString().trim().toUpperCase()
      const description = (item.description || '').trim()
      
      if (!code || code === 'UNKNOWN') {
        // No code provided - search by description
        if (description) {
          const matches = searchByKeyword(description, 15) // Increased from 10 to 15
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
            console.log('[Whats Xact Photo] Corrected item:', { oldCode: code || 'UNKNOWN', newCode: bestMatch.code, description })
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
              console.log('[Whats Xact Photo] Corrected item by keyword:', { keyword, newCode: matches[0].code })
              break
            }
          }
          if (item.code) continue // Found a match, skip rejection
        }
        rejectedItems.push({ code: code || 'UNKNOWN', description, reason: 'No code and no match found in database' })
        console.log('[Whats Xact Photo] Rejected item (no code):', { description })
        continue
      }
      
      // Validate code exists in database
      const xactItem = findByCode(code)
      if (!xactItem) {
        // Code doesn't exist - search by description to find correct code
        if (description) {
          const matches = searchByKeyword(description, 15) // Increased from 10 to 15
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
            console.log('[Whats Xact Photo] Corrected invalid code:', { oldCode: code, newCode: bestMatch.code })
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
              console.log('[Whats Xact Photo] Corrected by keyword:', { oldCode: code, keyword, newCode: matches[0].code })
              break
            }
          }
          if (item.code && item.code !== code) continue // Found a match
        }
        rejectedItems.push({ code, description, reason: `Code ${code} not found in database and no description match` })
        console.log('[Whats Xact Photo] Rejected item (invalid code):', { code, description })
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
              console.log('[Whats Xact Photo] Corrected PLM to material code:', { newCode: materialMatch.code })
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
        console.log('[Whats Xact Photo] Rejected item (mismatch):', { code, description, reason: rejectReason })
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
        const matches = searchByKeyword(description, 15) // Increased from 10
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
            console.log('[Whats Xact Photo] Corrected low similarity:', { oldCode: code, newCode: bestMatch.code, oldSimilarity: similarity.toFixed(2), newSimilarity: newSimilarity.toFixed(2) })
            continue
          }
        }
        // Even if similarity is low, if we have a valid code, keep it but use the official description
        // This is more lenient - we keep items with valid codes even if description doesn't match perfectly
        item.code = xactItem.code
        item.description = xactItem.description
        validatedLineItems.push(item)
        correctedItems.push({ oldCode: code, newCode: code, reason: `Low similarity (${similarity.toFixed(2)}), but code is valid - using official description` })
        console.log('[Whats Xact Photo] Kept item with low similarity:', { code, similarity: similarity.toFixed(2) })
        continue
      }
      
      // Code exists and description matches - use official description
      item.code = xactItem.code
      item.description = xactItem.description
      validatedLineItems.push(item)
    }
    
    console.log('[Whats Xact Photo] Validation complete:', {
      total: result.lineItems.length,
      validated: validatedLineItems.length,
      rejected: rejectedItems.length,
      corrected: correctedItems.length
    })
    
    // Update result with validated items
    result.lineItems = validatedLineItems
    result.summary.totalItems = validatedLineItems.length
    
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
    console.error('[Whats Xact Photo] Error:', error?.message ?? error)
    if (isOpenAIAuthError(error)) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to analyze photo', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

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
    const visionPrompt = `
Analyze this construction/damage photo and identify ALL visible line items that would be needed for a construction estimate.

CRITICAL: You MUST provide actual Xactimate codes for each item. Do NOT use "UNKNOWN" unless absolutely necessary.

COMMON XACTIMATE CODES TO USE:
- Drywall: MASKSF, MASKLF, MASKLFT (masking), MASKSFP (masking premium)
- Paint: BTF4, BTF6, BTF10, BTF12 (base coat), FINALR (final roll), TEXMK (texture)
- Cabinets: CTDK (cabinet door kitchen), CTFL (cabinet face lift), CTGE (cabinet general), CTGM (cabinet general medium), CTSS (cabinet side splash)
- Countertops: COUNTER, CTCON (countertop construction), CTDK (countertop door kitchen)
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

For each item you see, provide:
1. Xactimate code (REQUIRED - use actual codes from the list above or similar standard Xactimate codes)
2. Full description matching Xactimate format (e.g., "Remove and replace drywall", "Paint wall", "Install cabinet")
3. Estimated quantity/measurement (e.g., "120 sq ft", "3 each", "15 linear feet")
4. Location/room where visible (if applicable)

Focus on identifying:
- Building materials (drywall, flooring, paint, roofing, siding, etc.)
- Fixtures and finishes (cabinets, countertops, fixtures, trim, etc.)
- Structural elements (beams, studs, framing, etc.)
- Damage that needs repair (water damage, fire damage, structural damage, etc.)
- Demolition/removal items (if damage is visible)
- Electrical, plumbing, HVAC components (if visible)

Be thorough - list everything you can see that would be part of a construction estimate.

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
      systemPrompt: `You are an expert Xactimate construction estimator with deep knowledge of:
- Xactimate line item codes and their exact formats (e.g., MASKSF, BTF10, CTDK, PLK, ELE)
- Standard Xactimate code patterns (e.g., codes ending in RS = "remove and set", codes with +/- = quality levels)
- Construction materials and finishes with their specific Xactimate codes
- Building components and systems with proper code assignments
- Damage assessment and repair scope
- Construction terminology and measurements

Your task is to analyze construction photos and identify all visible line items with their CORRECT Xactimate codes.

CRITICAL REQUIREMENTS:
1. You MUST provide actual Xactimate codes for each item - do NOT use "UNKNOWN"
2. Use standard Xactimate code formats (e.g., MASKSF for drywall masking, BTF10 for paint base coat)
3. Match codes to the specific item type and quality level visible
4. Use proper Xactimate descriptions (e.g., "Remove and replace" not "R&R")
5. Be thorough and accurate - only include items you can clearly see in the photo

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

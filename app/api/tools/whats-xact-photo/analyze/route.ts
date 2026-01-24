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

    // Create prompt for vision API
    const visionPrompt = `
Analyze this construction/damage photo and identify ALL visible line items that would be needed for a construction estimate.

For each item you see, provide:
1. Xactimate code (if you can identify it, otherwise use "UNKNOWN")
2. Full description of the item
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
      "code": "Xactimate code or 'UNKNOWN'",
      "description": "Full item description",
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

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations.
`

    console.log('[Whats Xact Photo] Analyzing image with vision API...', {
      fileId,
      fileName: fileRecord.originalName,
      imageSize: imageBuffer.length,
    })

    const aiResponse = await callAI({
      prompt: visionPrompt,
      toolId: 'whats-xact-photo',
      systemPrompt: `You are an expert construction estimator with deep knowledge of:
- Xactimate line item codes and descriptions
- Construction materials and finishes
- Building components and systems
- Damage assessment and repair scope
- Construction terminology and measurements

Your task is to analyze construction photos and identify all visible line items that would be needed for an estimate.

Be thorough and accurate. Only include items you can clearly see in the photo.`,
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

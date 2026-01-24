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

    // Create comprehensive prompt for full estimate generation
    const estimatePrompt = `
Analyze this construction/damage photo and create a COMPLETE, PROFESSIONAL construction estimate.

CRITICAL: Create a FULL ESTIMATE document, not just a list of items. This should be a complete, ready-to-use estimate.

PROJECT INFORMATION:
${projectName ? `Project Name: ${projectName}` : ''}
${claimNumber ? `Claim Number: ${claimNumber}` : ''}
${propertyAddress ? `Property Address: ${propertyAddress}` : ''}

ESTIMATE REQUIREMENTS:
1. Analyze ALL visible damage and restoration needs
2. Include ALL line items needed for complete restoration to pre-loss condition
3. Use ACTUAL Xactimate codes from the 13,000+ database
4. Provide accurate quantities based on what's visible
5. Include unit prices (use standard Xactimate pricing)
6. Calculate total prices for each line item
7. Organize by rooms/locations
8. Include summary totals

WHAT TO INCLUDE:
- VISIBLE DAMAGE: What you can clearly see
- PREP WORK: Protection, demolition, cleanup
- REPAIR WORK: All materials and labor needed
- FINISH WORK: Paint, texture, trim, caulking
- RELATED ITEMS: Complete scope (e.g., if drywall is damaged, include: demo, drywall, texture, paint, trim)
- FIXTURES: All fixtures that need repair/replacement
- MEASUREMENTS: Room dimensions, areas, linear feet, etc.

IMPORTANT RULES:
- ONLY use Xactimate codes that exist in the 13k+ database
- Verify codes match descriptions
- Use proper Xactimate descriptions
- Calculate quantities based on visible damage
- Include all related items for complete restoration
- Organize by room/location when applicable

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

CRITICAL: Return ONLY valid JSON. No markdown, no explanations. This must be a complete, professional estimate.
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
1. Create a COMPLETE estimate - not just line items, but a full estimate document
2. Use ONLY codes that exist in the 13k+ Xactimate database
3. Calculate quantities based on visible damage
4. Include ALL items needed for complete restoration
5. Organize by rooms/locations
6. Calculate accurate totals
7. Use proper Xactimate descriptions and formatting

Your estimate must be professional, complete, and ready to use.`,
      imageUrl: imageDataUrl,
      temperature: 0.1,
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
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }
      result = JSON.parse(jsonMatch[0])
    } catch (parseError: any) {
      console.error('[PhotoXact] AI response parse error:', parseError)
      console.error('[PhotoXact] AI Response:', aiResponse.result.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse estimate', details: parseError.message },
        { status: 500 }
      )
    }

    // Validate and enhance estimate structure
    if (!result.estimate) {
      return NextResponse.json(
        { error: 'Invalid estimate structure from AI' },
        { status: 500 }
      )
    }

    // Post-process: Validate all codes against database and enhance
    const validatedLineItems = []
    const invalidCodes: string[] = []
    
    for (const item of result.estimate.lineItems || []) {
      const code = item.code?.toString().trim().toUpperCase()
      const description = (item.description || '').trim()
      
      if (!code) {
        // No code - search by description
        if (description) {
          const matches = searchByKeyword(description, 5)
          if (matches.length > 0) {
            const bestMatch = matches.find((m: any) => {
              const matchDesc = m.description.toLowerCase()
              const itemDesc = description.toLowerCase()
              const itemWords = itemDesc.split(/\s+/).filter((w: string) => w.length > 3)
              return itemWords.some((word: string) => matchDesc.includes(word))
            }) || matches[0]
            
            item.code = bestMatch.code
            item.description = bestMatch.description
            validatedLineItems.push(item)
            continue
          }
        }
        invalidCodes.push('NO CODE')
        continue
      }
      
      // Validate code exists in database
      const xactItem = findByCode(code)
      if (!xactItem) {
        // Code doesn't exist - search by description
        if (description) {
          const matches = searchByKeyword(description, 5)
          if (matches.length > 0) {
            const bestMatch = matches.find((m: any) => {
              const matchDesc = m.description.toLowerCase()
              const itemDesc = description.toLowerCase()
              const itemWords = itemDesc.split(/\s+/).filter((w: string) => w.length > 3)
              return itemWords.some((word: string) => matchDesc.includes(word))
            }) || matches[0]
            
            item.code = bestMatch.code
            item.description = bestMatch.description
            validatedLineItems.push(item)
            invalidCodes.push(code)
            continue
          }
        }
        invalidCodes.push(code)
        continue
      }
      
      // Code exists - use official description
      item.code = xactItem.code
      item.description = xactItem.description
      validatedLineItems.push(item)
    }
    
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
    
    // Add warnings if codes were invalid
    if (invalidCodes.length > 0) {
      result.warnings = result.warnings || []
      result.warnings.push(`${invalidCodes.length} codes were corrected or removed`)
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

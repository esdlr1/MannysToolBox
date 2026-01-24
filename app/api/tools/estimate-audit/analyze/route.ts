import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { parseEstimatePDF } from '@/lib/pdf-parser'
import { existsSync } from 'fs'
import { checkDependencies } from '@/lib/estimate-dependencies'
import { searchByKeyword, findByCode } from '@/lib/xactimate-lookup'

export const dynamic = 'force-dynamic'

// Legacy helper functions (kept for backward compatibility)
// Note: Now using checkDependencies() from lib/estimate-dependencies.ts
function normalize(text: string) {
  return text.toLowerCase()
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
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

    // Debug: Check if API key is available
    const apiKey = process.env.OPENAI_API_KEY
    console.log('[Estimate Audit] API Key check:', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey?.substring(0, 10) || 'none',
    })

    const { fileId, projectName, notes } = await request.json()

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
      console.error('[Estimate Audit] File not found:', fileRecord.path)
      return NextResponse.json(
        { error: 'File not found on server. Please upload the file again.' },
        { status: 404 }
      )
    }

    let estimate
    try {
      estimate = await parseEstimatePDF(fileRecord.path)
    } catch (parseError: any) {
      console.error('[Estimate Audit] PDF parsing error:', parseError.message)
      console.error('[Estimate Audit] Error stack:', parseError.stack)
      if (isOpenAIAuthError(parseError)) {
        return NextResponse.json(
          { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
          { status: 401 }
        )
      }
      // Return more detailed error message
      return NextResponse.json(
        { error: `Failed to parse PDF: ${parseError.message}` },
        { status: 500 }
      )
    }
    const lineItems = estimate.lineItems || []

    // Use comprehensive dependency checking system
    const heuristicMissing = checkDependencies(lineItems)

    const auditPrompt = `
You are an expert construction estimator specializing in Xactimate and Symbility estimates. Analyze this SINGLE estimate to check for missing line items that should accompany each other.

You have comprehensive knowledge of construction dependencies across ALL trades:

**ROOFING DEPENDENCIES:**
- Shingles → Underlayment (felt, ice shield), Flashing (valleys, ridges, penetrations), Drip edge, Gutters/downspouts
- Roof replacement → Ventilation systems, Gutter repairs

**PLUMBING DEPENDENCIES:**
- Pipe replacement → Shutoff valves, Access panels (if in wall/ceiling)
- Fixtures (toilet, sink, shower) → Supply lines (use specific Xactimate codes like PLK, PLM, supply line codes), Drain/waste lines, P-traps (PTRAP, PTRAPRS), Connectors, Shutoff valves
- Water heater → Expansion tank (often code-required)
- CRITICAL: When flagging plumbing items, you MUST provide SPECIFIC Xactimate codes from the 13k+ database. Do not use generic descriptions. List ALL specific line items needed (e.g., supply lines, connectors, shutoff valves, etc.)

**ELECTRICAL DEPENDENCIES:**
- Wiring → Junction boxes OR electrical boxes (these are the SAME thing - do not flag both), Grounding systems (if separate from boxes)
- New circuits → Circuit breakers in panel
- Outlets/switches → Electrical boxes (same as junction boxes - do not duplicate)
- IMPORTANT: "Junction boxes" and "Electrical boxes" are the SAME thing. "Grounding system" and "Electrical box" are NOT the same - grounding is a separate system. However, if electrical boxes are present, basic grounding is typically included. Only flag grounding if it's a separate system requirement.

**HVAC DEPENDENCIES:**
- HVAC units → Ductwork, Supply/return vents/registers
- AC/Heat pumps → Refrigerant lines/line sets, Insulation on lines
- HVAC systems → Thermostats/controls

**FLOORING DEPENDENCIES:**
- Flooring installation → Subfloor preparation, Underlayment
- Tile → Grout, Sealer (optional)
- Carpet → Padding/underlayment
- Multiple flooring types → Transition strips

**DRYWALL DEPENDENCIES:**
- IMPORTANT: "Drywall per LF" line items ALREADY INCLUDE tape, joint compound (mud), and texture. DO NOT flag these as missing if "Drywall per LF" is present.
- Drywall replacement → Prime/seal, Paint (only if not already included in drywall line item)
- Drywall installation → Corner bead/trim
- Full room paint: Only flag if damage is extensive AND no wall/ceiling calculations are present. If calculations for walls/ceilings exist, paint is likely already accounted for.

**WINDOWS & DOORS:**
- Windows → Flashing, Caulk/sealant, Trim/casing
- Doors → Hardware (hinges, lockset, handle), Weatherstripping (exterior)

**SIDING & EXTERIOR:**
- Siding → Underlayment/WRVB, Flashing (corners, penetrations), Trim

**WATER DAMAGE RESTORATION:**
- Water damage → Demolition, Drying equipment (dehumidifiers, air movers), Moisture barriers, Mold remediation (if present)

**FIRE DAMAGE RESTORATION:**
- Fire damage → Smoke cleaning/deodorization, Structural assessment

**FOUNDATION & STRUCTURAL:**
- Foundation work → Waterproofing, Drainage systems
- Concrete slabs → Reinforcement (rebar/mesh), Vapor barriers

**GENERAL CONSTRUCTION:**
- Major construction → Permits/inspections, Cleanup/waste removal, Site protection

**ADDITIONAL CONSIDERATIONS:**
- Code compliance items (grounding, expansion tanks, access panels)
- Regional code variations
- Commercial vs residential differences
- Quality levels (standard vs premium materials)
- Waste factors and material overage
- Labor burden and overhead
- Contingency and risk allowances

**FOCUS ON CONSISTENCY FOR EVERYDAY ESTIMATES:**
Your goal is to help estimators catch common missing items that are typically included in similar estimates.

**IMPORTANT RULES:**
1. **Be conservative**: Only flag items with high confidence that they're actually missing
2. **Check for synonyms**: Items might be present with different wording (e.g., "joint compound" vs "mud", "primer" vs "sealer")
3. **Consider context**: Don't flag optional items if the scope doesn't warrant them (e.g., "full room paint" for a small patch)
4. **Focus on code compliance and standards**: Prioritize items required by code or industry standards
5. **Everyday patterns**: Think about what estimators typically include in similar situations

**EXCLUSIONS - DO NOT FLAG IF:**
- The item already exists (even with different wording or abbreviation)
- "Drywall per LF" is present - this ALREADY includes tape, joint compound, and texture
- Wall/ceiling calculations are present - paint is likely already accounted for
- The scope is too minor (e.g., small patch doesn't need full room paint)
- The item is clearly not applicable (e.g., expansion tank for tankless water heater)
- The item is optional and context suggests it's intentionally excluded
- "Junction boxes" and "Electrical boxes" - these are the same, don't flag both

**VALIDATION:**
Before flagging any item, verify:
- It's truly missing (check synonyms and variations)
- It's appropriate for the scope
- It's a common inclusion in similar estimates
- It's not excluded by the specific context

PROJECT INFO:
Project: ${projectName || 'N/A'}
Notes: ${notes || 'None'}

ESTIMATE SUMMARY:
Total Line Items: ${lineItems.length}
Total Cost: ${estimate.totalCost || 0}
Format: ${estimate.metadata?.format || 'unknown'}

LINE ITEMS:
${JSON.stringify(lineItems, null, 2)}

**XACTIMATE LINE ITEM DATABASE:**
This system has access to a comprehensive database of Xactimate line items with codes and descriptions.
When checking for missing items, consider that line items might be present with:
- Xactimate codes (e.g., "MASKSF", "BTF10", "P2", "AHAC2")
- Standard Xactimate descriptions
- Variations of descriptions

Before flagging an item as missing, verify it's not already present using Xactimate codes or standard terminology.

HEURISTIC MISSING CANDIDATES (from rule checks):
${JSON.stringify(heuristicMissing, null, 2)}

RETURN FORMAT (JSON only, no markdown):
{
  "missingLineItems": [
    {
      "requiredItem": "Specific Xactimate code and description (e.g., 'PLK - Plumbing kitchen supply line')",
      "xactimateCode": "Xactimate code if known (e.g., 'PLK', 'PTRAPRS', 'ELE')",
      "reason": "string",
      "priority": "critical" | "minor",
      "relatedItemsFound": ["string - items that triggered this suggestion"],
      "suggestedLineItems": ["List of ALL specific Xactimate line items needed - use codes from 13k+ database"],
      "room": "string (optional)"
    }
  ],
  "summary": {
    "checkedRules": number,
    "missingCount": number,
    "criticalCount": number,
    "minorCount": number
  },
  "notes": ["string"]
}

CRITICAL FORMATTING RULES:
- "suggestedLineItems" should list ALL specific line items needed (e.g., for plumbing: list all supply lines, connectors, shutoff valves with their Xactimate codes)
- Do NOT list items as "related items" - list them directly in "suggestedLineItems"
- Use actual Xactimate codes from the 13k+ database when possible
- For plumbing: List ALL specific items (supply lines, connectors, shutoff valves, etc.) - not just "supply lines"

IMPORTANT:
- Only include truly missing items.
- Be conservative: if the item exists or is clearly covered, do not flag it.
- Return ONLY valid JSON.
`

    const aiResponse = await callAI({
      prompt: auditPrompt,
      toolId: 'estimate-audit',
      systemPrompt: `You are an expert construction estimator with comprehensive knowledge of:

- Xactimate and Symbility line item codes and descriptions
- Construction dependencies across ALL trades (roofing, plumbing, electrical, HVAC, flooring, drywall, windows, doors, siding, water damage, fire damage, structural)
- Building codes and compliance requirements
- Industry best practices and standards
- Construction terminology and abbreviations
- Regional code variations
- Commercial vs residential differences
- Material specifications and quality levels
- Scope sequencing and dependencies

Your expertise covers:
- Roofing: Shingles, underlayment, flashing, gutters, ventilation
- Plumbing: Pipes, fixtures, valves, access panels, expansion tanks
- Electrical: Wiring, boxes, breakers, grounding, conduit
- HVAC: Units, ductwork, vents, refrigerant lines, controls
- Flooring: Subfloor, underlayment, grout, padding, transitions
- Drywall: Installation, finishing, texture, paint sequences
- Windows/Doors: Flashing, caulk, hardware, weatherstripping
- Siding: Underlayment, flashing, trim
- Water/Fire Damage: Demolition, drying, cleaning, remediation
- Structural: Foundation, waterproofing, drainage, reinforcement

Return only valid JSON matching the requested schema.
IMPORTANT: Always return COMPLETE, valid JSON. Never truncate the response mid-JSON.`,
      temperature: 0.2,
      maxTokens: 6000, // Increased to handle detailed responses with specific codes
      model: 'gpt-4o', // Use gpt-4o for better accuracy
    })

    if (aiResponse.error) {
      throw new Error(aiResponse.error)
    }

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
      console.error('AI response parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    // Post-process results: Enhance with Xactimate codes and remove duplicates
    if (result.missingLineItems && Array.isArray(result.missingLineItems)) {
      const processedItems = []
      const seenItems = new Set<string>()
      
      for (const item of result.missingLineItems) {
        // Skip if "Drywall per LF" is present and item is about tape/joint/texture
        const hasDrywallPerLF = lineItems.some(li => {
          const desc = (li.item || li.description || '').toLowerCase()
          return desc.includes('drywall per lf') || desc.includes('drywall per linear')
        })
        
        if (hasDrywallPerLF && (
          item.requiredItem.toLowerCase().includes('tape') ||
          item.requiredItem.toLowerCase().includes('joint') ||
          item.requiredItem.toLowerCase().includes('mud') ||
          item.requiredItem.toLowerCase().includes('texture')
        )) {
          continue // Skip - already included in drywall per LF
        }
        
        // Skip if wall/ceiling calculations exist and item is about full room paint
        const hasWallCeilingCalc = lineItems.some(li => {
          const desc = (li.item || li.description || '').toLowerCase()
          return desc.includes('wall calculation') || desc.includes('ceiling calculation') ||
                 desc.includes('calc wall') || desc.includes('calc ceiling')
        })
        
        if (hasWallCeilingCalc && item.requiredItem.toLowerCase().includes('paint entire affected room')) {
          continue // Skip - calculations likely include paint
        }
        
        // Remove duplicates (junction box vs electrical box)
        const normalizedItem = item.requiredItem.toLowerCase()
        if (normalizedItem.includes('junction box') || normalizedItem.includes('electrical box')) {
          const key = 'electrical_box'
          if (seenItems.has(key)) {
            continue // Skip duplicate
          }
          seenItems.add(key)
        }
        
        // Enhance with Xactimate codes if not provided
        if (!item.xactimateCode && item.requiredItem) {
          const matches = searchByKeyword(item.requiredItem, 3)
          if (matches.length > 0) {
            item.xactimateCode = matches[0].code
            item.requiredItem = `${matches[0].code} - ${matches[0].description}`
          }
        }
        
        // For plumbing items, expand to list all specific line items
        if (item.requiredItem.toLowerCase().includes('plumbing') || 
            item.requiredItem.toLowerCase().includes('supply line') ||
            item.requiredItem.toLowerCase().includes('fixture')) {
          if (!item.suggestedLineItems || item.suggestedLineItems.length === 0) {
            // Search for all related plumbing items
            const plumbingMatches = searchByKeyword('plumbing supply line', 10)
            const connectorMatches = searchByKeyword('plumbing connector', 10)
            const shutoffMatches = searchByKeyword('shutoff valve', 10)
            
            item.suggestedLineItems = [
              ...plumbingMatches.slice(0, 3).map(m => `${m.code} - ${m.description}`),
              ...connectorMatches.slice(0, 2).map(m => `${m.code} - ${m.description}`),
              ...shutoffMatches.slice(0, 2).map(m => `${m.code} - ${m.description}`)
            ]
          }
        }
        
        processedItems.push(item)
      }
      
      result.missingLineItems = processedItems
      result.summary.missingCount = processedItems.length
      result.summary.criticalCount = processedItems.filter(i => i.priority === 'critical').length
      result.summary.minorCount = processedItems.filter(i => i.priority === 'minor').length
    }

    // Auto-save the audit result
    try {
      const fileRecord = await prisma.file.findUnique({
        where: { id: fileId },
      })

      await prisma.savedWork.create({
        data: {
          userId: session.user.id,
          toolId: 'estimate-audit',
          title: `Estimate Audit${projectName ? ` - ${projectName}` : ''}`,
          description: projectName || `Audit completed on ${new Date().toLocaleDateString()}`,
          data: {
            projectName: projectName || '',
            notes: notes || '',
            auditResult: result,
            fileName: fileRecord?.originalName || 'Unknown',
            createdAt: new Date().toISOString(),
          },
          files: [fileId],
        },
      })
      console.log('[Estimate Audit] Auto-saved audit result')
    } catch (saveError) {
      // Don't fail the request if save fails, just log it
      console.error('[Estimate Audit] Failed to auto-save:', saveError)
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Estimate Audit] Error:', error)
    console.error('[Estimate Audit] Error stack:', error.stack)
    if (isOpenAIAuthError(error)) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to analyze estimate', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

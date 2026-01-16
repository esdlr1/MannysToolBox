import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { parseEstimatePDF } from '@/lib/pdf-parser'

export const dynamic = 'force-dynamic'

function normalize(text: string) {
  return text.toLowerCase()
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const estimate = await parseEstimatePDF(fileRecord.path)
    const lineItems = estimate.lineItems || []

    const itemTexts = lineItems.map((item) => {
      const description = item.description || item.item || ''
      const code = item.code ? ` (${item.code})` : ''
      return `${description}${code}`.trim()
    })
    const normalizedItems = itemTexts.map((text) => normalize(text))

    const hasDrywallReplace = normalizedItems.some((text) =>
      hasAny(text, ['drywall', 'sheetrock']) && hasAny(text, ['replace', 'replacement', 'remove', 'demo', 'install', 'hang'])
    )
    const hasTexture = normalizedItems.some((text) => hasAny(text, ['texture', 'orange peel', 'knockdown']))
    const hasTapeMud = normalizedItems.some((text) => hasAny(text, ['tape', 'mud', 'compound', 'joint']))
    const hasPrime = normalizedItems.some((text) => hasAny(text, ['prime', 'primer', 'seal']))
    const hasPaint = normalizedItems.some((text) => hasAny(text, ['paint', 'finish coat']))
    const hasRoomPaint = normalizedItems.some((text) => hasAny(text, ['paint room', 'paint walls', 'paint ceiling', 'paint entire']))

    const heuristicMissing: Array<{
      requiredItem: string
      reason: string
      priority: 'critical' | 'minor'
      relatedItemsFound?: string[]
    }> = []

    if (hasDrywallReplace && !hasTapeMud) {
      heuristicMissing.push({
        requiredItem: 'Drywall tape and mud (finish)',
        reason: 'Drywall replacement typically requires taping and joint compound.',
        priority: 'critical',
        relatedItemsFound: itemTexts.filter((text, idx) => normalizedItems[idx].includes('drywall')),
      })
    }

    if (hasDrywallReplace && !hasTexture) {
      heuristicMissing.push({
        requiredItem: 'Drywall texture (match existing)',
        reason: 'Drywall replacement usually requires re-texturing to match existing finish.',
        priority: 'critical',
        relatedItemsFound: itemTexts.filter((text, idx) => normalizedItems[idx].includes('drywall')),
      })
    }

    if (hasDrywallReplace && !hasPrime) {
      heuristicMissing.push({
        requiredItem: 'Prime/seal new drywall',
        reason: 'New drywall needs primer/sealer before paint.',
        priority: 'minor',
        relatedItemsFound: itemTexts.filter((text, idx) => normalizedItems[idx].includes('drywall')),
      })
    }

    if (hasDrywallReplace && !hasPaint) {
      heuristicMissing.push({
        requiredItem: 'Paint repaired surfaces',
        reason: 'Drywall replacement usually requires painting finished surfaces.',
        priority: 'critical',
        relatedItemsFound: itemTexts.filter((text, idx) => normalizedItems[idx].includes('drywall')),
      })
    }

    if (hasDrywallReplace && !hasRoomPaint) {
      heuristicMissing.push({
        requiredItem: 'Paint entire affected room (walls/ceiling)',
        reason: 'Patching drywall often requires full room paint for color/texture consistency.',
        priority: 'minor',
        relatedItemsFound: itemTexts.filter((text, idx) => normalizedItems[idx].includes('drywall')),
      })
    }

    const auditPrompt = `
You are an expert construction estimator. Analyze this SINGLE estimate to check for missing line items that should accompany each other.

Focus on Xactimate-style estimates and real-world construction dependencies.

Rules to enforce (at minimum):
1. Drywall replacement should include: tape/mud, texture, prime/seal, paint.
2. Drywall removal/replacement should include painting the affected room (walls and/or ceiling).

Use the provided line items and identify missing items that are required to complete the scope. 
If a related item is already present, do NOT flag it.

PROJECT INFO:
Project: ${projectName || 'N/A'}
Notes: ${notes || 'None'}

ESTIMATE SUMMARY:
Total Line Items: ${lineItems.length}
Total Cost: ${estimate.totalCost || 0}
Format: ${estimate.metadata?.format || 'unknown'}

LINE ITEMS:
${JSON.stringify(lineItems, null, 2)}

HEURISTIC MISSING CANDIDATES (from rule checks):
${JSON.stringify(heuristicMissing, null, 2)}

RETURN FORMAT (JSON only, no markdown):
{
  "missingLineItems": [
    {
      "requiredItem": "string",
      "reason": "string",
      "priority": "critical" | "minor",
      "relatedItemsFound": ["string"],
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

IMPORTANT:
- Only include truly missing items.
- Be conservative: if the item exists or is clearly covered, do not flag it.
- Return ONLY valid JSON.
`

    const aiResponse = await callAI({
      prompt: auditPrompt,
      toolId: 'estimate-audit',
      systemPrompt: `You are an expert construction estimator with deep knowledge of:
- Xactimate line item codes and descriptions
- Drywall, texture, paint sequencing
- Scope dependencies (e.g., prep + finish + paint)
- Construction terminology and abbreviations

Return only valid JSON matching the requested schema.`,
      temperature: 0.2,
      maxTokens: 2000,
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

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Estimate audit error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze estimate', details: error.message },
      { status: 500 }
    )
  }
}

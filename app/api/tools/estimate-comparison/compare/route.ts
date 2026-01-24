import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { preprocessComparison, validateComparisonResult } from '@/lib/estimate-comparison'
import { parseEstimatePDF } from '@/lib/pdf-parser'
import { existsSync } from 'fs'

// Mark as dynamic route since it uses getServerSession, file operations, and AI calls
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { adjusterFileId, contractorFileId, clientName, claimNumber } = await request.json()

    if (!adjusterFileId || !contractorFileId || !clientName || !claimNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get file records
    const adjusterFile = await prisma.file.findUnique({
      where: { id: adjusterFileId },
    })

    const contractorFile = await prisma.file.findUnique({
      where: { id: contractorFileId },
    })

    if (!adjusterFile || !contractorFile) {
      return NextResponse.json(
        { error: 'Files not found' },
        { status: 404 }
      )
    }

    // Verify file ownership
    if (adjusterFile.userId !== session.user.id || contractorFile.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if files exist on filesystem (important for Railway ephemeral storage)
    if (!existsSync(adjusterFile.path)) {
      console.error('[Estimate Comparison] Adjuster file not found:', adjusterFile.path)
      return NextResponse.json(
        { error: 'Adjuster file not found on server. Please upload the file again.' },
        { status: 404 }
      )
    }

    if (!existsSync(contractorFile.path)) {
      console.error('[Estimate Comparison] Contractor file not found:', contractorFile.path)
      return NextResponse.json(
        { error: 'Contractor file not found on server. Please upload the file again.' },
        { status: 404 }
      )
    }

    const processingStartTime = Date.now()

    // Parse both estimates from file paths with timeout
    let adjusterData, contractorData
    try {
      console.log('[Estimate Comparison] Parsing adjuster file...', adjusterFile.path)
      const adjusterStartTime = Date.now()
      adjusterData = await Promise.race([
        parseEstimatePDF(adjusterFile.path),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Adjuster file parsing timed out after 2 minutes')), 2 * 60 * 1000)
        )
      ]) as any
      const adjusterParseTime = Date.now() - adjusterStartTime
      console.log('[Estimate Comparison] Adjuster file parsed:', {
        lineItems: adjusterData.lineItems?.length || 0,
        totalCost: adjusterData.totalCost,
        parseTime: `${adjusterParseTime}ms`,
      })
    } catch (parseError: any) {
      console.error('[Estimate Comparison] Failed to parse adjuster file:', parseError)
      return NextResponse.json(
        { error: `Failed to parse adjuster estimate: ${parseError.message}` },
        { status: 500 }
      )
    }

    try {
      console.log('[Estimate Comparison] Parsing contractor file...', contractorFile.path)
      const contractorStartTime = Date.now()
      contractorData = await Promise.race([
        parseEstimatePDF(contractorFile.path),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Contractor file parsing timed out after 2 minutes')), 2 * 60 * 1000)
        )
      ]) as any
      const contractorParseTime = Date.now() - contractorStartTime
      console.log('[Estimate Comparison] Contractor file parsed:', {
        lineItems: contractorData.lineItems?.length || 0,
        totalCost: contractorData.totalCost,
        parseTime: `${contractorParseTime}ms`,
      })
    } catch (parseError: any) {
      console.error('[Estimate Comparison] Failed to parse contractor file:', parseError)
      return NextResponse.json(
        { error: `Failed to parse contractor estimate: ${parseError.message}` },
        { status: 500 }
      )
    }

    // Pre-process for better comparison accuracy
    const preprocessing = preprocessComparison(adjusterData, contractorData)

    // Prepare structured data for AI comparison
    const adjusterSummary = {
      totalLineItems: adjusterData.lineItems?.length || 0,
      totalCost: adjusterData.totalCost || 0,
      categories: adjusterData.subtotals || {},
      sampleItems: adjusterData.lineItems?.slice(0, 10) || [],
    }

    const contractorSummary = {
      totalLineItems: contractorData.lineItems?.length || 0,
      totalCost: contractorData.totalCost || 0,
      categories: contractorData.subtotals || {},
      sampleItems: contractorData.lineItems?.slice(0, 10) || [],
    }

    // Include preprocessing hints for AI
    const preprocessingHints = {
      suggestedMatches: preprocessing.suggestedMatches.length,
      potentialMissingItems: preprocessing.potentialMissingItems.length,
      potentialDiscrepancies: preprocessing.potentialDiscrepancies.length,
    }

    // Simplified comparison prompt - focus on what's in one but not the other
    const comparisonPrompt = `
TASK: Compare two construction estimates and list what's in one but not the other.

SIMPLE RULE: Two items are THE SAME if:
1. They have the same Xactimate/Symbility code (e.g., "MASKSF" = "MASKSF")
2. OR they have very similar descriptions AND same quantity AND same price (within $1)

SYNONYM MATCHING - These are the SAME:
- "Remove and replace" = "R&R" = "Demo and install" = "Remove & Replace"
- "Square feet" = "sq ft" = "sqft" = "SF" = "sq.ft"
- "Linear feet" = "lf" = "ln ft" = "LF"
- "Drywall" = "Sheetrock" = "Gypsum board"
- "Kitchen" = "Kit" = "K"
- "Living Room" = "LR" = "Living Rm"

ITEMS ALREADY MATCHED (these exist in BOTH estimates - ignore them):
${JSON.stringify(preprocessing.suggestedMatches.slice(0, 100).map(m => ({
  contractor: `${m.contractorItem.code || ''} ${m.contractorItem.item}`,
  adjuster: `${m.adjusterItem.code || ''} ${m.adjusterItem.item}`,
  reason: m.confidence >= 0.95 ? 'Same code' : 'Similar description'
})), null, 2)}

WHAT TO FIND:
1. Items in CONTRACTOR estimate but NOT in ADJUSTER estimate
2. Items in ADJUSTER estimate but NOT in CONTRACTOR estimate

HOW TO CHECK:
For each contractor item, search the adjuster estimate for:
- Same code (if code exists)
- Similar description (accounting for synonyms above)
- Same quantity + same price (within $1)

If you find a match using any of these methods, the item EXISTS in both estimates - do NOT list it.

Only list items where you cannot find a match using any method above.

ADJUSTER ESTIMATE SUMMARY:
${JSON.stringify(adjusterSummary, null, 2)}

FULL ADJUSTER LINE ITEMS:
${JSON.stringify(adjusterData.lineItems || [], null, 2)}

CONTRACTOR ESTIMATE SUMMARY:
${JSON.stringify(contractorSummary, null, 2)}

FULL CONTRACTOR LINE ITEMS:
${JSON.stringify(contractorData.lineItems || [], null, 2)}

MEASUREMENTS:
Adjuster: ${JSON.stringify(adjusterData.measurements || [], null, 2)}
Contractor: ${JSON.stringify(contractorData.measurements || [], null, 2)}

{
  "contractorOnlyItems": [
    {
      "item": "Full item description from contractor estimate",
      "code": "Xactimate code if available",
      "quantity": 1.0,
      "unitPrice": 100.00,
      "totalPrice": 100.00
    }
  ],
  "adjusterOnlyItems": [
    {
      "item": "Full item description from adjuster estimate",
      "code": "Xactimate code if available",
      "quantity": 1.0,
      "unitPrice": 100.00,
      "totalPrice": 100.00
    }
  ],
  "summary": {
    "contractorTotal": 0.00,
    "adjusterTotal": 0.00,
    "contractorOnlyCount": 0,
    "adjusterOnlyCount": 0,
    "contractorOnlyTotal": 0.00,
    "adjusterOnlyTotal": 0.00
  }
}

INSTRUCTIONS:
- "contractorOnlyItems" = Items in CONTRACTOR estimate but NOT in ADJUSTER estimate
- "adjusterOnlyItems" = Items in ADJUSTER estimate but NOT in CONTRACTOR estimate
- Only include items that are truly missing (not just worded differently)
- Return ONLY valid JSON, no markdown, no explanations
`

    // Limit line items in prompt to prevent token overflow
    const maxItemsPerEstimate = 100 // Limit to prevent prompt from being too large
    const adjusterItems = (adjusterData.lineItems || []).slice(0, maxItemsPerEstimate)
    const contractorItems = (contractorData.lineItems || []).slice(0, maxItemsPerEstimate)

    // Update the prompt with limited items
    const limitedComparisonPrompt = comparisonPrompt
      .replace(
        /FULL ADJUSTER LINE ITEMS:[\s\S]*?FULL CONTRACTOR LINE ITEMS:/,
        `FULL ADJUSTER LINE ITEMS (showing first ${Math.min(maxItemsPerEstimate, adjusterItems.length)} of ${adjusterData.lineItems?.length || 0}):
${JSON.stringify(adjusterItems, null, 2)}

FULL CONTRACTOR LINE ITEMS (showing first ${Math.min(maxItemsPerEstimate, contractorItems.length)} of ${contractorData.lineItems?.length || 0}):`
      )

    console.log('[Estimate Comparison] Calling AI with:', {
      adjusterItems: adjusterItems.length,
      contractorItems: contractorItems.length,
      promptLength: limitedComparisonPrompt.length,
      promptSizeKB: Math.round(limitedComparisonPrompt.length / 1024),
    })

    const aiStartTime = Date.now()
    let aiResponse
    try {
      aiResponse = await Promise.race([
        callAI({
          prompt: limitedComparisonPrompt,
          toolId: 'estimate-comparison',
          systemPrompt: `You are comparing two construction estimates. Your task is simple:

1. Find items in contractor estimate that are NOT in adjuster estimate
2. Find items in adjuster estimate that are NOT in contractor estimate

MATCHING RULES:
- Same code = same item (always match)
- Similar description + same quantity + same price = same item (match)
- When in doubt, assume items match (don't list them)

Return ONLY valid JSON matching the schema. No markdown, no explanations.`,
          temperature: 0.1, // Lower temperature for more consistent results
          maxTokens: 8000, // Increased to handle larger responses
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI call timed out after 3 minutes')), 3 * 60 * 1000)
        )
      ]) as any
      const aiTime = Date.now() - aiStartTime
      console.log('[Estimate Comparison] AI call completed:', {
        hasError: !!aiResponse.error,
        responseLength: aiResponse.result?.length || 0,
        aiTime: `${aiTime}ms`,
      })
    } catch (aiError: any) {
      console.error('[Estimate Comparison] AI call failed:', aiError)
      return NextResponse.json(
        { error: `AI processing failed: ${aiError.message}` },
        { status: 500 }
      )
    }

    if (aiResponse.error) {
      return NextResponse.json(
        { error: aiResponse.error },
        { status: 500 }
      )
    }

    // Parse AI response with enhanced error handling
    let comparisonResult
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = aiResponse.result.trim()
      
      // Remove markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      // Try to extract JSON object
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        comparisonResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in AI response')
      }

      // Validate and enhance the result structure
      if (!comparisonResult.contractorOnlyItems) comparisonResult.contractorOnlyItems = []
      if (!comparisonResult.adjusterOnlyItems) comparisonResult.adjusterOnlyItems = []
      if (!comparisonResult.summary) {
        comparisonResult.summary = {
          contractorTotal: contractorData.totalCost || 0,
          adjusterTotal: adjusterData.totalCost || 0,
          contractorOnlyCount: 0,
          adjusterOnlyCount: 0,
          contractorOnlyTotal: 0,
          adjusterOnlyTotal: 0,
        }
      }

      // Calculate summary if not provided
      if (comparisonResult.summary.contractorOnlyCount === undefined || comparisonResult.summary.contractorOnlyCount === 0) {
        comparisonResult.summary.contractorOnlyCount = comparisonResult.contractorOnlyItems.length
      }
      if (comparisonResult.summary.adjusterOnlyCount === undefined || comparisonResult.summary.adjusterOnlyCount === 0) {
        comparisonResult.summary.adjusterOnlyCount = comparisonResult.adjusterOnlyItems.length
      }
      if (comparisonResult.summary.contractorOnlyTotal === undefined || comparisonResult.summary.contractorOnlyTotal === 0) {
        comparisonResult.summary.contractorOnlyTotal = comparisonResult.contractorOnlyItems.reduce(
          (sum: number, item: any) => sum + (item.totalPrice || 0),
          0
        )
      }
      if (comparisonResult.summary.adjusterOnlyTotal === undefined || comparisonResult.summary.adjusterOnlyTotal === 0) {
        comparisonResult.summary.adjusterOnlyTotal = comparisonResult.adjusterOnlyItems.reduce(
          (sum: number, item: any) => sum + (item.totalPrice || 0),
          0
        )
      }
      if (!comparisonResult.summary.contractorTotal) {
        comparisonResult.summary.contractorTotal = contractorData.totalCost || 0
      }
      if (!comparisonResult.summary.adjusterTotal) {
        comparisonResult.summary.adjusterTotal = adjusterData.totalCost || 0
      }

      // Add processing metadata
      const processingEndTime = Date.now()
      comparisonResult.processingTime = processingEndTime - processingStartTime
      if (aiResponse.usage?.totalTokens) {
        comparisonResult.tokenUsage = aiResponse.usage.totalTokens
      }

    } catch (parseError: any) {
      console.error('Failed to parse AI response:', parseError)
      console.error('AI Response:', aiResponse.result)
      
      // Return a helpful error with the raw response for debugging
      return NextResponse.json(
        { 
          error: 'Failed to parse comparison results. The AI response may be malformed.',
          details: parseError.message,
          rawResponse: aiResponse.result.substring(0, 500), // First 500 chars for debugging
        },
        { status: 500 }
      )
    }

    // Log usage
    await prisma.usageHistory.create({
      data: {
        userId: session.user.id,
        toolId: 'estimate-comparison',
        action: 'comparison_completed',
        metadata: {
          clientName,
          claimNumber,
          contractorOnlyCount: comparisonResult.summary?.contractorOnlyCount || 0,
          adjusterOnlyCount: comparisonResult.summary?.adjusterOnlyCount || 0,
        },
      },
    })

    // Auto-save the comparison result
    try {
      await prisma.savedWork.create({
        data: {
          userId: session.user.id,
          toolId: 'estimate-comparison',
          title: `Estimate Comparison - ${clientName}`,
          description: `Claim #${claimNumber}`,
          data: {
            clientName,
            claimNumber,
            comparisonResult,
            adjusterFile: adjusterFile.originalName,
            contractorFile: contractorFile.originalName,
            createdAt: new Date().toISOString(),
          },
          files: [adjusterFile.id, contractorFile.id],
        },
      })
      console.log('[Estimate Comparison] Auto-saved comparison result')
    } catch (saveError) {
      // Don't fail the request if save fails, just log it
      console.error('[Estimate Comparison] Failed to auto-save:', saveError)
    }

    return NextResponse.json(comparisonResult)
  } catch (error: any) {
    console.error('Comparison error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

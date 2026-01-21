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

    // Enhanced AI comparison prompt
    const comparisonPrompt = `
You are an expert construction estimator analyzing two construction estimates for comparison.

TASK: Compare the adjuster's estimate with the contractor's estimate and identify all differences.

COMPARISON RULES:
1. Missing Items: Items present in contractor estimate but NOT in adjuster estimate
   - Include: item description, quantity, unit price, total price
   - Flag as "critical" if total price > $500 or if it's a structural/safety item
   - Flag as "minor" otherwise

2. Discrepancies: Items present in both but with differences
   - Quantity differences: Flag if difference > 25%
   - Price differences: Flag if unit price difference > 15%
   - Measurement differences: Flag if difference > 25%
   - Flag as "critical" if total impact > $1000 or difference > 50%
   - Flag as "minor" otherwise

3. Scope Differences: Items in adjuster estimate but NOT in contractor estimate
   - These are items the adjuster included but contractor didn't
   - Usually less critical but should be noted

4. Similar Items: Items that are essentially the same but worded differently
   - Use construction terminology knowledge to match:
     - "Remove and replace" = "R&R" = "Demo and install"
     - "Square feet" = "sq ft" = "sqft"
     - "Linear feet" = "lf" = "ln ft"
   - Match items with >60% similarity

5. Room/Sketch Variations: Handle differences in room naming and sketch layouts
   - Room names may vary: "Kitchen" = "Kit" = "K" = "Kitchen Area"
   - Sketch differences are common - focus on matching items by description and code
   - If room/location is specified, use it for context but don't require exact match
   - Match items across different room names if description and code match
   - Examples: "Kitchen - Floor" matches "Kit - Floor", "Living Room" matches "LR"
   - Prioritize matching by item code and description over room name

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

PREPROCESSING HINTS (for validation):
- Suggested code matches: ${preprocessingHints.suggestedMatches}
- Potential missing items: ${preprocessingHints.potentialMissingItems}
- Potential discrepancies detected: ${preprocessingHints.potentialDiscrepancies}

Use these hints to validate your analysis, but perform your own thorough comparison.

RETURN FORMAT (JSON only, no markdown):
{
  "missingItems": [
    {
      "item": "string (item description)",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "category": "string (optional)",
      "priority": "critical" | "minor"
    }
  ],
  "discrepancies": [
    {
      "item": "string (item description)",
      "adjusterValue": number | string,
      "contractorValue": number | string,
      "difference": number | string,
      "differencePercent": number,
      "type": "quantity" | "price" | "measurement",
      "priority": "critical" | "minor"
    }
  ],
  "summary": {
    "totalCostDifference": number (contractor total - adjuster total),
    "missingItemsCount": number,
    "discrepanciesCount": number,
    "criticalIssues": number,
    "minorIssues": number
  }
}

IMPORTANT:
- Be thorough - check every item
- Use construction knowledge to match similar items
- Calculate all percentages accurately
- Flag critical issues appropriately
- Return ONLY valid JSON, no explanations or markdown
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
          systemPrompt: `You are an expert construction estimator with deep knowledge of:
- Construction terminology and abbreviations (R&R, demo, sq ft, lf, etc.)
- Standard construction line items and codes
- Xactimate and Symbility estimate formats
- Building codes and construction standards
- Cost estimation practices
- Room naming variations (Kitchen/Kit/K, Living Room/LR, Bedroom/BR, etc.)
- Sketch layout differences and how to match items across different room naming conventions

Your task is to accurately compare construction estimates, identifying:
1. Missing items (contractor has, adjuster doesn't)
2. Discrepancies in quantities, prices, measurements
3. Scope differences
4. Cost impacts

IMPORTANT: Handle room name and sketch variations intelligently:
- Match items by code and description even if room names differ
- "Kitchen" = "Kit" = "K" = "Kitchen Area" are the same room
- Focus on item matching, not exact room name matching
- Sketch differences are expected - prioritize item codes and descriptions

Be precise with calculations and prioritize critical issues that could affect project scope or safety.

IMPORTANT: Always return COMPLETE, valid JSON. Never truncate the response mid-JSON.`,
          temperature: 0.2, // Very low temperature for consistent, accurate results
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
      if (!comparisonResult.missingItems) comparisonResult.missingItems = []
      if (!comparisonResult.discrepancies) comparisonResult.discrepancies = []
      if (!comparisonResult.summary) {
        comparisonResult.summary = {
          totalCostDifference: 0,
          missingItemsCount: 0,
          discrepanciesCount: 0,
          criticalIssues: 0,
          minorIssues: 0,
        }
      }

      // Calculate summary if not provided
      if (comparisonResult.summary.missingItemsCount === 0) {
        comparisonResult.summary.missingItemsCount = comparisonResult.missingItems.length
      }
      if (comparisonResult.summary.discrepanciesCount === 0) {
        comparisonResult.summary.discrepanciesCount = comparisonResult.discrepancies.length
      }
      if (comparisonResult.summary.criticalIssues === 0) {
        comparisonResult.summary.criticalIssues = 
          comparisonResult.missingItems.filter((i: any) => i.priority === 'critical').length +
          comparisonResult.discrepancies.filter((d: any) => d.priority === 'critical').length
      }
      if (comparisonResult.summary.minorIssues === 0) {
        comparisonResult.summary.minorIssues = 
          comparisonResult.missingItems.filter((i: any) => i.priority === 'minor').length +
          comparisonResult.discrepancies.filter((d: any) => d.priority === 'minor').length
      }

      // Calculate total cost difference if not provided
      if (comparisonResult.summary.totalCostDifference === 0) {
        const missingTotal = comparisonResult.missingItems.reduce(
          (sum: number, item: any) => sum + (item.totalPrice || 0),
          0
        )
        comparisonResult.summary.totalCostDifference = 
          (contractorData.totalCost || 0) - (adjusterData.totalCost || 0) + missingTotal
      }

      // Validate the result structure
      if (!validateComparisonResult(comparisonResult)) {
        console.warn('Comparison result validation failed, but proceeding with result')
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
          discrepanciesCount: comparisonResult.summary?.discrepanciesCount || 0,
        },
      },
    })

    return NextResponse.json(comparisonResult)
  } catch (error: any) {
    console.error('Comparison error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

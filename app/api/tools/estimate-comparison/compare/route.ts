import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { preprocessComparison, validateComparisonResult } from '@/lib/estimate-comparison'
import { getSynonyms, getSynonymPairs, getPromptHints } from '@/lib/logic-rules'
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

    // Pre-process for better comparison accuracy (with user-taught synonyms)
    const [taughtSynonyms, synonymPairs, promptHints] = await Promise.all([
      getSynonyms(),
      getSynonymPairs(),
      getPromptHints('estimate_comparison'),
    ])
    const preprocessing = preprocessComparison(adjusterData, contractorData, taughtSynonyms)

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
    // CRITICAL: Only show high-confidence matches to avoid confusion
    const highConfidenceMatches = preprocessing.suggestedMatches
      .filter(m => m.confidence >= 0.95)
      .slice(0, 150) // Show more matches to help AI avoid false positives
    
    const comparisonPrompt = `
TASK: Compare two construction estimates and list what's in one but not the other.

CRITICAL RULES - Two items are THE SAME if ANY of these are true:
1. Same Xactimate/Symbility code (e.g., "MASKSF" = "MASKSF") - ALWAYS MATCH
2. Very similar description (80%+ word overlap) AND same quantity (within 10%) AND same unit price (within $1)
3. Same description AND same quantity AND same total price (within $1)

SYNONYM MATCHING - These are the SAME:
- "Remove and replace" = "R&R" = "Demo and install" = "Remove & Replace"
- "Square feet" = "sq ft" = "sqft" = "SF" = "sq.ft"
- "Linear feet" = "lf" = "ln ft" = "LF"
- "Drywall" = "Sheetrock" = "Gypsum board"
- "Kitchen" = "Kit" = "K"
- "Living Room" = "LR" = "Living Rm"
${synonymPairs.length > 0 ? synonymPairs.map(p => `- "${p.termA}" = "${p.termB}"`).join('\n') : ''}
${promptHints.length > 0 ? `\nADDITIONAL RULES (follow these):\n${promptHints.map(h => `- ${h}`).join('\n')}\n` : ''}

ITEMS ALREADY MATCHED WITH HIGH CONFIDENCE (these exist in BOTH estimates - DO NOT list them):
${JSON.stringify(highConfidenceMatches.map(m => ({
  contractor: `${m.contractorItem.code || 'NO CODE'} ${m.contractorItem.item} | Qty: ${m.contractorItem.quantity} | Price: $${m.contractorItem.unitPrice}`,
  adjuster: `${m.adjusterItem.code || 'NO CODE'} ${m.adjusterItem.item} | Qty: ${m.adjusterItem.quantity} | Price: $${m.adjusterItem.unitPrice}`,
  reason: m.confidence >= 0.95 ? 'Same code' : 'Similar description + qty + price'
})), null, 2)}

WHAT TO FIND:
1. Items in CONTRACTOR estimate but NOT in ADJUSTER estimate
2. Items in ADJUSTER estimate but NOT in CONTRACTOR estimate

HOW TO CHECK (be VERY conservative):
For each item, check if it matches ANY item in the other estimate using:
1. Same code (if both have codes) - if match found, item EXISTS in both
2. Similar description (80%+ word overlap) AND same quantity (within 10%) AND same unit price (within $1) - if match found, item EXISTS in both
3. Check the "ITEMS ALREADY MATCHED" list above - if item is there, it EXISTS in both

CRITICAL: If you find a match using ANY method, the item EXISTS in both estimates - DO NOT list it.

Only list items where you are CERTAIN there is NO match using any method above.
When in doubt, assume items match (don't list them).

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
- "contractorOnlyItems" = Items in CONTRACTOR estimate but NOT in ADJUSTER estimate (after checking all matching methods)
- "adjusterOnlyItems" = Items in ADJUSTER estimate but NOT in CONTRACTOR estimate (after checking all matching methods)
- BE CONSERVATIVE: Only include items that are TRULY missing (not just worded differently)
- If an item appears in the "ITEMS ALREADY MATCHED" list, it EXISTS in both - DO NOT list it
- When uncertain, err on the side of NOT listing an item (assume it matches)
- Return ONLY valid JSON, no markdown, no explanations
`

    // Dynamic item limit calculation based on token budget
    // gpt-4o has 128k context window, we'll use ~100k for safety
    // Each line item averages ~200-300 tokens when JSON stringified
    // Reserve tokens for: system prompt (~500), user prompt structure (~2000), response (~8000)
    const totalLineItems = (adjusterData.lineItems?.length || 0) + (contractorData.lineItems?.length || 0)
    const estimatedTokensPerItem = 250 // Average tokens per line item in JSON
    const reservedTokens = 500 + 2000 + 8000 // System + prompt structure + response
    const availableTokens = 100000 - reservedTokens // ~100k context window
    const maxItemsTotal = Math.floor(availableTokens / estimatedTokensPerItem)
    
    // Calculate dynamic limit per estimate (distribute evenly, but ensure at least 50 items each)
    const adjusterItemCount = adjusterData.lineItems?.length || 0
    const contractorItemCount = contractorData.lineItems?.length || 0
    const totalItems = adjusterItemCount + contractorItemCount
    
    let maxItemsPerEstimate: number
    let adjusterItems: any[]
    let contractorItems: any[]
    let adjusterTruncated = false
    let contractorTruncated = false
    
    if (totalItems <= maxItemsTotal) {
      // All items fit - use all of them
      maxItemsPerEstimate = Math.max(adjusterItemCount, contractorItemCount)
      adjusterItems = adjusterData.lineItems || []
      contractorItems = contractorData.lineItems || []
    } else {
      // Need to truncate - distribute proportionally
      const adjusterRatio = adjusterItemCount / totalItems
      const contractorRatio = contractorItemCount / totalItems
      
      maxItemsPerEstimate = Math.floor(maxItemsTotal * adjusterRatio)
      const contractorMax = Math.floor(maxItemsTotal * contractorRatio)
      
      // Ensure minimum of 50 items each if possible
      if (maxItemsPerEstimate < 50 && adjusterItemCount >= 50) {
        maxItemsPerEstimate = 50
      }
      if (contractorMax < 50 && contractorItemCount >= 50) {
        const adjustedContractorMax = 50
        maxItemsPerEstimate = Math.min(maxItemsPerEstimate, maxItemsTotal - adjustedContractorMax)
      }
      
      adjusterItems = (adjusterData.lineItems || []).slice(0, maxItemsPerEstimate)
      contractorItems = (contractorData.lineItems || []).slice(0, Math.min(contractorMax, maxItemsTotal - adjusterItems.length))
      
      adjusterTruncated = adjusterItemCount > adjusterItems.length
      contractorTruncated = contractorItemCount > contractorItems.length
      
      if (adjusterTruncated || contractorTruncated) {
        console.warn('[Estimate Comparison] Items truncated due to token limits:', {
          adjuster: `${adjusterItemCount} items (showing ${adjusterItems.length})`,
          contractor: `${contractorItemCount} items (showing ${contractorItems.length})`,
          maxItemsTotal,
          warning: 'Some items may not be compared accurately'
        })
      }
    }

    // Update the prompt with limited items
    const limitedComparisonPrompt = comparisonPrompt
      .replace(
        /FULL ADJUSTER LINE ITEMS:[\s\S]*?FULL CONTRACTOR LINE ITEMS:/,
        `FULL ADJUSTER LINE ITEMS (${adjusterItems.length} of ${adjusterData.lineItems?.length || 0}${adjusterTruncated ? ' - WARNING: Some items truncated due to token limits' : ''}):
${JSON.stringify(adjusterItems, null, 2)}

FULL CONTRACTOR LINE ITEMS (${contractorItems.length} of ${contractorData.lineItems?.length || 0}${contractorTruncated ? ' - WARNING: Some items truncated due to token limits' : ''}):`
      )

    console.log('[Estimate Comparison] Calling AI with:', {
      model: 'gpt-4o',
      adjusterItems: adjusterItems.length,
      contractorItems: contractorItems.length,
      adjusterTotal: adjusterData.lineItems?.length || 0,
      contractorTotal: contractorData.lineItems?.length || 0,
      adjusterTruncated,
      contractorTruncated,
      maxItemsTotal,
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
          model: 'gpt-4o', // Use gpt-4o for better accuracy
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
      
      // IMPORTANT: Cross-validate AI results against preprocessing matches
      // Remove items from AI results that were already matched by preprocessing
      const matchedContractorCodes = new Set(
        preprocessing.suggestedMatches
          .filter(m => m.confidence >= 0.95)
          .map(m => m.contractorItem.code)
          .filter(Boolean)
      )
      const matchedAdjusterCodes = new Set(
        preprocessing.suggestedMatches
          .filter(m => m.confidence >= 0.95)
          .map(m => m.adjusterItem.code)
          .filter(Boolean)
      )
      
      // Filter out false positives - items that were already matched
      comparisonResult.contractorOnlyItems = comparisonResult.contractorOnlyItems.filter((item: any) => {
        if (item.code && matchedContractorCodes.has(item.code)) {
          console.log('[Estimate Comparison] Filtered out false positive - contractor item already matched:', item.code)
          return false
        }
        return true
      })
      
      comparisonResult.adjusterOnlyItems = comparisonResult.adjusterOnlyItems.filter((item: any) => {
        if (item.code && matchedAdjusterCodes.has(item.code)) {
          console.log('[Estimate Comparison] Filtered out false positive - adjuster item already matched:', item.code)
          return false
        }
        return true
      })
      
      // Add warning if items were truncated
      if (adjusterTruncated || contractorTruncated) {
        comparisonResult.warning = `Some items were not compared (${adjusterTruncated ? 'adjuster' : ''}${adjusterTruncated && contractorTruncated ? ' and ' : ''}${contractorTruncated ? 'contractor' : ''} estimate had more than ${maxItemsPerEstimate} items). Results may be incomplete.`
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

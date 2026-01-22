import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { clientName, claimNumber, comparisonResult, notes } = await request.json()

    if (!comparisonResult) {
      return NextResponse.json({ error: 'No comparison result provided' }, { status: 400 })
    }

    // Create a new workbook
    const workbook = XLSX.utils.book_new()

    // Sheet 1: Executive Summary
    const summaryData = [
      ['Estimate Comparison Report'],
      ['Client:', clientName || 'N/A'],
      ['Claim Number:', claimNumber || 'N/A'],
      ['Report Date:', new Date().toLocaleDateString()],
      [],
      ['Summary'],
      ['Total Revenue Opportunity', `$${Math.abs(comparisonResult.summary?.totalCostDifference || 0).toFixed(2)}`],
      ['Matched Items Count', comparisonResult.summary?.matchedItemsCount || 0],
      ['Missing Items Count', comparisonResult.summary?.missingItemsCount || 0],
      ['Adjuster Only Items Count', comparisonResult.summary?.adjusterOnlyItemsCount || 0],
      ['Discrepancies Count', comparisonResult.summary?.discrepanciesCount || 0],
      ['Critical Issues', comparisonResult.summary?.criticalIssues || 0],
      ['Minor Issues', comparisonResult.summary?.minorIssues || 0],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    // Sheet 2: Matched Items
    if (comparisonResult.matchedItems && comparisonResult.matchedItems.length > 0) {
      const matchedHeaders = ['Contractor Item', 'Contractor Code', 'Adjuster Item', 'Adjuster Code', 'Confidence %', 'Match Reason']
      const matchedRows = comparisonResult.matchedItems.map((m: any) => [
        m.contractorItem,
        m.contractorCode || '',
        m.adjusterItem,
        m.adjusterCode || '',
        Math.round(m.confidence * 100),
        m.matchReason.replace(/_/g, ' '),
      ])
      const matchedSheet = XLSX.utils.aoa_to_sheet([matchedHeaders, ...matchedRows])
      XLSX.utils.book_append_sheet(workbook, matchedSheet, 'Matched Items')
    }

    // Sheet 3: Missing Items (Contractor Only)
    if (comparisonResult.missingItems && comparisonResult.missingItems.length > 0) {
      const missingHeaders = ['Item Description', 'Code', 'Quantity', 'Unit Price', 'Total Price', 'Category', 'Priority']
      const missingRows = comparisonResult.missingItems.map((item: any) => [
        item.item,
        item.code || '',
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.category || '',
        item.priority,
      ])
      const missingSheet = XLSX.utils.aoa_to_sheet([missingHeaders, ...missingRows])
      XLSX.utils.book_append_sheet(workbook, missingSheet, 'Missing Items')
    }

    // Sheet 4: Adjuster Only Items
    if (comparisonResult.adjusterOnlyItems && comparisonResult.adjusterOnlyItems.length > 0) {
      const adjusterHeaders = ['Item Description', 'Code', 'Quantity', 'Unit Price', 'Total Price', 'Category', 'Priority']
      const adjusterRows = comparisonResult.adjusterOnlyItems.map((item: any) => [
        item.item,
        item.code || '',
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.category || '',
        item.priority,
      ])
      const adjusterSheet = XLSX.utils.aoa_to_sheet([adjusterHeaders, ...adjusterRows])
      XLSX.utils.book_append_sheet(workbook, adjusterSheet, 'Adjuster Only Items')
    }

    // Sheet 5: Discrepancies
    if (comparisonResult.discrepancies && comparisonResult.discrepancies.length > 0) {
      const discHeaders = ['Item', 'Code', 'Type', 'Adjuster Value', 'Contractor Value', 'Difference', 'Difference %', 'Priority']
      const discRows = comparisonResult.discrepancies.map((disc: any) => [
        disc.item,
        disc.code || '',
        disc.type,
        disc.adjusterValue,
        disc.contractorValue,
        disc.difference,
        disc.differencePercent,
        disc.priority,
      ])
      const discSheet = XLSX.utils.aoa_to_sheet([discHeaders, ...discRows])
      XLSX.utils.book_append_sheet(workbook, discSheet, 'Discrepancies')
    }

    // Sheet 6: Notes
    if (notes) {
      const notesData = [['Notes'], [notes]]
      const notesSheet = XLSX.utils.aoa_to_sheet(notesData)
      XLSX.utils.book_append_sheet(workbook, notesSheet, 'Notes')
    }

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Estimate_Comparison_${clientName || 'Report'}_${claimNumber || Date.now()}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('[Excel Export] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export Excel', details: error.message },
      { status: 500 }
    )
  }
}

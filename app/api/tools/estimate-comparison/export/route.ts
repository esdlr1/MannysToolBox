import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateComparisonPDF } from '@/lib/pdf-generator'

// Mark as dynamic route since it uses getServerSession and generates PDFs
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

    const {
      clientName,
      claimNumber,
      comparisonResult,
      notes,
      showSideBySide,
      showHighlighted,
    } = await request.json()

    // Validate required fields
    if (!clientName || !claimNumber || !comparisonResult) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate PDF
    const pdfBuffer = await generateComparisonPDF({
      clientName,
      claimNumber,
      comparisonResult,
      notes: notes || '',
      showSideBySide: showSideBySide || false,
      showHighlighted: showHighlighted || false,
    })

    // Convert Buffer to Uint8Array for NextResponse
    const pdfArray = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfArray, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Estimate_Comparison_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${claimNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

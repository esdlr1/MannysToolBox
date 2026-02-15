import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Export supplement tracker report as PDF
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')

    // Only allow viewing own entries unless Super Admin/Owner
    const canViewAll = session.user.role === 'Super Admin' || session.user.role === 'Owner'
    const targetUserId = canViewAll && searchParams.get('userId') ? searchParams.get('userId') : session.user.id

    const where: any = { userId: targetUserId }

    // Filter by week: use date-only (UTC midnight) so comparison matches @db.Date storage
    if (weekStartParam) {
      const weekStart = new Date(weekStartParam.trim() + 'T00:00:00.000Z')
      if (isNaN(weekStart.getTime())) {
        return NextResponse.json({ error: 'Invalid weekStart date' }, { status: 400 })
      }
      where.weekStartDate = weekStart
    }

    const entries = await prisma.supplementTracker.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No entries found to export' }, { status: 404 })
    }

    // Calculate totals
    const totals = entries.reduce(
      (acc, entry) => ({
        totalOriginal: acc.totalOriginal + entry.originalAmount,
        totalSupplement: acc.totalSupplement + entry.supplementAmount,
        totalFinal: acc.totalFinal + entry.finalAmount,
      }),
      { totalOriginal: 0, totalSupplement: 0, totalFinal: 0 }
    )

    // Generate PDF
    const pdfBytes = await generateSupplementPDF({
      entries,
      totals,
      userName: session.user.name ?? session.user.email ?? 'User',
      weekStart: weekStartParam ? new Date(weekStartParam) : null,
    })

    const fileName = weekStartParam
      ? `Supplement_Tracker_${format(new Date(weekStartParam), 'yyyy-MM-dd')}.pdf`
      : `Supplement_Tracker_${format(new Date(), 'yyyy-MM-dd')}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: unknown) {
    // Client disconnected (navigated away, refreshed, or cancelled) — don't log as error
    const err = error as NodeJS.ErrnoException & { code?: string } | undefined
    if (err?.code === 'ECONNRESET' || (error instanceof Error && error.message === 'aborted')) {
      return new NextResponse(null, { status: 499 })
    }
    const message = error instanceof Error ? error.message : 'Failed to generate PDF'
    console.error('[Supplement Tracker Export] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PDFData {
  entries: Array<{
    id: string
    customerName: string
    claimNumber: string
    originalAmount: number
    supplementAmount: number
    finalAmount: number
    weekStartDate: Date
    notes: string | null
    createdAt: Date
    user: {
      id: string
      name: string | null
      email: string
    }
  }>
  totals: {
    totalOriginal: number
    totalSupplement: number
    totalFinal: number
  }
  userName: string
  weekStart: Date | null
}

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str
}

async function generateSupplementPDF(data: PDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Page dimensions (Letter size)
  const pageWidth = 612
  const pageHeight = 792
  const margin = 50

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Helper to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (y - neededHeight < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // Red color for accents
  const redColor = rgb(0.86, 0.15, 0.15)
  const blackColor = rgb(0, 0, 0)
  const grayColor = rgb(0.4, 0.4, 0.4)

  // Load and embed logo
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    const logoBytes = fs.readFileSync(logoPath)
    const logoImage = await pdfDoc.embedPng(logoBytes)
    
    // Scale logo to fit (max width 150, maintain aspect ratio)
    const logoMaxWidth = 150
    const logoMaxHeight = 60
    const logoScale = Math.min(logoMaxWidth / logoImage.width, logoMaxHeight / logoImage.height)
    const logoWidth = logoImage.width * logoScale
    const logoHeight = logoImage.height * logoScale
    
    // Draw logo at top left
    page.drawImage(logoImage, {
      x: margin,
      y: y - logoHeight + 10,
      width: logoWidth,
      height: logoHeight,
    })
    
    // Draw title next to logo
    page.drawText('Supplement Tracker Report', {
      x: margin + logoWidth + 15,
      y: y - 15,
      size: 20,
      font: helveticaBold,
      color: redColor,
    })
    y -= Math.max(logoHeight, 30) + 10
  } catch {
    // If logo fails to load, just draw the title
    page.drawText('Supplement Tracker Report', {
      x: margin,
      y,
      size: 20,
      font: helveticaBold,
      color: redColor,
    })
    y -= 30
  }

  // Report info
  page.drawText(`Generated by: ${data.userName}`, { x: margin, y, size: 12, font: helvetica, color: blackColor })
  y -= 18
  page.drawText(`Date: ${format(new Date(), 'MMM d, yyyy')}`, { x: margin, y, size: 12, font: helvetica, color: blackColor })
  y -= 18

  if (data.weekStart) {
    const weekEnd = endOfWeek(data.weekStart, { weekStartsOn: 1 })
    page.drawText(`Week: ${format(data.weekStart, 'MMM d, yyyy')} - ${format(weekEnd, 'MMM d, yyyy')}`, {
      x: margin,
      y,
      size: 12,
      font: helvetica,
      color: blackColor,
    })
    y -= 18
  }

  page.drawText(`Total Entries: ${data.entries.length}`, { x: margin, y, size: 12, font: helvetica, color: blackColor })
  y -= 30

  // Summary Section
  page.drawText('Summary Totals', { x: margin, y, size: 16, font: helveticaBold, color: redColor })
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 120, y }, thickness: 1, color: redColor })
  y -= 20

  page.drawText(`Total Original Amount: ${formatCurrency(data.totals.totalOriginal)}`, {
    x: margin + 20,
    y,
    size: 11,
    font: helvetica,
    color: blackColor,
  })
  y -= 16
  page.drawText(`Total Actual Supplement: ${formatCurrency(data.totals.totalSupplement)}`, {
    x: margin + 20,
    y,
    size: 11,
    font: helvetica,
    color: blackColor,
  })
  y -= 16
  page.drawText(`Total After Supplement: ${formatCurrency(data.totals.totalFinal)}`, {
    x: margin + 20,
    y,
    size: 11,
    font: helveticaBold,
    color: redColor,
  })
  y -= 30

  // Entries Table
  page.drawText('Supplement Entries', { x: margin, y, size: 16, font: helveticaBold, color: redColor })
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 140, y }, thickness: 1, color: redColor })
  y -= 20

  // Table header
  const colX = {
    customer: margin,
    claim: margin + 110,
    original: margin + 200,
    supplement: margin + 280,
    final: margin + 370,
    date: margin + 460,
  }

  page.drawText('Customer', { x: colX.customer, y, size: 9, font: helveticaBold, color: blackColor })
  page.drawText('Claim #', { x: colX.claim, y, size: 9, font: helveticaBold, color: blackColor })
  page.drawText('Original', { x: colX.original, y, size: 9, font: helveticaBold, color: blackColor })
  page.drawText('Actual Supp.', { x: colX.supplement, y, size: 9, font: helveticaBold, color: blackColor })
  page.drawText('After Supp.', { x: colX.final, y, size: 9, font: helveticaBold, color: blackColor })
  page.drawText('Date', { x: colX.date, y, size: 9, font: helveticaBold, color: blackColor })
  y -= 5

  // Header line
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: grayColor })
  y -= 15

  // Entries rows
  for (const entry of data.entries) {
    checkPageBreak(20)

    page.drawText(truncate(entry.customerName, 18), { x: colX.customer, y, size: 8, font: helvetica, color: blackColor })
    page.drawText(truncate(entry.claimNumber, 12), { x: colX.claim, y, size: 8, font: helvetica, color: blackColor })
    page.drawText(formatCurrency(entry.originalAmount), { x: colX.original, y, size: 8, font: helvetica, color: blackColor })
    page.drawText(formatCurrency(entry.supplementAmount), { x: colX.supplement, y, size: 8, font: helvetica, color: blackColor })
    page.drawText(formatCurrency(entry.finalAmount), { x: colX.final, y, size: 8, font: helvetica, color: blackColor })
    page.drawText(format(new Date(entry.createdAt), 'MM/dd/yy'), { x: colX.date, y, size: 8, font: helvetica, color: blackColor })

    y -= 5
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.25, color: grayColor })
    y -= 15
  }

  // Footer on all pages
  const pages = pdfDoc.getPages()
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length} | Generated by Manny's ToolBox`, {
      x: margin,
      y: 20,
      size: 8,
      font: helvetica,
      color: grayColor,
    })
  })

  return pdfDoc.save()
}

// PDF report generation for estimate comparisons
import PDFDocument from 'pdfkit'
import type { ComparisonResult } from '@/types/estimate-comparison'

interface ExportData {
  clientName: string
  claimNumber: string
  comparisonResult: ComparisonResult
  notes?: string
  showSideBySide?: boolean
  showHighlighted?: boolean
}

/**
 * Generate PDF report for estimate comparison
 */
export async function generateComparisonPDF(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'LETTER',
      })

      const buffers: Buffer[] = []
      let pageCount = 0
      
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer)
      })
      doc.on('error', reject)
      doc.on('pageAdded', () => {
        pageCount++
      })

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#dc2626') // Red color
        .text('Estimate Comparison Report', { align: 'center' })
        .moveDown(0.5)

      // Client Information
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#000000')
        .text(`Client: ${data.clientName}`, { align: 'left' })
        .text(`Claim Number: ${data.claimNumber}`, { align: 'left' })
        .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'left' })
        .moveDown(1)

      // Summary Section
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#dc2626')
        .text('Summary of Discrepancies', { underline: true })
        .moveDown(0.5)

      const summary = data.comparisonResult.summary
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#000000')
        .text(`Total Cost Difference: $${Math.abs(summary.totalCostDifference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
          indent: 20,
        })
        .text(`Missing Items: ${summary.missingItemsCount}`, { indent: 20 })
        .text(`Discrepancies: ${summary.discrepanciesCount}`, { indent: 20 })
        .fillColor('#dc2626') // Set color for critical issues
        .text(`Critical Issues: ${summary.criticalIssues}`, { indent: 20 })
        .fillColor('#000000') // Reset to black
        .text(`Minor Issues: ${summary.minorIssues}`, { indent: 20 })
        .moveDown(1)

      // Missing Items Section
      if (data.comparisonResult.missingItems.length > 0) {
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#dc2626')
          .text('Missing Items', { underline: true })
          .moveDown(0.5)

        // Table header
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#000000')
          .text('Item', 50, doc.y, { width: 250 })
          .text('Qty', 300, doc.y, { width: 60 })
          .text('Unit Price', 360, doc.y, { width: 80 })
          .text('Total', 440, doc.y, { width: 80 })
          .text('Priority', 520, doc.y, { width: 60 })

        let yPos = doc.y + 15
        doc.moveTo(50, yPos).lineTo(580, yPos).stroke()

        // Missing items rows
        data.comparisonResult.missingItems.forEach((item, index) => {
          if (doc.y > 700) {
            doc.addPage()
            yPos = 50
          }

          yPos = doc.y + 10
          const priorityColor = item.priority === 'critical' ? '#dc2626' : '#f59e0b'

          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#000000')
            .text(item.item.substring(0, 40) + (item.item.length > 40 ? '...' : ''), 50, yPos, { width: 250 })
            .text(item.quantity.toString(), 300, yPos, { width: 60 })
            .text(`$${item.unitPrice.toFixed(2)}`, 360, yPos, { width: 80 })
            .text(`$${item.totalPrice.toFixed(2)}`, 440, yPos, { width: 80 })
            .fillColor(priorityColor)
            .font('Helvetica-Bold')
            .text(item.priority.toUpperCase(), 520, yPos, { width: 60 })

          yPos += 15
          doc.moveTo(50, yPos).lineTo(580, yPos).stroke()
        })

        doc.moveDown(1)
      }

      // Discrepancies Section
      if (data.comparisonResult.discrepancies.length > 0) {
        // Check if we need a new page
        if (doc.y > 600) {
          doc.addPage()
        }

        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#dc2626')
          .text('Discrepancies', { underline: true })
          .moveDown(0.5)

        data.comparisonResult.discrepancies.forEach((disc, index) => {
          // Check if we need a new page
          if (doc.y > 700) {
            doc.addPage()
          }

          const priorityColor = disc.priority === 'critical' ? '#dc2626' : '#f59e0b'
          const bgColor = disc.priority === 'critical' ? '#fee2e2' : '#fef3c7'

          // Discrepancy box
          const boxY = doc.y
          doc
            .save()
            .rect(50, boxY, 530, 60)
            .fillColor(bgColor)
            .fill()
            .strokeColor(priorityColor)
            .lineWidth(1)
            .stroke()
            .restore()

          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(disc.item, 60, boxY + 5, { width: 510 })

          doc
            .fontSize(9)
            .font('Helvetica')
            .text(`Type: ${disc.type}`, 60, boxY + 20, { width: 170 })
            .text(`Adjuster: ${disc.adjusterValue}`, 230, boxY + 20, { width: 150 })
            .text(`Contractor: ${disc.contractorValue}`, 380, boxY + 20, { width: 150 })

          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor(priorityColor)
            .text(
              `Difference: ${disc.difference} (${disc.differencePercent > 0 ? '+' : ''}${disc.differencePercent.toFixed(1)}%)`,
              60,
              boxY + 35,
              { width: 250 }
            )
            .fillColor(priorityColor)
            .text(`Priority: ${disc.priority.toUpperCase()}`, 400, boxY + 35, { width: 150 })

          doc.y = boxY + 70
          doc.moveDown(0.3)
        })
      }

      // Notes Section
      if (data.notes && data.notes.trim().length > 0) {
        if (doc.y > 650) {
          doc.addPage()
        }

        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#dc2626')
          .text('Notes/Comments', { underline: true })
          .moveDown(0.5)

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#000000')
          .text(data.notes, {
            align: 'left',
            width: 530,
            indent: 20,
          })
          .moveDown(1)
      }


      // Add footer function that will be called on each page
      const addFooter = () => {
        const pageInfo = doc.bufferedPageRange()
        if (pageInfo) {
          const totalPages = pageInfo.count
          const currentPage = pageInfo.start + 1
          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor('#666666')
            .text(
              `Page ${currentPage} of ${totalPages} | Generated by Manny's ToolBox`,
              50,
              doc.page.height - 30,
              { align: 'center', width: 500 }
            )
        }
      }

      // Add footer to current page before ending
      addFooter()

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

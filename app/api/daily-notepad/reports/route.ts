import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeIdsForScope, isWorkday } from '@/lib/daily-notepad'
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import PDFDocument from 'pdfkit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Manager/Owner access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const formatParam = (searchParams.get('format') || 'csv').toLowerCase()
    const teamId = searchParams.get('teamId') || undefined
    const departmentId = searchParams.get('departmentId') || undefined

    const today = new Date()
    const startDate = startOfWeek(today)
    const endDate = endOfWeek(today)

    const workdays = eachDayOfInterval({ start: startDate, end: endDate }).filter(isWorkday)
    const totalWorkdays = workdays.length

    const employeeIds = await getEmployeeIdsForScope({ teamId, departmentId })
    const employees = await prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    const submissionsByUser = await prisma.dailyNotepadSubmission.groupBy({
      by: ['userId'],
      where: {
        userId: { in: employeeIds },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: { id: true },
    })

    const submittedMap = new Map(
      submissionsByUser.map((row) => [row.userId, row._count.id])
    )

    const rows = employees.map((emp) => {
      const submittedDays = submittedMap.get(emp.id) || 0
      const missingDays = Math.max(0, totalWorkdays - submittedDays)
      const compliance = totalWorkdays > 0 ? (submittedDays / totalWorkdays) * 100 : 0
      return {
        name: emp.name || '',
        email: emp.email,
        submittedDays,
        missingDays,
        compliance,
      }
    })

    if (formatParam === 'pdf') {
      const doc = new PDFDocument({ margin: 36 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))

      doc.fontSize(18).text('Daily Notepad Weekly Report', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(12).text(
        `Week of ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
        { align: 'center' }
      )
      doc.moveDown(1)

      const headers = ['Employee', 'Email', 'Submitted', 'Missing', 'Compliance']
      doc.fontSize(11).text(headers.join(' | '))
      doc.moveDown(0.5)

      rows.forEach((row) => {
        doc.text(
          `${row.name || row.email} | ${row.email} | ${row.submittedDays} | ${row.missingDays} | ${row.compliance.toFixed(1)}%`
        )
      })

      doc.end()

      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="daily-notepad-weekly-report-${format(startDate, 'yyyy-MM-dd')}.pdf"`,
        },
      })
    }

    const csvHeader = ['Name', 'Email', 'Submitted Days', 'Missing Days', 'Compliance %']
    const csvRows = rows.map((row) => [
      row.name || row.email,
      row.email,
      row.submittedDays.toString(),
      row.missingDays.toString(),
      row.compliance.toFixed(1),
    ])

    const csv = [csvHeader, ...csvRows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="daily-notepad-weekly-report-${format(startDate, 'yyyy-MM-dd')}.csv"`,
      },
    })
  } catch (error) {
    console.error('Report export error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import mammoth from 'mammoth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Check if it's a Word document
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ]
    
    const validExtensions = ['.doc', '.docx']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))
    const hasValidType = validTypes.includes(file.type) || file.type === 'application/octet-stream'

    if (!hasValidType && !hasValidExtension) {
      return NextResponse.json(
        { error: 'File must be a Word document (.doc or .docx)' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Convert Word document to HTML using mammoth
    const result = await mammoth.convertToHtml({ buffer }, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
      ],
    })

    // Get HTML content
    let html = result.value

    // Get any warnings
    const warnings = result.messages.filter(msg => msg.type === 'warning')

    // Clean up and style the HTML
    html = html
      .replace(/<p><\/p>/g, '') // Remove empty paragraphs
      .replace(/<p>/g, '<p style="margin: 0.5rem 0;">') // Add spacing to paragraphs
      .replace(/<h1>/g, '<h1 style="font-size: 2rem; font-weight: bold; margin: 1rem 0 0.5rem 0;">')
      .replace(/<h2>/g, '<h2 style="font-size: 1.5rem; font-weight: bold; margin: 0.75rem 0 0.5rem 0;">')
      .replace(/<h3>/g, '<h3 style="font-size: 1.25rem; font-weight: bold; margin: 0.5rem 0 0.25rem 0;">')
      .replace(/<ul>/g, '<ul style="margin: 0.5rem 0; padding-left: 1.5rem;">')
      .replace(/<ol>/g, '<ol style="margin: 0.5rem 0; padding-left: 1.5rem;">')
      .replace(/<li>/g, '<li style="margin: 0.25rem 0;">')
      .replace(/<strong>/g, '<strong style="font-weight: bold;">')
      .replace(/<em>/g, '<em style="font-style: italic;">')

    // Wrap in a container div
    html = `<div class="word-document-content" style="max-width: 100%;">${html}</div>`

    return NextResponse.json({
      success: true,
      html,
      warnings: warnings.map(w => w.message),
    })
  } catch (error) {
    console.error('Word conversion error:', error)
    return NextResponse.json(
      { error: 'Failed to convert Word document. Please ensure it is a valid .doc or .docx file.' },
      { status: 500 }
    )
  }
}

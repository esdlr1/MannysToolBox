import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { searchByKeyword, findByCode } from '@/lib/xactimate-lookup'

export const dynamic = 'force-dynamic'

function isOpenAIAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  const normalized = message.toLowerCase()
  return (
    normalized.includes('incorrect api key') ||
    normalized.includes('invalid_api_key') ||
    normalized.includes('openai_api_key') ||
    normalized.includes('missing api key') ||
    normalized.includes('api key') ||
    normalized.includes('format is invalid')
  )
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const fileId = typeof body.fileId === 'string' ? body.fileId : undefined

    if (!query) {
      return NextResponse.json(
        { error: 'Please describe what you\'re looking for or what it\'s used for.' },
        { status: 400 }
      )
    }

    // Early check so we can distinguish "not set" vs "invalid" and avoid confusing 401
    if (!process.env.OPENAI_API_KEY?.trim()) {
      console.error('[Whats Xact Smart Search] OPENAI_API_KEY is not set in environment')
      return NextResponse.json(
        { error: 'OpenAI API key is not set on the server. Add OPENAI_API_KEY to your environment and restart.' },
        { status: 503 }
      )
    }

    let imageDataUrl: string | undefined

    if (fileId) {
      const fileRecord = await prisma.file.findUnique({ where: { id: fileId } })
      if (!fileRecord) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
      if (fileRecord.userId !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      if (!existsSync(fileRecord.path)) {
        return NextResponse.json(
          { error: 'File not found on server. Please upload again.' },
          { status: 404 }
        )
      }
      const imageBuffer = await readFile(fileRecord.path)
      const base64Image = imageBuffer.toString('base64')
      let mimeType = fileRecord.mimeType || 'image/jpeg'
      if (!mimeType.startsWith('image/')) {
        const ext = fileRecord.originalName.split('.').pop()?.toLowerCase()
        if (ext === 'png') mimeType = 'image/png'
        else if (ext === 'gif') mimeType = 'image/gif'
        else if (ext === 'webp') mimeType = 'image/webp'
        else mimeType = 'image/jpeg'
      }
      imageDataUrl = `data:${mimeType};base64,${base64Image}`
    }

    const systemPrompt = `You are an expert in Xactimate construction estimating. The user is describing what they need or what something is used for. Your job is to suggest relevant Xactimate line item CODES and/or search KEYWORDS that would find matching items in a 13,000+ line item database.

Respond with ONLY a valid JSON object, no other text. Format:
{"keywords": ["keyword1", "keyword2", ...], "codes": ["CODE1", "CODE2", ...]}

- keywords: terms that would match Xactimate descriptions (e.g. "drywall repair", "paint", "plumbing", "cabinet", "flooring"). Use 2-8 keywords.
- codes: specific Xactimate codes if you know them (e.g. "DRYWSF", "BTF10", "PLK"). Use 0-10 codes.
If you don't know exact codes, leave "codes" as [] and rely on keywords. Be focused and relevant to what the user said.`

    const textPrompt = imageDataUrl
      ? `The user said: "${query}"\n\nThey also attached a photo. Use both the description and what you see in the photo to suggest the best Xactimate keywords and/or codes for the work or items shown.`
      : `The user said: "${query}"\n\nSuggest the best Xactimate keywords and/or codes that match what they're looking for.`

    const aiResponse = await callAI({
      prompt: textPrompt,
      systemPrompt,
      imageUrl: imageDataUrl,
      temperature: 0.3,
      maxTokens: 800,
    })

    if (aiResponse.error) {
      console.error('[Whats Xact Smart Search] OpenAI error:', aiResponse.error)
      if (isOpenAIAuthError(aiResponse.error)) {
        return NextResponse.json(
          { error: 'OpenAI API key is missing or invalid. Set OPENAI_API_KEY and restart the server.' },
          { status: 503 }
        )
      }
      throw new Error(aiResponse.error)
    }

    let parsed: { keywords?: string[]; codes?: string[] }
    try {
      const cleaned = aiResponse.result.trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      parsed = { keywords: [query], codes: [] }
    }

    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [query]
    const codes = Array.isArray(parsed.codes) ? parsed.codes : []

    const seen = new Set<string>()
    const results: Array<{ code: string; description: string; category: string; unit: string }> = []

    for (const code of codes) {
      const c = code?.toString().trim().toUpperCase()
      if (!c || seen.has(c)) continue
      const item = findByCode(c)
      if (item) {
        seen.add(c)
        results.push({
          code: item.code,
          description: item.description,
          category: item.category || 'Unknown',
          unit: item.unit || '',
        })
      }
    }

    for (const kw of keywords) {
      const term = kw?.toString().trim()
      if (!term) continue
      const matches = searchByKeyword(term, 8)
      for (const item of matches) {
        if (seen.has(item.code)) continue
        seen.add(item.code)
        results.push({
          code: item.code,
          description: item.description,
          category: item.category || 'Unknown',
          unit: item.unit || '',
        })
      }
    }

    return NextResponse.json({
      query,
      usedImage: !!fileId,
      results: results.slice(0, 30),
      count: results.length,
    })
  } catch (error: any) {
    console.error('[Whats Xact Smart Search] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    )
  }
}

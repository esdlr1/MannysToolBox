import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchByKeyword, findByCode } from '@/lib/xactimate-lookup'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await request.json()

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const searchQuery = query.trim()
    
    // Search the Xactimate database
    const results = searchByKeyword(searchQuery, 20) // Get top 20 matches
    
    // If query looks like a code, also try direct lookup
    let codeMatch = null
    if (searchQuery.length <= 10 && /^[A-Z0-9\-+]+$/i.test(searchQuery)) {
      codeMatch = findByCode(searchQuery.toUpperCase())
    }

    // Format results
    const formattedResults = results.map(item => ({
      code: item.code,
      description: item.description,
      category: item.category || 'Unknown',
      unit: item.unit || '',
    }))

    // If code match found and not already in results, add it at the top
    if (codeMatch && !formattedResults.find(r => r.code === codeMatch!.code)) {
      formattedResults.unshift({
        code: codeMatch.code,
        description: codeMatch.description,
        category: codeMatch.category || 'Unknown',
        unit: codeMatch.unit || '',
      })
    }

    return NextResponse.json({
      query: searchQuery,
      results: formattedResults,
      count: formattedResults.length,
    })
  } catch (error: any) {
    console.error('[Whats Xact Photo Search] Error:', error)
    return NextResponse.json(
      { error: 'Failed to search Xactimate database', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

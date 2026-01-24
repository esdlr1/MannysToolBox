import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as lineItemsService from '@/lib/line-items-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/line-items
 * Search and retrieve line items from the database
 * 
 * Query parameters:
 * - search: keyword to search for (searches code and description)
 * - code: exact code to find
 * - description: description to find (exact or partial)
 * - category: filter by category
 * - limit: max results (default: 50)
 * - exact: if true, only exact matches for description (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const code = searchParams.get('code')
    const description = searchParams.get('description')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const exact = searchParams.get('exact') === 'true'

    let results: lineItemsService.LineItem[] = []

    if (code) {
      // Find by exact code
      const item = lineItemsService.findByCode(code)
      if (item) {
        results = [item]
      }
    } else if (description) {
      // Find by description
      results = lineItemsService.findByDescription(description, exact)
    } else if (search) {
      // Search by keyword
      results = lineItemsService.searchByKeyword(search, limit)
    } else if (category) {
      // Get by category
      results = lineItemsService.getByCategory(category)
    } else {
      // Return statistics if no search params
      const stats = lineItemsService.getStatistics()
      return NextResponse.json({
        success: true,
        statistics: stats,
        categories: lineItemsService.getAllCategories(),
      })
    }

    // Filter by category if specified
    if (category && results.length > 0) {
      results = results.filter(item => 
        item.category?.toUpperCase() === category.toUpperCase()
      )
    }

    // Limit results
    if (limit > 0) {
      results = results.slice(0, limit)
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      items: results,
    })
  } catch (error) {
    console.error('Line items API error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve line items' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/line-items
 * Check if line items exist or find similar items
 * 
 * Body:
 * - items: Array of { code?: string, description?: string }
 * - findSimilar: if true, find similar items (default: false)
 * - threshold: similarity threshold for findSimilar (0-1, default: 0.6)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { items, findSimilar, threshold } = await request.json()

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      )
    }

    const results = items.map((item: { code?: string; description?: string }) => {
      const exists = lineItemsService.itemExists(item.code, item.description)
      let similar: lineItemsService.LineItem[] = []

      if (findSimilar && item.description) {
        similar = lineItemsService.findSimilar(item.description, threshold || 0.6)
      }

      return {
        item,
        exists,
        matches: exists ? lineItemsService.findByCode(item.code || '') || 
                          lineItemsService.findByDescription(item.description || '') : [],
        similar: similar.slice(0, 5), // Top 5 similar items
      }
    })

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error('Line items check error:', error)
    return NextResponse.json(
      { error: 'Failed to check line items' },
      { status: 500 }
    )
  }
}

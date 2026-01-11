import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToolBySubdomain } from '@/lib/tools'

// Extract subdomain from hostname
function getSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0]
  
  // In development, handle localhost
  if (host === 'localhost' || host === '127.0.0.1') {
    // For local development, check for subdomain pattern like tool1.localhost
    const parts = host.split('.')
    if (parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      return parts[0]
    }
    return null
  }
  
  // In production, extract subdomain
  const parts = host.split('.')
  if (parts.length >= 3) {
    const subdomain = parts[0]
    // Ignore 'www' as it's the main domain
    if (subdomain !== 'www' && subdomain !== 'mannystoolbox') {
      return subdomain
    }
  }
  
  return null
}

// Main middleware function
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const subdomain = getSubdomain(hostname)
  const pathname = request.nextUrl.pathname

  // Handle subdomain routing
  if (subdomain) {
    const tool = getToolBySubdomain(subdomain)
    
    if (tool) {
      // Tool subdomain detected - route to tool page
      // If accessing root of subdomain, show the tool
      if (pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = `/tools/${tool.id}`
        return NextResponse.rewrite(url)
      }
      
      // If accessing /tools/[toolId], verify it matches the subdomain
      if (pathname.startsWith('/tools/')) {
        const toolId = pathname.split('/')[2]
        if (toolId === tool.id) {
          // Valid subdomain-tool match, allow through
          return NextResponse.next()
        }
      }
    } else {
      // Unknown subdomain - could redirect to main or show 404
      // For now, allow through (you might want to handle this differently)
    }
  }

  // Handle authentication for protected routes (only on main domain)
  // For now, authentication is handled in the route components themselves
  // The middleware just handles subdomain routing
  // Protected routes will check auth in the page/component using getServerSession
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

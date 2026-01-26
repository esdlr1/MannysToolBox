import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getToolById, getToolBySubdomain } from '@/lib/tools'
import { ToolRenderer } from '@/components/ToolRenderer'

// Extract subdomain from headers
function getSubdomainFromHeaders(): string | null {
  const headersList = headers()
  const hostname = headersList.get('host') || ''
  const host = hostname.split(':')[0]

  if (host === 'localhost' || host === '127.0.0.1') {
    const subdomainMatch = host.match(/^([^.]+)\.localhost/)
    return subdomainMatch ? subdomainMatch[1] : null
  }
  const parts = host.split('.')
  if (parts.length >= 3) {
    const sub = parts[0]
    if (sub !== 'www' && sub !== 'mannystoolbox') return sub
  }
  return null
}

// When on a tool subdomain, "/" is rewritten back to the tool — use main site URL instead
function getBackToHomeHref(): string {
  const headersList = headers()
  const hostHeader = headersList.get('host') || ''
  const [hostname, portPart] = hostHeader.split(':')
  const port = portPart || ''

  const isToolSubdomain =
    hostname.endsWith('.localhost') ||
    (hostname.split('.').length >= 3 &&
      !['www', 'mannystoolbox'].includes(hostname.split('.')[0]))

  if (!isToolSubdomain) return '/'

  if (hostname.endsWith('.localhost')) {
    return `http://localhost${port ? ':' + port : ''}/`
  }
  const proto = headersList.get('x-forwarded-proto') || 'https'
  const base = hostname.split('.').slice(-2).join('.')
  return `${proto}://${base}/`
}

export default async function ToolPage({
  params,
}: {
  params: { toolId: string }
}) {
  // Try to get tool by subdomain first (if accessed via subdomain)
  const subdomain = getSubdomainFromHeaders()
  let tool = subdomain ? getToolBySubdomain(subdomain) : null
  
  // Fall back to toolId if no subdomain match
  if (!tool) {
    tool = getToolById(params.toolId)
  }

  if (!tool) {
    notFound()
  }

  // Verify subdomain matches tool if accessed via subdomain
  if (subdomain && tool.subdomain !== subdomain) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <Link
            href={getBackToHomeHref()}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>
        <ToolRenderer toolId={tool.id} />
      </div>
    </div>
  )
}


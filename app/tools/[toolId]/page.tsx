import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getToolById, getToolBySubdomain } from '@/lib/tools'
import { ToolRenderer } from '@/components/ToolRenderer'

// Extract subdomain from headers
function getSubdomainFromHeaders(): string | null {
  const headersList = headers()
  const hostname = headersList.get('host') || ''
  
  // Remove port if present
  const host = hostname.split(':')[0]
  
  // Handle localhost development
  if (host === 'localhost' || host === '127.0.0.1') {
    const subdomainMatch = host.match(/^([^.]+)\.localhost/)
    if (subdomainMatch) {
      return subdomainMatch[1]
    }
    return null
  }
  
  // Production: extract subdomain
  const parts = host.split('.')
  if (parts.length >= 3) {
    const subdomain = parts[0]
    if (subdomain !== 'www' && subdomain !== 'mannystoolbox') {
      return subdomain
    }
  }
  
  return null
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
          {tool.name}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          {tool.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {tool.usesAI && (
            <span className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
              AI Powered
            </span>
          )}
          {tool.supportsFileUpload && (
            <span className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
              File Upload Supported
            </span>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <ToolRenderer toolId={tool.id} />
      </div>
    </div>
  )
}


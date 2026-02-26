'use client'

import { getToolById } from '@/lib/tools'
import dynamic from 'next/dynamic'

interface ToolRendererProps {
  toolId: string
}

// Dynamically import tool components at module level
// Using Next.js dynamic() ensures proper code splitting and module resolution
// Note: Next.js auto-resolves index files, so we don't need /index
const EstimateComparisonTool = dynamic(
  () => import('@/tools/estimate-comparison'),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false 
  }
)

const EstimateAuditTool = dynamic(
  () => import('@/tools/estimate-audit'),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false
  }
)

const DailyNotepadTool = dynamic(
  () => import('@/tools/daily-notepad'),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false 
  }
)

const WhatsXactPhotoTool = dynamic(
  () => import('@/tools/whats-xact-photo'),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false 
  }
)

const PhotoXactTool = dynamic(
  () => import('@/tools/photoxact'),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false 
  }
)

const SupplementTrackerTool = dynamic(
  () => import('@/tools/supplement-tracker'),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false 
  }
)

const ContentsInvTool = dynamic(
  () => import('@/tools/contents-inv'),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false 
  }
)

const EstimateDiaryTool = dynamic(
  () => import('@/tools/estimate-diary'),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    ),
    ssr: false 
  }
)

// Tool component registry
const toolComponents: Record<string, React.ComponentType> = {
  'estimate-comparison': EstimateComparisonTool,
  'estimate-audit': EstimateAuditTool,
  'daily-notepad': DailyNotepadTool,
  'whats-xact-photo': WhatsXactPhotoTool,
  'photoxact': PhotoXactTool,
  'supplement-tracker': SupplementTrackerTool,
  'contents-inv': ContentsInvTool,
  'estimate-diary': EstimateDiaryTool,
}

export function ToolRenderer({ toolId }: ToolRendererProps) {
  const tool = getToolById(toolId)
  
  if (!tool) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-2">
          Tool &quot;{toolId}&quot; not found.
        </p>
      </div>
    )
  }

  const ToolComponent = toolComponents[toolId]
  
  if (!ToolComponent) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-2">
          Tool component not found or not yet implemented.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tool ID: {toolId}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Available tools: {Object.keys(toolComponents).join(', ') || 'none'}
        </p>
      </div>
    )
  }

  return <ToolComponent />
}

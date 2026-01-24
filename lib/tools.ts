import { Tool } from '@/types/tool'

// Tool registry - add new tools here
// Initialize with tools directly to avoid module initialization issues
const tools: Tool[] = [
  {
    id: 'estimate-audit',
    name: 'Estimate Completeness Audit',
    description: 'Analyze a single construction estimate to detect missing line items that should accompany each other (e.g., drywall + texture + paint).',
    category: 'Construction',
    subdomain: 'estimate-audit',
    component: 'tools/estimate-audit/index',
    requiresAuth: true,
    usesAI: true,
    supportsFileUpload: true,
  },
  {
    id: 'estimate-comparison',
    name: 'Estimate Comparison Tool',
    description: 'Compare construction estimates from insurance adjusters and contractors. Identify missing items, discrepancies, and cost differences using AI.',
    category: 'Construction',
    subdomain: 'estimate-comparison',
    component: 'tools/estimate-comparison/index',
    requiresAuth: true,
    usesAI: true,
    supportsFileUpload: true,
  },
  {
    id: 'daily-notepad',
    name: 'Daily Yellow Notepad',
    description: 'Submit daily notepad photos for tracking. Employees upload their daily planner photos by 9 AM. Managers can view all submissions and send reminders.',
    category: 'Productivity',
    subdomain: 'daily-notepad',
    component: 'tools/daily-notepad/index',
    requiresAuth: true,
    usesAI: false,
    supportsFileUpload: true,
  },
  {
    id: 'whats-xact-photo',
    name: 'Whats Xact - Photo',
    description: 'Upload a photo of a construction site or damage. AI will identify all visible line items with Xactimate codes, descriptions, and estimated quantities.',
    category: 'Construction',
    subdomain: 'whats-xact-photo',
    component: 'tools/whats-xact-photo/index',
    requiresAuth: true,
    usesAI: true,
    supportsFileUpload: true,
  },
]

// Helper function to ensure tool properties
function normalizeTool(tool: Tool): Tool {
  return {
    ...tool,
    category: tool.category || 'Uncategorized',
    subdomain: tool.subdomain || tool.id,
  }
}

// Export registerTool function for dynamic tool registration (if needed in the future)
export function registerTool(tool: Tool): void {
  const normalizedTool = normalizeTool(tool)
  
  // Check if tool already exists
  const existingIndex = tools.findIndex(t => t.id === normalizedTool.id)
  if (existingIndex >= 0) {
    tools[existingIndex] = normalizedTool
  } else {
    tools.push(normalizedTool)
  }
}

export function getTools(): Tool[] {
  return tools
}

export function getToolsByCategory(): Record<string, Tool[]> {
  const categorized: Record<string, Tool[]> = {}
  
  tools.forEach(tool => {
    const category = tool.category || 'Uncategorized'
    if (!categorized[category]) {
      categorized[category] = []
    }
    categorized[category].push(tool)
  })
  
  return categorized
}

export function getCategories(): string[] {
  const categories = new Set(tools.map(tool => tool.category || 'Uncategorized'))
  return Array.from(categories).sort()
}

export function getToolById(id: string): Tool | undefined {
  return tools.find(tool => tool.id === id)
}

export function getToolBySubdomain(subdomain: string): Tool | undefined {
  return tools.find(tool => tool.subdomain === subdomain)
}

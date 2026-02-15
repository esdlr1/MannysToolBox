export interface Tool {
  id: string
  name: string
  description: string
  component?: string // Path to component file
  category: string
  subdomain: string // Subdomain for this tool (e.g., "tool1" for tool1.mannystoolbox.com)
  requiresAuth?: boolean
  usesAI?: boolean
  supportsFileUpload?: boolean
  icon?: string
  /** When false, tool is hidden from pickers and direct access returns 404. Default true. */
  enabled?: boolean
}

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Search, Sparkles } from 'lucide-react'
import { Tool } from '@/types/tool'

// Get tool URL based on environment
function getToolUrl(toolSubdomain: string, toolId?: string): string {
  if (typeof window === 'undefined') return '#'
  
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const port = window.location.port ? `:${window.location.port}` : ''
  
  // Development: use direct path instead of subdomain (easier for local testing)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return toolId ? `${protocol}//${hostname}${port}/tools/${toolId}` : `${protocol}//${hostname}${port}/tools/${toolSubdomain}`
  }
  
  // Production: use subdomain.mannystoolbox.com
  return `${protocol}//${toolSubdomain}.mannystoolbox.com`
}

interface ToolDropdownProps {
  tools: Tool[]
  placeholder?: string
}

export function ToolDropdown({ tools, placeholder = 'Pick your tool' }: ToolDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredTools, setFilteredTools] = useState<Tool[]>(tools)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter tools based on search query
  useEffect(() => {
    if (searchQuery === '') {
      setFilteredTools(tools)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredTools(
        tools.filter(
          (tool) =>
            tool.name.toLowerCase().includes(query) ||
            tool.description.toLowerCase().includes(query) ||
            tool.category.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, tools])

  // Group tools by category
  const toolsByCategory = filteredTools.reduce((acc, tool) => {
    const category = tool.category || 'Uncategorized'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(tool)
    return acc
  }, {} as Record<string, Tool[]>)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelect = (tool: Tool) => {
    setSelected(tool.name)
    setIsOpen(false)
    setSearchQuery('')
    const toolUrl = getToolUrl(tool.subdomain || tool.id, tool.id)
    window.location.href = toolUrl
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredTools.length > 0) {
      handleSelect(filteredTools[0])
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative w-full max-w-2xl z-50" ref={dropdownRef}>
      {/* Dropdown Button */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 rounded-full border-2 transition-all duration-300 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:border-red-500 dark:hover:border-red-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 flex items-center justify-between group shadow-lg"
      >
        <div className="flex items-center flex-1">
          <Search className="w-5 h-5 mr-3 text-gray-400 dark:text-gray-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
          <span className="font-medium text-left flex-1">
            {selected || placeholder}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
        </motion.div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute w-full mt-2 rounded-2xl border-2 shadow-2xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 z-50 flex flex-col overflow-hidden"
            style={{
              maxHeight: 'min(70vh, 420px)',
              top: '100%',
              marginTop: '0.5rem',
            }}
          >
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search tools..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600"
                  autoFocus
                />
              </div>
            </div>

            {/* Tools List - Scrollable (min-h-0 allows flex child to shrink and show scrollbar) */}
            <div 
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {Object.keys(toolsByCategory).length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <p>No tools found matching &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                Object.entries(toolsByCategory).map(([category, categoryTools], categoryIndex) => (
                  <div key={category}>
                    {/* Category Header */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: categoryIndex * 0.05 }}
                      className="px-4 py-1 text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                    >
                      {category}
                    </motion.div>

                    {/* Category Tools */}
                    {categoryTools.map((tool, index) => (
                      <motion.button
                        key={tool.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: (categoryIndex * 0.05) + (index * 0.03) }}
                        onClick={() => handleSelect(tool)}
                        className="w-full px-4 py-2.5 text-left transition-colors duration-200 hover:bg-red-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-between group border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{tool.name}</span>
                            {tool.usesAI && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex-shrink-0"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                AI
                              </motion.span>
                            )}
                            {tool.supportsFileUpload && (
                              <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full flex-shrink-0">
                                Files
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 line-clamp-1">
                            {tool.description}
                          </div>
                        </div>
                        {selected === tool.name && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="ml-3 flex-shrink-0"
                          >
                            <Check className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

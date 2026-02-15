'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, X, GripVertical } from 'lucide-react'
import { Tool } from '@/types/tool'
import { getTools, getToolById } from '@/lib/tools'

function getToolUrl(toolSubdomain: string, toolId?: string): string {
  if (typeof window === 'undefined') return '#'
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const port = window.location.port ? `:${window.location.port}` : ''
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return toolId
      ? `${protocol}//${hostname}${port}/tools/${toolId}`
      : `${protocol}//${hostname}${port}/tools/${toolSubdomain}`
  }
  return `${protocol}//${toolSubdomain}.mannystoolbox.com`
}

export function ToolShortcuts() {
  const [shortcutIds, setShortcutIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dragJustEndedRef = useRef(false)
  const tools = getTools()

  useEffect(() => {
    let cancelled = false
    async function fetchShortcuts() {
      try {
        const res = await fetch('/api/user/tool-shortcuts')
        if (!res.ok || cancelled) return
        const data = await res.json()
        setShortcutIds(data.toolShortcuts ?? [])
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchShortcuts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const shortcuts = shortcutIds
    .map((id) => getToolById(id))
    .filter((t): t is Tool => t != null)

  const canAdd = shortcutIds.length < 4
  const availableToAdd = tools.filter((t) => !shortcutIds.includes(t.id))

  const addShortcut = async (toolId: string) => {
    const next = [...shortcutIds, toolId].slice(0, 4)
    setShortcutIds(next)
    setPickerOpen(false)
    try {
      await fetch('/api/user/tool-shortcuts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolShortcuts: next }),
      })
    } catch {
      setShortcutIds(shortcutIds)
    }
  }

  const removeShortcut = async (toolId: string) => {
    const next = shortcutIds.filter((id) => id !== toolId)
    setShortcutIds(next)
    try {
      await fetch('/api/user/tool-shortcuts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolShortcuts: next }),
      })
    } catch {
      setShortcutIds(shortcutIds)
    }
  }

  const reorderShortcuts = async (draggedId: string, dropTargetId: string) => {
    const fromIndex = shortcutIds.indexOf(draggedId)
    const toIndex = shortcutIds.indexOf(dropTargetId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    const next = [...shortcutIds]
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, draggedId)
    setShortcutIds(next)
    setDraggingId(null)
    try {
      await fetch('/api/user/tool-shortcuts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolShortcuts: next }),
      })
    } catch {
      setShortcutIds(shortcutIds)
    }
  }

  const handleDragStart = (e: React.DragEvent, toolId: string) => {
    setDraggingId(toolId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', toolId)
    e.dataTransfer.setData('application/json', JSON.stringify({ toolId }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId && draggedId !== dropTargetId) {
      reorderShortcuts(draggedId, dropTargetId)
    } else {
      setDraggingId(null)
    }
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    dragJustEndedRef.current = true
    setTimeout(() => { dragJustEndedRef.current = false }, 100)
  }

  if (loading) {
    return (
      <div className="flex justify-center mb-6 min-h-[52px] items-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading shortcuts…</span>
      </div>
    )
  }

  const patternSvg = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`

  return (
    <div className="flex flex-wrap justify-center items-stretch gap-3 mb-6 px-2">
      {shortcuts.map((tool) => {
        const href = getToolUrl(tool.subdomain ?? tool.id, tool.id)
        const isDragging = draggingId === tool.id
        return (
          <div
            key={tool.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tool.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tool.id)}
            onDragEnd={handleDragEnd}
            className={`group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 min-w-[140px] flex-1 max-w-[180px] bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 dark:from-slate-600 dark:via-slate-700 dark:to-slate-800 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-60 scale-95' : ''}`}
          >
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: patternSvg }} />
            <div className="relative z-10 p-4 flex flex-col h-full min-h-[88px]">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 text-white/60 mt-0.5 touch-none" aria-hidden>
                  <GripVertical className="w-4 h-4" />
                </span>
                <Link
                  href={href}
                  className="flex-1 text-sm font-bold text-white group-hover:text-white/95 line-clamp-2 min-w-0"
                  onClick={(e) => { if (dragJustEndedRef.current) e.preventDefault() }}
                >
                  {tool.name}
                </Link>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeShortcut(tool.id) }}
                className="self-end mt-2 p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                aria-label={`Remove ${tool.name} shortcut`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
      {canAdd && (
        <div className="relative min-w-[140px] flex-1 max-w-[180px]" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="w-full h-full min-h-[88px] group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 dark:from-slate-500 dark:via-slate-600 dark:to-slate-700 border-2 border-dashed border-white/30"
          >
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: patternSvg }} />
            <div className="relative z-10 p-4 flex flex-col items-center justify-center gap-1">
              <Plus className="w-8 h-8 text-white" />
              <span className="text-sm font-bold text-white">Add Shortcuts +</span>
            </div>
          </button>
          {pickerOpen && availableToAdd.length > 0 && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] min-w-[200px] max-h-[280px] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
              {availableToAdd.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => addShortcut(tool.id)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {tool.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

type RoleView = 'Employee' | 'Manager' | 'Owner' | 'Super Admin' | null

interface RoleViewContextType {
  viewAsRole: RoleView
  setViewAsRole: (role: RoleView) => void
  effectiveRole: string | null | undefined
  isViewingAs: boolean
}

const RoleViewContext = createContext<RoleViewContextType | undefined>(undefined)

const STORAGE_KEY = 'super_admin_view_as_role'

export function RoleViewProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [viewAsRole, setViewAsRoleState] = useState<RoleView>(null)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && ['Employee', 'Manager', 'Owner', 'Super Admin'].includes(stored)) {
        setViewAsRoleState(stored as RoleView)
      }
    }
  }, [])

  // Clear view-as role if user is no longer Super Admin
  useEffect(() => {
    if (session?.user?.role !== 'Super Admin' && viewAsRole !== null) {
      setViewAsRoleState(null)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [session?.user?.role, viewAsRole])

  const setViewAsRole = (role: RoleView) => {
    setViewAsRoleState(role)
    if (typeof window !== 'undefined') {
      if (role) {
        localStorage.setItem(STORAGE_KEY, role)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }

  // Only allow role switching if user is actually Super Admin
  const isViewingAs = session?.user?.role === 'Super Admin' && viewAsRole !== null
  const effectiveRole = isViewingAs ? viewAsRole : session?.user?.role

  return (
    <RoleViewContext.Provider
      value={{
        viewAsRole,
        setViewAsRole,
        effectiveRole,
        isViewingAs,
      }}
    >
      {children}
    </RoleViewContext.Provider>
  )
}

export function useRoleView() {
  const context = useContext(RoleViewContext)
  if (context === undefined) {
    throw new Error('useRoleView must be used within a RoleViewProvider')
  }
  return context
}

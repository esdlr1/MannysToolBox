import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwnerOrSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export interface HierarchyUser {
  id: string
  name: string | null
  email: string
  role: string | null
  children: HierarchyUser[]
}

/**
 * GET - Returns the reporting hierarchy as a tree.
 * Roots = users who are never assigned as "employee" (no one is their manager).
 * Each node's children = direct reports (ManagerAssignment where this user is managerId).
 */
export async function GET() {
  try {
    const auth = await requireOwnerOrSuperAdmin()
    if ('error' in auth) return auth.error

    const [users, assignments] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
      prisma.managerAssignment.findMany({
        select: { managerId: true, employeeId: true },
      }),
    ])

    const userById = new Map(users.map((u) => [u.id, { ...u, children: [] as HierarchyUser[] }]))
    const employeeIds = new Set(assignments.map((a) => a.employeeId))

    // Roots = users who never appear as employee (top of their chain)
    const roots = users.filter((u) => !employeeIds.has(u.id)).map((u) => userById.get(u.id)!)
    // Build edges: managerId -> employeeId
    for (const a of assignments) {
      const manager = userById.get(a.managerId)
      const child = userById.get(a.employeeId)
      if (manager && child) manager.children.push(child)
    }

    const roleOrder = (r: string | null) => (r === 'Super Admin' || r === 'SuperAdmin' ? 0 : r === 'Owner' ? 1 : r === 'Manager' ? 2 : 3)
    function sortChildren(nodes: HierarchyUser[]) {
      nodes.sort((a, b) => {
        const ra = roleOrder(a.role)
        const rb = roleOrder(b.role)
        if (ra !== rb) return ra - rb
        return (a.name || a.email).localeCompare(b.name || b.email)
      })
      nodes.forEach((n) => sortChildren(n.children))
    }
    sortChildren(roots)

    return NextResponse.json({ hierarchy: roots })
  } catch (error) {
    console.error('Get hierarchy error:', error)
    return NextResponse.json(
      { error: 'Failed to load reporting hierarchy' },
      { status: 500 }
    )
  }
}

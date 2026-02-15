import { prisma } from '@/lib/prisma'

/**
 * Returns all employee IDs that report (directly or indirectly) to the given manager.
 * So if Manager A has direct reports B and C, and B is a manager with reports D and E,
 * then getEmployeeIdsUnderManager(A) returns [B, C, D, E] (all IDs in the subtree).
 * Only includes users who are assigned as "employee" in ManagerAssignment (role is not checked here).
 */
export async function getEmployeeIdsUnderManager(managerId: string): Promise<Set<string>> {
  const result = new Set<string>()
  let currentLevel = new Set<string>([managerId])
  const visited = new Set<string>([managerId])

  while (currentLevel.size > 0) {
    const assignments = await prisma.managerAssignment.findMany({
      where: { managerId: { in: Array.from(currentLevel) } },
      select: { employeeId: true },
    })
    const nextLevel = new Set<string>()
    for (const a of assignments) {
      if (!visited.has(a.employeeId)) {
        visited.add(a.employeeId)
        result.add(a.employeeId)
        nextLevel.add(a.employeeId)
      }
    }
    currentLevel = nextLevel
  }

  return result
}

import { prisma } from '@/lib/prisma'

const ESTIMATING_DEPARTMENT_NAME = 'Estimating'

export type ContentsInvSubmissionWithRelations = {
  id: string
  userId: string
  status: string
  assignedToId: string | null
  assignedTo?: { id: string; name: string | null; email: string } | null
  [key: string]: unknown
}

/**
 * Returns the department id for the "Estimating" department, or null if not found.
 */
export async function getEstimatingDepartmentId(): Promise<string | null> {
  const dept = await prisma.department.findFirst({
    where: { name: ESTIMATING_DEPARTMENT_NAME },
    select: { id: true },
  })
  return dept?.id ?? null
}

/**
 * True if the user is Super Admin, Owner, or a Manager in the Estimating department.
 */
export async function isEstimatingManager(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, departmentId: true, department: { select: { name: true } } },
  })
  if (!user) return false
  if (user.role === 'Super Admin' || user.role === 'Owner') return true
  if (user.role === 'Manager' && user.department?.name === ESTIMATING_DEPARTMENT_NAME) return true
  return false
}

/**
 * True if the user can see all Contents INV submissions (queue view).
 * View all = Super Admin | Owner | ContentsInvAccess grant OR Manager in Estimating department.
 */
export async function canViewAllContentsInvSubmissions(
  userId: string,
  role: string | null | undefined
): Promise<boolean> {
  if (role === 'Super Admin' || role === 'Owner') return true
  const access = await prisma.contentsInvAccess.findUnique({
    where: { userId },
  })
  if (access) return true
  if (role === 'Manager') {
    const isEstimating = await isEstimatingManager(userId)
    if (isEstimating) return true
  }
  return false
}

/**
 * True if the user can assign this submission to an employee.
 * Require: Estimating manager (or Super Admin/Owner), and assigneeId must be a direct report.
 */
export async function canAssignSubmission(
  userId: string,
  assigneeId: string | null
): Promise<boolean> {
  if (!assigneeId) return false
  const isManager = await isEstimatingManager(userId)
  if (!isManager) return false
  const assignment = await prisma.managerAssignment.findUnique({
    where: { managerId_employeeId: { managerId: userId, employeeId: assigneeId } },
  })
  return !!assignment
}

/**
 * True if the user can set assignedToId on the submission (assign or unassign).
 * Unassign: pass assigneeId null; we only check that user is Estimating manager.
 */
export async function canUpdateAssignment(
  userId: string,
  submission: ContentsInvSubmissionWithRelations,
  assigneeId: string | null
): Promise<boolean> {
  const isManager = await isEstimatingManager(userId)
  if (!isManager) return false
  if (assigneeId === null) return true
  const assignment = await prisma.managerAssignment.findUnique({
    where: { managerId_employeeId: { managerId: userId, employeeId: assigneeId } },
  })
  return !!assignment
}

/**
 * True if the user can mark this submission complete (set status + totalAmount).
 * Allowed: assigned employee, or a manager who has this assignee as direct report (Estimating), or Super Admin/Owner.
 */
export async function canCompleteSubmission(
  userId: string,
  submission: ContentsInvSubmissionWithRelations
): Promise<boolean> {
  if (!submission.assignedToId) return false
  if (submission.assignedToId === userId) return true
  const isManager = await isEstimatingManager(userId)
  if (!isManager) return false
  const assignment = await prisma.managerAssignment.findUnique({
    where: { managerId_employeeId: { managerId: userId, employeeId: submission.assignedToId } },
  })
  return !!assignment
}

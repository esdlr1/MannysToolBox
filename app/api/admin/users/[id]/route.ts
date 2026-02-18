import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// PATCH - Update user role and department (Super Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error
    const { id: userId } = await params

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await request.json()
    const role = typeof body.role === 'string' ? body.role.trim() || null : undefined
    const departmentId = body.departmentId === null || (typeof body.departmentId === 'string' && body.departmentId) ? body.departmentId : undefined
    const name = typeof body.name === 'string' ? body.name.trim() || null : undefined

    if (departmentId !== undefined && departmentId !== null) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } })
      if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role !== undefined && { role }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(name !== undefined && { name }),
      },
      select: { id: true, email: true, name: true, role: true, departmentId: true },
    })
    return NextResponse.json({ user: updated })
  } catch (e) {
    console.error('[admin/users/[id]] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

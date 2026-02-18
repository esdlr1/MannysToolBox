import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/** Normalize role for comparison. Accepts "Super Admin" and "SuperAdmin". */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? '').trim()
  return r === 'Super Admin' || r === 'SuperAdmin'
}

/** Require Super Admin; returns session + user or error response. */
export async function requireSuperAdmin(): Promise<
  | { error: NextResponse }
  | { session: { user: { id: string } }; user: { role: string | null } }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user || !isSuperAdminRole(user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 }) }
  }
  return { session: session as { user: { id: string } }, user }
}

/** Require Owner or Super Admin; returns session + user or error response. */
export async function requireOwnerOrSuperAdmin(): Promise<
  | { error: NextResponse }
  | { session: { user: { id: string } }; user: { role: string | null } }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const role = (user?.role ?? '').trim()
  const allowed = role === 'Owner' || role === 'Super Admin' || role === 'SuperAdmin'
  if (!user || !allowed) {
    return { error: NextResponse.json({ error: 'Forbidden - Owner or Super Admin only' }, { status: 403 }) }
  }
  return { session: session as { user: { id: string } }, user }
}

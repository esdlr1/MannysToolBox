import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (me?.role !== 'Super Admin') {
    return { error: NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 }) }
  }
  return { error: null }
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    })
    return NextResponse.json({ departments })
  } catch (e) {
    console.error('[admin/departments] GET error:', e)
    return NextResponse.json({ error: 'Failed to load departments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  try {
    const { name, description } = await request.json()
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const existing = await prisma.department.findUnique({
      where: { name: trimmedName },
    })
    if (existing) {
      return NextResponse.json({ error: 'A department with this name already exists' }, { status: 400 })
    }
    const department = await prisma.department.create({
      data: {
        name: trimmedName,
        description: typeof description === 'string' ? description.trim() || null : null,
      },
    })
    return NextResponse.json(
      { message: 'Department created', department: { id: department.id, name: department.name, description: department.description } },
      { status: 201 }
    )
  } catch (e) {
    console.error('[admin/departments] POST error:', e)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}

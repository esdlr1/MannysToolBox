import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireSuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// POST - Create user (Super Admin only).
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error

    const { email, name, password, role, departmentId } = await request.json()
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      })
      if (!department) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const isApproved = true // Super Admin creates users as approved

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: (name && String(name).trim()) || null,
        password: hashedPassword,
        role: role || null,
        isApproved,
        departmentId: departmentId || null,
      },
    })

    await prisma.profile.create({
      data: { userId: user.id },
    })

    return NextResponse.json(
      { message: 'User created successfully', userId: user.id, email: user.email },
      { status: 201 }
    )
  } catch (error) {
    console.error('[admin/users] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create user', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

// GET - List all users with tags (Super Admin only). For employee tag management.
export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return auth.error
    let list: Array<{ id: string; email: string; name: string | null; role: string | null; departmentId: string | null; tags: Array<{ key: string; value: string }> }>
    try {
      const users = await prisma.user.findMany({
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          tags: {
            select: { key: true, value: true },
          },
        },
      })
      list = users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        departmentId: u.departmentId,
        tags: u.tags.map((t) => ({ key: t.key, value: t.value })),
      }))
    } catch (tagsErr) {
      console.warn('[admin/users] GET with tags failed, falling back to users without tags:', tagsErr)
      const users = await prisma.user.findMany({
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        select: { id: true, email: true, name: true, role: true, departmentId: true },
      })
      list = users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        departmentId: u.departmentId,
        tags: [],
      }))
    }
    return NextResponse.json({ users: list })
  } catch (error) {
    console.error('[admin/users] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load users', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

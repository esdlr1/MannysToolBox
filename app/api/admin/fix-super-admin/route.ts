import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

/**
 * Fix Super Admin user in database
 * This endpoint ensures the Super Admin user exists with correct values
 * 
 * Usage:
 * POST /api/admin/fix-super-admin
 * Body: { email: "enmaeladio@gmail.com", password: "En220193", name: "Emmanuel Suero" }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim()

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        isApproved: true,
      },
    })

    // Create or update user
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        email: normalizedEmail, // Ensure lowercase
        password: hashedPassword,
        role: 'Super Admin',
        isApproved: true,
        name: name || 'Super Admin',
      },
      create: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'Super Admin',
        isApproved: true,
        name: name || 'Super Admin',
      },
    })

    // Ensure profile exists
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
      },
    })

    // Verify password works
    const passwordMatch = await bcrypt.compare(password, user.password)

    return NextResponse.json({
      success: true,
      message: existingUser ? 'User updated successfully' : 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved,
      },
      verification: {
        passwordMatches: passwordMatch,
        emailNormalized: user.email === normalizedEmail,
        roleCorrect: user.role === 'Super Admin',
        isApproved: user.isApproved === true,
        loginShouldWork: passwordMatch && user.role === 'Super Admin' && user.isApproved,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fix Super Admin user',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

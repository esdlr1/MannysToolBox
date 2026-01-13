import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// ⚠️ SECURITY: This is a one-time admin creation endpoint
// Delete this file after creating your admin user!
// Or protect it with a secret key

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Optional: Add secret key protection
    const authHeader = request.headers.get('authorization')
    const secret = process.env.ADMIN_CREATE_SECRET || 'temporary-secret-change-me'
    
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { email, name, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      // Update existing user to Super Admin
      const hashedPassword = await bcrypt.hash(password, 12)
      
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'Super Admin',
          password: hashedPassword,
          isApproved: true,
          name: name || existingUser.name,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'User updated to Super Admin',
        email: normalizedEmail,
      })
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        password: hashedPassword,
        role: 'Super Admin',
        isApproved: true,
      },
    })

    // Create profile
    await prisma.profile.create({
      data: {
        userId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Super Admin user created',
      email: normalizedEmail,
      userId: user.id,
    })
  } catch (error: any) {
    console.error('Create admin error:', error)
    return NextResponse.json(
      { error: 'Failed to create admin user', details: error.message },
      { status: 500 }
    )
  }
}

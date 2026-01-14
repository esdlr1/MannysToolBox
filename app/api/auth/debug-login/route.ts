import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Normalize email (same as auth.ts)
    const normalizedEmail = email.toLowerCase().trim()

    // Find user with exact match
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        password: true,
      },
    })

    // If not found, try case-insensitive search
    let allUsers: any[] = []
    if (!user) {
      allUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: email,
            mode: 'insensitive',
          },
        },
        select: {
          email: true,
          role: true,
          isApproved: true,
        },
      })
    }

    // Test password if user found
    let passwordMatch = false
    if (user && user.password) {
      passwordMatch = await bcrypt.compare(password, user.password)
    }

    // Check what would happen in auth
    let authResult = {
      wouldSucceed: false,
      reason: '',
    }

    if (!user) {
      authResult.reason = 'User not found'
    } else if (!user.password) {
      authResult.reason = 'User has no password'
    } else if (!passwordMatch) {
      authResult.reason = 'Password does not match'
    } else if ((user.role === 'Owner' || user.role === 'Manager') && !user.isApproved) {
      authResult.reason = 'Account pending approval'
    } else {
      authResult.wouldSucceed = true
      authResult.reason = 'Login would succeed'
    }

    return NextResponse.json({
      input: {
        email,
        normalizedEmail,
        passwordLength: password.length,
      },
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isApproved: user.isApproved,
            hasPassword: !!user.password,
            passwordHashLength: user.password?.length || 0,
            passwordHashPrefix: user.password?.substring(0, 20) || 'N/A',
          }
        : null,
      similarUsers: allUsers,
      password: {
        matches: passwordMatch,
      },
      authentication: authResult,
      debug: {
        roleCheck: user
          ? {
              role: user.role,
              isSuperAdmin: user.role === 'Super Admin',
              isOwner: user.role === 'Owner',
              isManager: user.role === 'Manager',
              needsApproval: user.role === 'Owner' || user.role === 'Manager',
              isApproved: user.isApproved,
              wouldBlock: (user.role === 'Owner' || user.role === 'Manager') && !user.isApproved,
            }
          : null,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Debug failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

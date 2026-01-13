import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const email = 'enmaeladio@gmail.com'
    const password = 'En220193'
    const normalizedEmail = email.toLowerCase().trim()

    // Test database connection
    let dbConnected = false
    try {
      await prisma.$queryRaw`SELECT 1`
      dbConnected = true
    } catch (error: any) {
      return NextResponse.json({
        error: 'Database connection failed',
        details: error.message,
        dbConnected: false,
      })
    }

    // Find user
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

    if (!user) {
      // Try case-insensitive search
      const allUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: normalizedEmail,
            mode: 'insensitive',
          },
        },
        select: {
          email: true,
          role: true,
        },
      })

      return NextResponse.json({
        dbConnected: true,
        userFound: false,
        normalizedEmail,
        similarEmails: allUsers.map(u => u.email),
        message: 'User not found with exact email match',
      })
    }

    // Test password
    const passwordMatch = user.password
      ? await bcrypt.compare(password, user.password)
      : false

    return NextResponse.json({
      dbConnected: true,
      userFound: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved,
      },
      password: {
        exists: !!user.password,
        length: user.password?.length || 0,
        format: user.password?.substring(0, 7) || 'N/A',
        matches: passwordMatch,
      },
      authentication: {
        shouldWork: passwordMatch && user.role === 'Super Admin' && user.isApproved,
      },
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 })
  }
}

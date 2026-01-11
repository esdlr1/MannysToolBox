import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// This endpoint creates the Super Admin user if it doesn't exist
// Should be called once during initial setup
export async function POST(request: NextRequest) {
  try {
    const SUPER_ADMIN_EMAIL = 'enmaeladio@gmail.com' // Always use lowercase
    const SUPER_ADMIN_PASSWORD = 'En220193'

    // Normalize email to lowercase
    const normalizedEmail = SUPER_ADMIN_EMAIL.toLowerCase().trim()

    // Check if Super Admin already exists
    // Try lowercase first (current standard)
    let existingAdmin = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    // If not found, search for any case variant (for existing databases)
    if (!existingAdmin) {
      const allUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: normalizedEmail,
          }
        }
      })
      // Find case-insensitive match
      existingAdmin = allUsers.find(u => u.email.toLowerCase() === normalizedEmail) || null
      
      // If found with different case, update to lowercase
      if (existingAdmin && existingAdmin.email !== normalizedEmail) {
        existingAdmin = await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { email: normalizedEmail }
        })
      }
    }

    if (existingAdmin) {
      // Update to ensure it's a Super Admin
      if (existingAdmin.role !== 'Super Admin' || !existingAdmin.isApproved) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            role: 'Super Admin',
            isApproved: true,
          }
        })
        return NextResponse.json({ 
          message: 'Super Admin updated successfully',
          email: normalizedEmail
        })
      }
      return NextResponse.json({ 
        message: 'Super Admin already exists',
        email: normalizedEmail
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12)

    // Create Super Admin user (email stored in lowercase)
    const superAdmin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: 'Super Admin',
        password: hashedPassword,
        role: 'Super Admin',
        isApproved: true, // Super Admin is auto-approved
      }
    })

    // Create profile for Super Admin
    await prisma.profile.create({
      data: {
        userId: superAdmin.id,
      }
    })

    return NextResponse.json({ 
      message: 'Super Admin created successfully',
      email: normalizedEmail,
      note: 'Email stored as lowercase for case-insensitive login'
    })
  } catch (error) {
    console.error('Error initializing Super Admin:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

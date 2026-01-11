/**
 * Script to initialize the Super Admin account
 * Run with: npx tsx scripts/init-super-admin.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function initSuperAdmin() {
  try {
    const SUPER_ADMIN_EMAIL = 'enmaeladio@gmail.com' // Always use lowercase
    const SUPER_ADMIN_PASSWORD = 'En220193'

    console.log('Initializing Super Admin account...')
    console.log('Note: Email will be stored as lowercase (case-insensitive login)')

    // Normalize email to lowercase
    const normalizedEmail = SUPER_ADMIN_EMAIL.toLowerCase().trim()

    // Check if Super Admin already exists
    // Try lowercase first (current standard)
    let existingAdmin = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    // If not found, search for any case variant (for existing databases with uppercase emails)
    if (!existingAdmin) {
      const allUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: normalizedEmail.replace('@', ''),
          }
        }
      })
      // Find case-insensitive match
      existingAdmin = allUsers.find(u => u.email.toLowerCase() === normalizedEmail) || null
      
      // If found with different case, update email to lowercase and role
      if (existingAdmin && existingAdmin.email !== normalizedEmail) {
        console.log(`Found existing user with different case: ${existingAdmin.email}`)
        console.log('Updating email to lowercase...')
        existingAdmin = await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            email: normalizedEmail,
            role: 'Super Admin',
            isApproved: true,
          }
        })
        console.log('✅ Email normalized to lowercase and Super Admin role set!')
        console.log(`   Email: ${normalizedEmail}`)
        return
      }
    }

    if (existingAdmin) {
      // Update to ensure it's a Super Admin with lowercase email
      if (existingAdmin.role !== 'Super Admin' || !existingAdmin.isApproved || existingAdmin.email !== normalizedEmail) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            email: normalizedEmail, // Ensure lowercase
            role: 'Super Admin',
            isApproved: true,
          }
        })
        console.log('✅ Super Admin updated successfully!')
        console.log(`   Email: ${normalizedEmail} (normalized to lowercase)`)
        return
      }
      console.log('✅ Super Admin already exists!')
      console.log(`   Email: ${normalizedEmail}`)
      return
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
        isApproved: true,
      }
    })

    // Create profile for Super Admin
    await prisma.profile.create({
      data: {
        userId: superAdmin.id,
      }
    })

    console.log('✅ Super Admin created successfully!')
    console.log(`   Email: ${normalizedEmail} (stored as lowercase)`)
    console.log(`   Password: ${SUPER_ADMIN_PASSWORD}`)
    console.log('\n📝 Note: You can sign in with any case variation:')
    console.log(`   - ${normalizedEmail}`)
    console.log(`   - Enmaeladio@gmail.com`)
    console.log(`   - ENMAELADIO@GMAIL.COM`)
    console.log('\n⚠️  Please change the password after first login!')
  } catch (error) {
    console.error('❌ Error initializing Super Admin:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

initSuperAdmin()

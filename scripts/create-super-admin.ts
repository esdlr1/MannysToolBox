import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function main() {
  console.log('🔧 Create Super Admin User\n')

  const email = await question('Email: ')
  if (!email) {
    console.log('❌ Email is required')
    process.exit(1)
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    console.log(`\n⚠️  User with email "${normalizedEmail}" already exists`)
    const update = await question('Update to Super Admin? (y/n): ')
    if (update.toLowerCase() !== 'y') {
      console.log('Cancelled.')
      process.exit(0)
    }

    const password = await question('New password: ')
    if (!password) {
      console.log('❌ Password is required')
      process.exit(1)
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: 'Super Admin',
        password: hashedPassword,
        isApproved: true,
      },
    })

    console.log(`\n✅ User "${normalizedEmail}" updated to Super Admin`)
  } else {
    const name = await question('Name (optional): ')
    const password = await question('Password: ')
    if (!password) {
      console.log('❌ Password is required')
      process.exit(1)
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        password: hashedPassword,
        role: 'Super Admin',
        isApproved: true, // Super Admin is auto-approved
      },
    })

    // Create profile
    await prisma.profile.create({
      data: {
        userId: user.id,
      },
    })

    console.log(`\n✅ Super Admin user created: ${normalizedEmail}`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    rl.close()
    await prisma.$disconnect()
  })

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking for Super Admin users...\n')

  // Find all Super Admin users
  const superAdmins = await prisma.user.findMany({
    where: {
      role: 'Super Admin',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isApproved: true,
      createdAt: true,
      password: true, // We'll just check if it exists
    },
  })

  if (superAdmins.length === 0) {
    console.log('❌ No Super Admin users found in database.\n')
    console.log('To create a Super Admin user, run:')
    console.log('  npm run create-super-admin')
    return
  }

  console.log(`✅ Found ${superAdmins.length} Super Admin user(s):\n`)

  superAdmins.forEach((admin, index) => {
    console.log(`${index + 1}. Email: ${admin.email}`)
    console.log(`   Name: ${admin.name || 'N/A'}`)
    console.log(`   Role: ${admin.role}`)
    console.log(`   Approved: ${admin.isApproved}`)
    console.log(`   Has Password: ${admin.password ? 'Yes' : 'No'}`)
    console.log(`   Created: ${admin.createdAt}`)
    console.log('')
  })

  // Test authentication
  console.log('🧪 Testing authentication...\n')
  if (process.argv.length < 4) {
    console.log('To test authentication, run:')
    console.log('  node scripts/check-super-admin.js <email> <password>')
    return
  }

  const testEmail = process.argv[2]
  const testPassword = process.argv[3]

  const user = await prisma.user.findUnique({
    where: { email: testEmail.toLowerCase().trim() },
  })

  if (!user) {
    console.log(`❌ User with email "${testEmail}" not found`)
    return
  }

  if (!user.password) {
    console.log(`❌ User "${testEmail}" has no password set`)
    return
  }

  const isValid = await bcrypt.compare(testPassword, user.password)

  if (isValid) {
    console.log(`✅ Password is correct for "${testEmail}"`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Approved: ${user.isApproved}`)
  } else {
    console.log(`❌ Password is incorrect for "${testEmail}"`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

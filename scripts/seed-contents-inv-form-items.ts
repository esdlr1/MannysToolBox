/**
 * One-time seed: insert Contents INV form items in the required order.
 * Run: npx tsx scripts/seed-contents-inv-form-items.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FORM_ITEMS = [
  'Inventory Hours',
  'Supervisor on site hours',
  'content pack-out labor',
  'PPE',
  'Floor Protection',
  'Small box',
  'Medium box',
  'Large Box',
  'Wardrobe Box',
  'TV/Picture box',
  'Mattress Bag',
  'Furniture Blankets',
  "Stretch Wrap (20'x1000')",
  "Hand Wrap (5\"1000')",
  'Packing Paper (LF Used)',
  'Bubble Wrap (LF) Used)',
  'Storage Vault Sanitation (Number of vaults)',
  'Offsite Storage (Per CF)',
  'Moving Trucks',
]

async function main() {
  const existing = await prisma.contentsInvFormItem.count()
  if (existing > 0) {
    console.log('Form items already exist. Skipping seed. Delete them first if you want to re-seed.')
    return
  }

  for (let i = 0; i < FORM_ITEMS.length; i++) {
    await prisma.contentsInvFormItem.create({
      data: {
        label: FORM_ITEMS[i],
        sortOrder: i,
        isActive: true,
      },
    })
  }
  console.log(`Created ${FORM_ITEMS.length} Contents INV form items.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

import { prisma } from './lib/prisma'

async function checkSnapshots() {
  const org = await prisma.organization.findFirst({
    where: {
      organizationName: {
        contains: 'gugaleo',
        mode: 'insensitive'
      }
    }
  })

  if (!org) {
    console.log('❌ Org não encontrada')
    return
  }

  const snapshots = await prisma.fullStockSnapshot.findMany({
    where: { organizationId: org.id },
    include: {
      mlAccount: {
        select: {
          nickname: true
        }
      }
    },
    take: 5
  })

  console.log(`\n📊 Primeiros 5 snapshots de GUGALEO:\n`)

  for (const snap of snapshots) {
    console.log(`Item: ${snap.itemTitle}`)
    console.log(`  - Inventory ID: ${snap.inventoryId}`)
    console.log(`  - Item ID: ${snap.itemId}`)
    console.log(`  - Conta: ${snap.mlAccount.nickname}`)
    console.log(`  - Estoque: ${snap.availableStock}/${snap.totalStock}`)
    console.log(`  - Days of Cover: ${snap.daysOfCover}`)
    console.log(`  - Alert Level: ${snap.alertLevel}`)
    console.log(`  - Data Quality: ${snap.dataQuality}`)
    console.log(`  - Last Analyzed: ${snap.lastAnalyzedAt}`)
    console.log('')
  }

  await prisma.$disconnect()
}

checkSnapshots().catch(console.error)

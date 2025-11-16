import { prisma } from './lib/prisma'

async function testAPI() {
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

  console.log('✅ Organization ID:', org.id)

  // Test query direto como a API faz
  const whereClause: any = {
    organizationId: org.id
  }

  const total = await prisma.fullStockSnapshot.count({ where: whereClause })
  console.log('\n📊 Total snapshots:', total)

  const items = await prisma.fullStockSnapshot.findMany({
    where: whereClause,
    include: {
      mlAccount: {
        select: {
          id: true,
          nickname: true,
          siteId: true
        }
      }
    },
    orderBy: {
      daysOfCover: 'asc'
    },
    take: 10
  })

  console.log(`\n📦 Primeiros 10 items (ordenados por daysOfCover ASC):\n`)

  for (const item of items) {
    console.log(`${item.itemTitle.substring(0, 40)}...`)
    console.log(`  - Estoque: ${item.availableStock}/${item.totalStock}`)
    console.log(`  - Days: ${item.daysOfCover}`)
    console.log(`  - Alert: ${item.alertLevel}`)
    console.log(`  - Account: ${item.mlAccount.nickname}`)
    console.log('')
  }

  await prisma.$disconnect()
}

testAPI().catch(console.error)

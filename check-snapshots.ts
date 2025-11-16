import { prisma } from './lib/prisma'

async function check() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { username: { contains: 'gugaleo', mode: 'insensitive' } }
      ]
    }
  })

  if (org) {
    console.log('📊 RESUMO RÁPIDO GUGALEO:')

    const snapshots = await prisma.fullStockSnapshot.findMany({
      where: { organizationId: org.id },
      select: {
        mlAccountId: true,
        mlAccount: { select: { nickname: true } }
      }
    })

    const byAccount = snapshots.reduce((acc: any, s) => {
      const key = s.mlAccount.nickname
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    console.log('')
    Object.entries(byAccount).forEach(([nick, count]) => {
      console.log(`  ${nick}: ${count} items Full`)
    })
    console.log(`\nTOTAL: ${snapshots.length} items Full sincronizados`)
    console.log(`ESPERADO: 39 items`)
    console.log(`DIFERENÇA: ${39 - snapshots.length} items`)

    console.log(`\n⚠️  IMPORTANTE:`)
    console.log(`  - Esses ${snapshots.length} items são os que TÊM inventory_id (Full)`)
    console.log(`  - Os outros ${39 - snapshots.length} podem ser Flex ou Coleta (sem inventory_id)`)
    console.log(`  - Nem todo anúncio no ML é Full!`)
  }

  await prisma.$disconnect()
}

check()

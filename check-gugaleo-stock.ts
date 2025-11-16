import { prisma } from './lib/prisma'

async function checkGugaleoStock() {
  // Buscar organização GUGALEO
  const org = await prisma.organization.findFirst({
    where: {
      organizationName: {
        contains: 'gugaleo',
        mode: 'insensitive'
      }
    },
    include: {
      mlAccounts: {
        where: { isActive: true },
        select: {
          id: true,
          nickname: true,
          mlUserId: true,
          isActive: true,
          _count: {
            select: {
              fullStockSnapshots: true
            }
          }
        }
      }
    }
  })

  if (!org) {
    console.log('❌ Organização GUGALEO não encontrada')
    return
  }

  console.log('\n✅ Organização GUGALEO encontrada:')
  console.log('   ID:', org.id)
  console.log('   Nome:', org.name)
  console.log('   ML Accounts:', org.mlAccounts.length)

  for (const acc of org.mlAccounts) {
    console.log(`\n   Conta: ${acc.nickname}`)
    console.log(`   - ID: ${acc.id}`)
    console.log(`   - ML User ID: ${acc.mlUserId}`)
    console.log(`   - Ativa: ${acc.isActive}`)
    console.log(`   - Full Snapshots: ${acc._count.fullStockSnapshots}`)
  }

  // Buscar total de snapshots
  const totalSnapshots = await prisma.fullStockSnapshot.count({
    where: { organizationId: org.id }
  })

  console.log(`\n📊 TOTAL de snapshots para GUGALEO: ${totalSnapshots}`)

  if (totalSnapshots === 0) {
    console.log('\n🔴 PROBLEMA: Nenhum snapshot encontrado!')
    console.log('   AÇÃO: Executar sincronização manual')
    console.log('   Comando: POST /api/stock/sync-full')
  }

  await prisma.$disconnect()
}

checkGugaleoStock().catch(console.error)

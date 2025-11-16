import { prisma } from './lib/prisma'

async function checkGugaleo() {
  // 1. Buscar organização GUGALEO
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } },
        { username: { contains: 'gugaleo', mode: 'insensitive' } }
      ]
    },
    include: {
      mlAccounts: {
        where: { isActive: true },
        select: {
          id: true,
          nickname: true,
          mlUserId: true
        }
      }
    }
  })

  if (!org) {
    console.log('❌ Organização GUGALEO não encontrada!')
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log('✅ Organização:', org.organizationName || org.username)
  console.log('📊 ID:', org.id)
  console.log('👥 Contas ML:', org.mlAccounts.length)
  org.mlAccounts.forEach((acc, i) => {
    console.log(`   ${i+1}. ${acc.nickname} (ID: ${acc.id})`)
  })

  // 2. Contar snapshots por conta
  console.log('\n📦 Snapshots por conta:')
  for (const acc of org.mlAccounts) {
    const count = await prisma.fullStockSnapshot.count({
      where: {
        organizationId: org.id,
        mlAccountId: acc.id
      }
    })
    console.log(`   ${acc.nickname}: ${count} snapshots`)
  }

  // 3. Total
  const total = await prisma.fullStockSnapshot.count({
    where: { organizationId: org.id }
  })

  console.log(`\n🔢 TOTAL: ${total} snapshots`)
  console.log(`⚠️  ESPERADO: 39 snapshots`)
  console.log(`❌ FALTANDO: ${39 - total} snapshots\n`)

  console.log('🔄 Executando sincronização FORÇADA agora...\n')

  await prisma.$disconnect()
}

checkGugaleo()

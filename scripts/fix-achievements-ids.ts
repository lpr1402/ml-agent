/**
 * 🔧 CORRIGIR IDs DE ACHIEVEMENTS
 * Limpar achievements antigos e deixar sistema recalcular com novos IDs
 */

import { prisma } from '@/lib/prisma'

async function fixAchievementsIds() {
  console.log('🔧 CORRIGINDO IDs DE ACHIEVEMENTS\n')

  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } }
      ]
    },
    include: { mlAccounts: true }
  })

  if (!org) {
    console.log('Organização não encontrada')
    return
  }

  const accountIds = org.mlAccounts.map(a => a.id)

  // Deletar achievements antigos (IDs incompatíveis)
  const deleted = await prisma.achievement.deleteMany({
    where: {
      mlAccountId: { in: accountIds }
    }
  })

  console.log(`🗑️  ${deleted.count} achievements antigos deletados`)
  console.log('\n✅ Sistema irá recalcular achievements automaticamente')
  console.log('💡 Nas próximas respostas, os achievements serão desbloqueados com IDs corretos\n')

  await prisma.$disconnect()
}

fixAchievementsIds()

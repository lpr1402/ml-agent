/**
 * DEBUG: Verificar achievements da organização GUGALEO
 */

import { prisma } from '@/lib/prisma'

async function debugAchievements() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } }
      ]
    },
    include: {
      mlAccounts: {
        include: {
          xpTracking: {
            include: {
              achievements: true
            }
          }
        }
      }
    }
  })

  if (!org) {
    console.log('Organização não encontrada')
    return
  }

  console.log('🔍 DEBUG ACHIEVEMENTS GUGALEO\n')

  // Achievements desbloqueados
  const allUnlockedAchievements = org.mlAccounts.flatMap(acc =>
    (acc.xpTracking?.achievements || []).map(ach => ({
      account: acc.nickname,
      achievementType: ach.achievementType,
      achievementBaseType: ach.achievementBaseType,
      tier: ach.tier,
      title: ach.title,
      xpRewarded: ach.xpRewarded,
      unlockedAt: ach.unlockedAt
    }))
  )

  console.log(`✅ Total de achievements desbloqueados: ${allUnlockedAchievements.length}\n`)

  allUnlockedAchievements.forEach(ach => {
    console.log(`🏆 ${ach.title}`)
    console.log(`   Conta: ${ach.account}`)
    console.log(`   Tipo: ${ach.achievementBaseType} | Tier: ${ach.tier}`)
    console.log(`   ID: ${ach.achievementType}`)
    console.log(`   XP: +${ach.xpRewarded}`)
    console.log(`   Data: ${ach.unlockedAt.toISOString()}`)
    console.log('')
  })

  // Stats da organização
  console.log('\n📊 STATS DA ORGANIZAÇÃO:\n')

  const orgStats = {
    ultraFastCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.ultraFastCount || 0), 0),
    fastResponsesCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.fastResponsesCount || 0), 0),
    questionsAnswered: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.questionsAnswered || 0), 0),
    bestStreak: Math.max(...org.mlAccounts.map(acc => acc.xpTracking?.bestStreak || 0)),
    firstApprovalCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.firstApprovalCount || 0), 0),
    earlyBirdCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.earlyBirdCount || 0), 0)
  }

  console.log('Ultra rápidas (< 5min):', orgStats.ultraFastCount)
  console.log('Rápidas (< 30min):', orgStats.fastResponsesCount)
  console.log('Total perguntas:', orgStats.questionsAnswered)
  console.log('Maior sequência:', orgStats.bestStreak)
  console.log('Primeira aprovação:', orgStats.firstApprovalCount)
  console.log('Madrugador:', orgStats.earlyBirdCount)

  await prisma.$disconnect()
}

debugAchievements()

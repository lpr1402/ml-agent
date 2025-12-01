/**
 * 🏆 DESBLOQUEAR ACHIEVEMENTS JÁ CONQUISTADOS
 * Força verificação e desbloqueio baseado nas stats atuais
 */

import { prisma } from '@/lib/prisma'
import { AchievementChecker } from '@/lib/gamification/achievements'

async function unlockEarnedAchievements() {
  console.log('🏆 DESBLOQUEANDO ACHIEVEMENTS JÁ CONQUISTADOS\n')

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

  if (!org) return

  // Stats da organização (soma de todas as contas)
  const orgStats = {
    lightningCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.lightningCount || 0), 0),
    ultraFastCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.ultraFastCount || 0), 0),
    fastResponsesCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.fastResponsesCount || 0), 0),
    currentStreak: Math.max(...org.mlAccounts.map(acc => acc.xpTracking?.currentStreak || 0)),
    bestStreak: Math.max(...org.mlAccounts.map(acc => acc.xpTracking?.bestStreak || 0)),
    questionsAnswered: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.questionsAnswered || 0), 0),
    firstApprovalCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.firstApprovalCount || 0), 0),
    earlyBirdCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.earlyBirdCount || 0), 0),
    lateNightCount: org.mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.lateNightCount || 0), 0)
  }

  console.log('📊 Stats Atuais:')
  console.log(`   Ultra rápidas: ${orgStats.ultraFastCount}`)
  console.log(`   Rápidas: ${orgStats.fastResponsesCount}`)
  console.log(`   Total: ${orgStats.questionsAnswered}`)
  console.log(`   Sequência: ${orgStats.bestStreak}`)
  console.log(`   Primeira aprovação: ${orgStats.firstApprovalCount}`)
  console.log(`   Madrugador: ${orgStats.earlyBirdCount}\n`)

  // Verificar todos os achievements
  const currentAchievements: string[] = [] // Começar do zero após limpeza

  const result = AchievementChecker.checkUnlocked(orgStats, currentAchievements)

  console.log(`✅ ${result.newlyUnlocked.length} achievements podem ser desbloqueados agora!\n`)

  if (result.newlyUnlocked.length === 0) {
    console.log('✨ Nenhum achievement a desbloquear no momento.\n')
    await prisma.$disconnect()
    return
  }

  let totalXPAwarded = 0

  // Desbloquear para a conta principal (primeira)
  const mainAccount = org.mlAccounts[0]

  if (!mainAccount) {
    console.log('Conta principal não encontrada')
    return
  }

  for (const achievement of result.newlyUnlocked) {
    await prisma.achievement.create({
      data: {
        mlAccountId: mainAccount.id,
        achievementType: achievement.id,
        achievementBaseType: achievement.type,
        tier: achievement.tier,
        title: achievement.title,
        description: achievement.description,
        xpRewarded: achievement.xpReward
      }
    })

    // Adicionar XP
    await prisma.mLAccountXP.update({
      where: { mlAccountId: mainAccount.id },
      data: {
        totalXP: { increment: achievement.xpReward }
      }
    })

    // Criar atividade de XP
    await prisma.xPActivity.create({
      data: {
        mlAccountId: mainAccount.id,
        actionType: 'achievement_unlocked',
        actionDescription: `Conquista: ${achievement.title}`,
        xpEarned: achievement.xpReward,
        xpBreakdown: {
          achievementBonus: achievement.xpReward
        }
      }
    })

    totalXPAwarded += achievement.xpReward

    console.log(`✅ ${achievement.title}`)
    console.log(`   Tier: ${achievement.tierName}`)
    console.log(`   XP: +${achievement.xpReward}`)
    console.log(`   Conta: ${mainAccount.nickname}\n`)
  }

  console.log(`\n💰 XP Total Adicionado: ${totalXPAwarded.toLocaleString()}`)
  console.log(`✨ ${result.newlyUnlocked.length} conquistas desbloqueadas!\n`)

  await prisma.$disconnect()
}

unlockEarnedAchievements()

/**
 * 🏆 RANKING DATA API
 * Endpoint principal para dados de ranking/XP da organização
 * GET /api/ranking/data
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/get-server-session'
import { LevelCalculator } from '@/lib/gamification/level-calculator'
import { ACHIEVEMENTS_MAP, AchievementChecker } from '@/lib/gamification/achievements'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // 🔐 Autenticação
    const session = await getServerSession()

    if (!session?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { organizationId } = session

    // 📊 Buscar todas as contas ML da organização
    const mlAccounts = await prisma.mLAccount.findMany({
      where: { organizationId },
      include: {
        xpTracking: {
          include: {
            achievements: true
          }
        }
      },
      orderBy: {
        xpTracking: {
          totalXP: 'desc'
        }
      }
    })

    // 🎯 Calcular stats da organização
    let totalXP = 0
    let totalQuestions = 0

    for (const account of mlAccounts) {
      if (account.xpTracking) {
        totalXP += account.xpTracking.totalXP
        totalQuestions += account.xpTracking.questionsAnswered
      }
    }

    const totalLevel = LevelCalculator.calculateLevel(totalXP)

    // 🏆 Ranking de contas
    const accountsRanking = mlAccounts.map(account => ({
      id: account.id,
      name: account.nickname,
      nickname: account.nickname,
      totalXP: account.xpTracking?.totalXP || 0,
      questionsAnswered: account.xpTracking?.questionsAnswered || 0,
      avgResponseTimeMinutes: Math.round(account.xpTracking?.avgResponseTimeMinutes || 0),
      thumbnail: account.thumbnail
    }))

    // 🎖️ Achievements - Calcular progresso para todas as conquistas
    // Usar stats da primeira conta (ou somar todas? - vou usar a organização toda)
    const orgStats = {
      lightningCount: mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.lightningCount || 0), 0),
      ultraFastCount: mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.ultraFastCount || 0), 0),
      fastResponsesCount: mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.fastResponsesCount || 0), 0),
      currentStreak: Math.max(...mlAccounts.map(acc => acc.xpTracking?.currentStreak || 0)),
      bestStreak: Math.max(...mlAccounts.map(acc => acc.xpTracking?.bestStreak || 0)),
      questionsAnswered: mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.questionsAnswered || 0), 0),
      firstApprovalCount: mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.firstApprovalCount || 0), 0),
      earlyBirdCount: mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.earlyBirdCount || 0), 0),
      lateNightCount: mlAccounts.reduce((sum, acc) => sum + (acc.xpTracking?.lateNightCount || 0), 0)
    }

    // Buscar achievements desbloqueados de todas as contas
    const allAchievements = mlAccounts.flatMap(acc => acc.xpTracking?.achievements || [])

    // Mostrar TODOS os tiers de achievements (60 total)
    const achievementProgress = AchievementChecker.calculateAllProgress(orgStats, allAchievements)

    const achievements = achievementProgress.map(progress => {
      const def = ACHIEVEMENTS_MAP[progress.achievementId]

      if (!def) {
        return null
      }

      return {
        id: def.id,
        type: def.type,
        tier: def.tier,
        tierName: def.tierName,
        title: def.title,
        description: def.description,
        emoji: def.emoji,
        iconType: def.type, // 🎯 Mapeamento do tipo para iconType (usado pelo componente)
        progress: progress.progress,
        total: progress.total,
        xpReward: def.xpReward,
        unlocked: progress.unlocked,
        unlockedAt: progress.unlockedAt,
        rarity: def.rarity,
        color: def.color,
        tips: def.tips,
        currentTier: progress.currentTier,
        nextTier: progress.nextTier
      }
    }).filter(Boolean)

    // ⚡ XP Recentes - Últimas 20 atividades de todas as contas
    const recentXPActivities = await prisma.xPActivity.findMany({
      where: {
        mlAccountId: {
          in: mlAccounts.map(acc => acc.id)
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
      include: {
        account: {
          include: {
            mlAccount: true
          }
        }
      }
    })

    const recentXP = recentXPActivities.map(activity => ({
      id: activity.id,
      accountNickname: activity.account.mlAccount.nickname,
      actionType: activity.actionType,
      actionDescription: activity.actionDescription,
      xpEarned: activity.xpEarned,
      createdAt: activity.createdAt.toISOString()
    }))

    // 📦 Resposta final
    const response = {
      organizationStats: {
        totalXP,
        totalLevel,
        totalQuestions,
        accountsCount: mlAccounts.length
      },
      accountsRanking,
      achievements,
      recentXP
    }

    logger.info('[Ranking API] Data fetched successfully', {
      organizationId,
      totalXP,
      level: totalLevel.level,
      accountsCount: mlAccounts.length
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('[Ranking API] Error fetching data', { error })

    return NextResponse.json(
      { error: 'Failed to fetch ranking data' },
      { status: 500 }
    )
  }
}

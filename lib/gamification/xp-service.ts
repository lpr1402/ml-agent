/**
 * 🎮 XP SERVICE
 * Business logic para award de XP e gerenciamento de ranking
 * Event-driven com WebSocket para updates em tempo real
 */

import { prisma } from '@/lib/prisma'
import { XPCalculator, type XPCalculationInput } from './xp-calculator'
import { AchievementChecker } from './achievements'
import { LevelCalculator } from './level-calculator'
import { logger } from '@/lib/logger'

// ========== INTERFACES ==========

export interface AwardXPInput {
  questionId: string
  mlAccountId: string
  responseTimeMinutes: number
  firstApproval: boolean
  answerLength: number
  timestamp?: Date
}

export interface AwardXPResult {
  success: boolean
  xpAwarded: number
  newTotalXP: number
  oldLevel: number
  newLevel: number
  leveledUp: boolean
  achievementsUnlocked: Array<{
    id: string
    title: string
    xpReward: number
  }>
  breakdown: {
    baseXP: number
    timeBonus: number
    qualityBonus: number
    streakBonus: number
    scheduleBonus: number
    milestoneBonus: number
    achievementBonus: number
    total: number
  }
  actionType: string
  actionDescription: string
}

// ========== XP SERVICE ==========

export class XPService {
  /**
   * 🎯 Award XP para uma resposta aprovada
   * Função principal chamada quando pergunta é aprovada
   */
  static async awardXPForResponse(input: AwardXPInput): Promise<AwardXPResult> {
    try {
      const timestamp = input.timestamp || new Date()

      // 1️⃣ Buscar ou criar XP tracking
      let xpTracking = await prisma.mLAccountXP.findUnique({
        where: { mlAccountId: input.mlAccountId },
        include: { achievements: true }
      })

      if (!xpTracking) {
        // Criar novo tracking
        xpTracking = await prisma.mLAccountXP.create({
          data: {
            mlAccountId: input.mlAccountId,
            totalXP: 0,
            level: 1
          },
          include: { achievements: true }
        })
      }

      const oldTotalXP = xpTracking.totalXP

      // 2️⃣ Calcular XP da resposta
      const xpCalcInput: XPCalculationInput = {
        questionId: input.questionId,
        mlAccountId: input.mlAccountId,
        responseTimeMinutes: input.responseTimeMinutes,
        firstApproval: input.firstApproval,
        answerLength: input.answerLength,
        timestamp
      }

      const xpResult = XPCalculator.calculate(xpCalcInput)

      // 3️⃣ Determinar categoria de velocidade
      const speedCategory = XPCalculator.getSpeedCategory(input.responseTimeMinutes)

      // 4️⃣ Calcular stats incrementais
      const hour = timestamp.getHours()
      const isEarlyBird = hour >= 6 && hour < 8
      const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6

      // Incrementar streak ou resetar
      const newStreak = xpTracking.currentStreak + 1

      // 5️⃣ Calcular bônus de streak
      const streakBonus = XPCalculator.calculateStreakBonus(newStreak)

      // 6️⃣ Calcular bônus de milestone (primeira do dia, 10ª, etc)
      // Por enquanto vamos simplificar - isso será implementado quando tivermos contagem diária
      const milestoneBonus = 0

      // 7️⃣ XP total incluindo streak e milestone
      let totalXPForAction = xpResult.xpAwarded + streakBonus + milestoneBonus

      // 8️⃣ Atualizar XP tracking
      const updateData: any = {
        // XP
        totalXP: { increment: totalXPForAction },

        // Stats gerais
        questionsAnswered: { increment: 1 },
        avgResponseTimeMinutes: {
          set: (xpTracking.avgResponseTimeMinutes * xpTracking.questionsAnswered + input.responseTimeMinutes) / (xpTracking.questionsAnswered + 1)
        },

        // Streaks
        currentStreak: newStreak,
        longestStreak: Math.max(xpTracking.longestStreak, newStreak),

        // Timestamps
        lastXPAt: timestamp,
        updatedAt: timestamp
      }

      // Add conditional increments
      if (speedCategory === 'ultra_fast') {
        updateData.ultraFastCount = { increment: 1 }
      }
      if (speedCategory === 'fast') {
        updateData.fastResponsesCount = { increment: 1 }
      }
      if (speedCategory === 'normal') {
        updateData.normalResponsesCount = { increment: 1 }
      }
      if (input.firstApproval) {
        updateData.firstApprovalCount = { increment: 1 }
      }
      if (!input.firstApproval) {
        updateData.revisionCount = { increment: 1 }
      }
      if (isEarlyBird) {
        updateData.earlyBirdCount = { increment: 1 }
      }
      if (isWeekend) {
        updateData.weekendCount = { increment: 1 }
      }

      const updatedXPTracking = await prisma.mLAccountXP.update({
        where: { mlAccountId: input.mlAccountId },
        data: updateData,
        include: { achievements: true }
      })

      // 9️⃣ Criar XPActivity (histórico)
      await prisma.xPActivity.create({
        data: {
          mlAccountId: input.mlAccountId,
          actionType: xpResult.actionType,
          actionDescription: xpResult.actionDescription,
          xpEarned: totalXPForAction,
          questionId: input.questionId,
          responseTimeMinutes: input.responseTimeMinutes,
          xpBreakdown: {
            ...xpResult.breakdown,
            streakBonus,
            milestoneBonus
          }
        }
      })

      // 🔟 Verificar achievements desbloqueados
      const currentAchievements = (updatedXPTracking.achievements || []).map((a: any) => a.achievementType)

      const achievementCheck = AchievementChecker.checkUnlocked(
        {
          ultraFastCount: updatedXPTracking.ultraFastCount,
          fastResponsesCount: updatedXPTracking.fastResponsesCount,
          questionsAnswered: updatedXPTracking.questionsAnswered,
          longestStreak: updatedXPTracking.longestStreak,
          firstApprovalCount: updatedXPTracking.firstApprovalCount,
          earlyBirdCount: updatedXPTracking.earlyBirdCount
        },
        currentAchievements
      )

      // 1️⃣1️⃣ Desbloquear achievements e dar XP de recompensa
      const unlockedAchievements = []

      if (achievementCheck.newlyUnlocked.length > 0) {
        for (const achievement of achievementCheck.newlyUnlocked) {
          // Criar achievement no banco
          await prisma.achievement.create({
            data: {
              mlAccountId: input.mlAccountId,
              achievementType: achievement.id,
              achievementBaseType: achievement.type,
              tier: achievement.tier,
              title: achievement.title,
              description: achievement.description,
              xpRewarded: achievement.xpReward
            }
          })

          unlockedAchievements.push({
            id: achievement.id,
            title: achievement.title,
            xpReward: achievement.xpReward
          })

          // Criar atividade de XP para o achievement
          await prisma.xPActivity.create({
            data: {
              mlAccountId: input.mlAccountId,
              actionType: 'achievement_unlocked',
              actionDescription: `Conquista: ${achievement.title}`,
              xpEarned: achievement.xpReward,
              xpBreakdown: {
                achievementBonus: achievement.xpReward
              }
            }
          })
        }

        // Adicionar XP dos achievements
        await prisma.mLAccountXP.update({
          where: { mlAccountId: input.mlAccountId },
          data: {
            totalXP: { increment: achievementCheck.totalXPRewarded }
          }
        })

        totalXPForAction += achievementCheck.totalXPRewarded
      }

      // 1️⃣2️⃣ Calcular novo nível
      const newTotalXP = oldTotalXP + totalXPForAction
      const levelCheck = LevelCalculator.checkLevelUp(oldTotalXP, newTotalXP)

      // Atualizar level se subiu
      if (levelCheck.leveledUp) {
        await prisma.mLAccountXP.update({
          where: { mlAccountId: input.mlAccountId },
          data: {
            level: levelCheck.newLevel
          }
        })
      }

      // 1️⃣3️⃣ Construir resposta
      const result: AwardXPResult = {
        success: true,
        xpAwarded: totalXPForAction,
        newTotalXP,
        oldLevel: levelCheck.oldLevel,
        newLevel: levelCheck.newLevel,
        leveledUp: levelCheck.leveledUp,
        achievementsUnlocked: unlockedAchievements,
        breakdown: {
          baseXP: xpResult.breakdown.baseXP,
          timeBonus: xpResult.breakdown.timeBonus,
          qualityBonus: xpResult.breakdown.qualityBonus,
          streakBonus,
          scheduleBonus: xpResult.breakdown.scheduleBonus,
          milestoneBonus,
          achievementBonus: achievementCheck.totalXPRewarded,
          total: totalXPForAction
        },
        actionType: xpResult.actionType,
        actionDescription: xpResult.actionDescription
      }

      logger.info('[XP Service] XP awarded successfully', {
        mlAccountId: input.mlAccountId,
        questionId: input.questionId,
        xpAwarded: totalXPForAction,
        newLevel: levelCheck.newLevel,
        leveledUp: levelCheck.leveledUp,
        achievementsUnlocked: unlockedAchievements.length
      })

      return result
    } catch (error) {
      logger.error('[XP Service] Error awarding XP', {
        error,
        input
      })

      throw error
    }
  }

  /**
   * 🔄 Reset streak (quando vendedor fica muito tempo sem responder)
   */
  static async resetStreak(mlAccountId: string): Promise<void> {
    try {
      await prisma.mLAccountXP.update({
        where: { mlAccountId },
        data: {
          currentStreak: 0
        }
      })

      logger.info('[XP Service] Streak reset', { mlAccountId })
    } catch (error) {
      logger.error('[XP Service] Error resetting streak', { error, mlAccountId })
    }
  }

}

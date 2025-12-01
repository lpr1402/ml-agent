/**
 * XP SERVICE 2.0
 * Business logic para award de XP e gerenciamento de ranking
 * Integrado com:
 * - 100 niveis + 10 personagens
 * - Velocidade e Rei (5x, 3x, 2x)
 * - Streak agressivo (quebra apos 1 dia)
 * - 60 achievements
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { XPCalculator, type XPCalculationInput, type XPBreakdown } from './xp-calculator'
import { AchievementChecker, type AchievementStats } from './achievements'
import { LevelCalculator } from './level-calculator'
import { StreakService } from './streak-service'
import { getCharacterByLevel, type Character } from './characters-data'
import { logger } from '@/lib/logger'

// ========== TYPES ==========

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
  levelsGained: number

  // Level details
  levelName: string
  levelEmoji: string
  levelColor: string

  // Character evolution
  characterEvolved: boolean
  oldCharacter: Character | null
  newCharacter: Character | null

  // Achievements
  achievementsUnlocked: Array<{
    id: string
    title: string
    emoji: string
    xpReward: number
    tier: number
  }>

  // Streak
  streakUpdated: boolean
  currentStreak: number
  streakBroken: boolean
  streakMilestoneReached: boolean

  // Full breakdown for modal
  breakdown: XPBreakdown

  // Action details
  actionType: string
  actionDescription: string
  isLightning: boolean
  isUltraFast: boolean
}

// ========== XP SERVICE ==========

export class XPService {
  /**
   * Award XP para uma resposta aprovada
   * Funcao principal chamada quando pergunta e aprovada
   */
  static async awardXPForResponse(input: AwardXPInput): Promise<AwardXPResult> {
    try {
      const timestamp = input.timestamp || new Date()

      // 1. Buscar ou criar XP tracking
      let xpTracking = await prisma.mLAccountXP.findUnique({
        where: { mlAccountId: input.mlAccountId },
        include: { achievements: true }
      })

      if (!xpTracking) {
        xpTracking = await prisma.mLAccountXP.create({
          data: {
            mlAccountId: input.mlAccountId,
            totalXP: 0,
            level: 1,
            currentCharacter: 'ROOKIE'
          },
          include: { achievements: true }
        })
      }

      const oldTotalXP = xpTracking.totalXP

      // 2. Check and update streak
      const streakResult = await StreakService.checkAndUpdateStreak(input.mlAccountId)

      // Re-fetch to get updated streak
      xpTracking = await prisma.mLAccountXP.findUnique({
        where: { mlAccountId: input.mlAccountId },
        include: { achievements: true }
      })

      if (!xpTracking) {
        throw new Error('XP tracking not found after streak update')
      }

      // 3. Calculate XP with character multiplier
      const xpCalcInput: XPCalculationInput = {
        questionId: input.questionId,
        mlAccountId: input.mlAccountId,
        responseTimeMinutes: input.responseTimeMinutes,
        firstApproval: input.firstApproval,
        answerLength: input.answerLength,
        timestamp,
        currentStreak: xpTracking.currentStreak,
        currentLevel: xpTracking.level
      }

      const xpResult = XPCalculator.calculate(xpCalcInput)

      // 4. Determine speed category for stats
      const speedCategory = XPCalculator.getSpeedCategory(input.responseTimeMinutes)
      const hour = timestamp.getHours()
      const isEarlyBird = hour >= 6 && hour < 8
      const isLateNight = hour >= 0 && hour < 6
      const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6

      // 5. Add streak milestone bonus if applicable
      let totalXPForAction = xpResult.xpAwarded
      if (streakResult.streakMilestoneReached) {
        totalXPForAction += streakResult.milestoneBonus
      }

      // 6. Update XP tracking with new stats
      const updateData: Record<string, unknown> = {
        totalXP: { increment: totalXPForAction },
        questionsAnswered: { increment: 1 },
        avgResponseTimeMinutes: {
          set: (xpTracking.avgResponseTimeMinutes * xpTracking.questionsAnswered + input.responseTimeMinutes) / (xpTracking.questionsAnswered + 1)
        },
        lastXPAt: timestamp,
        updatedAt: timestamp
      }

      // Update speed counters based on tier
      if (speedCategory === 'lightning') {
        updateData['lightningCount'] = { increment: 1 }
        updateData['ultraFastCount'] = { increment: 1 } // Lightning also counts as ultra fast
      } else if (speedCategory === 'ultra_fast') {
        updateData['ultraFastCount'] = { increment: 1 }
      } else if (speedCategory === 'fast') {
        updateData['fastResponsesCount'] = { increment: 1 }
      } else if (speedCategory === 'normal') {
        updateData['normalResponsesCount'] = { increment: 1 }
      } else {
        updateData['slowResponsesCount'] = { increment: 1 }
      }

      // Quality stats
      if (input.firstApproval) {
        updateData['firstApprovalCount'] = { increment: 1 }
      } else {
        updateData['revisionCount'] = { increment: 1 }
      }

      // Schedule stats
      if (isEarlyBird) {
        updateData['earlyBirdCount'] = { increment: 1 }
      }
      if (isLateNight) {
        updateData['lateNightCount'] = { increment: 1 }
      }
      if (isWeekend) {
        updateData['weekendCount'] = { increment: 1 }
      }

      // Update best day XP if applicable
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // This is simplified - in production you'd track daily XP separately
      if (totalXPForAction > xpTracking.bestDayXP) {
        updateData['bestDayXP'] = totalXPForAction
        updateData['bestDayDate'] = today
      }

      const updatedXPTracking = await prisma.mLAccountXP.update({
        where: { mlAccountId: input.mlAccountId },
        data: updateData,
        include: { achievements: true }
      })

      // 7. Create XP Activity (history)
      await prisma.xPActivity.create({
        data: {
          mlAccountId: input.mlAccountId,
          actionType: xpResult.actionType,
          actionDescription: xpResult.actionDescription,
          xpEarned: totalXPForAction,
          questionId: input.questionId,
          responseTimeMinutes: input.responseTimeMinutes,
          xpBreakdown: JSON.parse(JSON.stringify(xpResult.breakdown))
        }
      })

      // 8. Check achievements
      const currentAchievements = (updatedXPTracking.achievements || []).map((a) => a.achievementType)

      const achievementStats: AchievementStats = {
        lightningCount: updatedXPTracking.lightningCount,
        ultraFastCount: updatedXPTracking.ultraFastCount,
        fastResponsesCount: updatedXPTracking.fastResponsesCount,
        currentStreak: updatedXPTracking.currentStreak,
        bestStreak: updatedXPTracking.bestStreak,
        questionsAnswered: updatedXPTracking.questionsAnswered,
        firstApprovalCount: updatedXPTracking.firstApprovalCount,
        earlyBirdCount: updatedXPTracking.earlyBirdCount,
        lateNightCount: updatedXPTracking.lateNightCount
      }

      const achievementCheck = AchievementChecker.checkUnlocked(achievementStats, currentAchievements)

      // 9. Unlock achievements and award XP
      const unlockedAchievements: AwardXPResult['achievementsUnlocked'] = []

      if (achievementCheck.newlyUnlocked.length > 0) {
        for (const achievement of achievementCheck.newlyUnlocked) {
          await prisma.achievement.create({
            data: {
              mlAccountId: input.mlAccountId,
              achievementType: achievement.id,
              achievementBaseType: achievement.type,
              tier: achievement.tier,
              title: achievement.title,
              description: achievement.description,
              emoji: achievement.emoji,
              xpRewarded: achievement.xpReward,
              targetValue: achievement.target,
              currentValue: achievement.target
            }
          })

          unlockedAchievements.push({
            id: achievement.id,
            title: achievement.title,
            emoji: achievement.emoji,
            xpReward: achievement.xpReward,
            tier: achievement.tier
          })

          // Create XP activity for achievement
          await prisma.xPActivity.create({
            data: {
              mlAccountId: input.mlAccountId,
              actionType: 'achievement_unlocked',
              actionDescription: `Conquista: ${achievement.title}`,
              xpEarned: achievement.xpReward,
              xpBreakdown: { achievementBonus: achievement.xpReward }
            }
          })
        }

        // Add achievement XP
        await prisma.mLAccountXP.update({
          where: { mlAccountId: input.mlAccountId },
          data: {
            totalXP: { increment: achievementCheck.totalXPRewarded }
          }
        })

        totalXPForAction += achievementCheck.totalXPRewarded
      }

      // 10. Check level up and character evolution
      const newTotalXP = oldTotalXP + totalXPForAction
      const levelCheck = LevelCalculator.checkLevelUp(oldTotalXP, newTotalXP)

      // Update level and character if changed
      if (levelCheck.leveledUp) {
        const newCharacter = getCharacterByLevel(levelCheck.newLevel)

        const levelUpdateData: Prisma.MLAccountXPUpdateInput = {
          level: levelCheck.newLevel,
          currentCharacter: newCharacter.code
        }
        if (levelCheck.characterEvolved) {
          levelUpdateData.characterUnlockedAt = timestamp
        }

        await prisma.mLAccountXP.update({
          where: { mlAccountId: input.mlAccountId },
          data: levelUpdateData
        })
      }

      // 11. Build response
      const levelInfo = LevelCalculator.getLevelInfo(levelCheck.newLevel)

      const result: AwardXPResult = {
        success: true,
        xpAwarded: totalXPForAction,
        newTotalXP,
        oldLevel: levelCheck.oldLevel,
        newLevel: levelCheck.newLevel,
        leveledUp: levelCheck.leveledUp,
        levelsGained: levelCheck.levelsGained,

        // Level details
        levelName: levelInfo?.name || 'Desconhecido',
        levelEmoji: levelInfo?.emoji || '?',
        levelColor: levelInfo?.color || 'gray-400',

        // Character evolution
        characterEvolved: levelCheck.characterEvolved,
        oldCharacter: levelCheck.oldCharacter,
        newCharacter: levelCheck.newCharacter,

        // Achievements
        achievementsUnlocked: unlockedAchievements,

        // Streak
        streakUpdated: streakResult.streakUpdated,
        currentStreak: xpTracking.currentStreak,
        streakBroken: streakResult.streakBroken,
        streakMilestoneReached: streakResult.streakMilestoneReached,

        // Full breakdown
        breakdown: xpResult.breakdown,

        // Action details
        actionType: xpResult.actionType,
        actionDescription: xpResult.actionDescription,
        isLightning: xpResult.isLightning,
        isUltraFast: xpResult.isUltraFast
      }

      logger.info('[XP Service 2.0] XP awarded successfully', {
        mlAccountId: input.mlAccountId,
        questionId: input.questionId,
        xpAwarded: totalXPForAction,
        speedTier: xpResult.breakdown.speedTier,
        newLevel: levelCheck.newLevel,
        leveledUp: levelCheck.leveledUp,
        characterEvolved: levelCheck.characterEvolved,
        achievementsUnlocked: unlockedAchievements.length,
        currentStreak: xpTracking.currentStreak
      })

      return result
    } catch (error) {
      logger.error('[XP Service 2.0] Error awarding XP', { error, input })
      throw error
    }
  }

  /**
   * Get full XP profile for a user
   */
  static async getXPProfile(mlAccountId: string) {
    const xpTracking = await prisma.mLAccountXP.findUnique({
      where: { mlAccountId },
      include: {
        achievements: true,
        activities: {
          take: 20,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!xpTracking) {
      return null
    }

    const levelProgress = LevelCalculator.calculateLevel(xpTracking.totalXP)
    const streakStatus = await StreakService.getStreakStatus(mlAccountId)

    return {
      ...xpTracking,
      levelProgress,
      streakStatus
    }
  }

  /**
   * Reset streak manually
   */
  static async resetStreak(mlAccountId: string): Promise<void> {
    await StreakService.resetStreak(mlAccountId, 'manual')
    logger.info('[XP Service 2.0] Streak reset manually', { mlAccountId })
  }

  /**
   * Run daily streak check (should be called via cron)
   */
  static async runDailyStreakCheck() {
    return StreakService.runDailyStreakCheck()
  }
}

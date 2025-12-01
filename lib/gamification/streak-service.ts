/**
 * STREAK SERVICE 2.0
 * Sistema de streak agressivo - quebra apos 1 dia sem atividade
 *
 * Regras:
 * - Streak incrementa a cada dia com atividade
 * - Streak quebra se passar 1 dia sem atividade
 * - Bonus de XP progressivos por streak
 * - Tracking de melhor streak e total de streaks quebrados
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { STREAK_BONUSES } from './xp-calculator'

// ========== TYPES ==========

export interface StreakStatus {
  currentStreak: number
  lastActivityDate: Date | null
  isActive: boolean
  willBreakToday: boolean
  hoursUntilBreak: number
  nextMilestone: number | null
  daysToNextMilestone: number
  streakBonus: number
  bestStreak: number
  totalBrokenStreaks: number
}

export interface StreakUpdateResult {
  streakUpdated: boolean
  previousStreak: number
  newStreak: number
  streakBroken: boolean
  streakMilestoneReached: boolean
  milestoneBonus: number
  message: string
}

// ========== STREAK SERVICE ==========

export class StreakService {
  /**
   * Check and update streak for an account after activity
   */
  static async checkAndUpdateStreak(mlAccountId: string): Promise<StreakUpdateResult> {
    const now = new Date()
    const today = this.getDateOnly(now)

    // Get current XP record
    const xpRecord = await prisma.mLAccountXP.findUnique({
      where: { mlAccountId }
    })

    if (!xpRecord) {
      logger.warn('[Streak] No XP record found', { mlAccountId })
      return {
        streakUpdated: false,
        previousStreak: 0,
        newStreak: 0,
        streakBroken: false,
        streakMilestoneReached: false,
        milestoneBonus: 0,
        message: 'Registro de XP nao encontrado'
      }
    }

    const previousStreak = xpRecord.currentStreak
    const lastActivity = xpRecord.lastActivityDate
    const lastActivityDate = lastActivity ? this.getDateOnly(lastActivity) : null

    // Check if already updated today
    if (lastActivityDate && this.isSameDay(lastActivityDate, today)) {
      return {
        streakUpdated: false,
        previousStreak,
        newStreak: previousStreak,
        streakBroken: false,
        streakMilestoneReached: false,
        milestoneBonus: 0,
        message: 'Streak ja atualizado hoje'
      }
    }

    // Calculate new streak
    let newStreak = 1
    let streakBroken = false

    if (lastActivityDate) {
      const daysDiff = this.getDaysDifference(lastActivityDate, today)

      if (daysDiff === 1) {
        // Consecutive day - increment streak
        newStreak = previousStreak + 1
      } else if (daysDiff > 1) {
        // Streak broken - reset to 1
        newStreak = 1
        streakBroken = true
      } else {
        // Same day (should not reach here due to earlier check)
        newStreak = previousStreak
      }
    }

    // Check for milestone
    const milestoneBonus = this.getMilestoneBonus(newStreak, previousStreak)
    const streakMilestoneReached = milestoneBonus > 0

    // Update database
    await prisma.mLAccountXP.update({
      where: { mlAccountId },
      data: {
        currentStreak: newStreak,
        lastActivityDate: now,
        bestStreak: Math.max(xpRecord.bestStreak || 0, newStreak),
        streakBrokenCount: streakBroken
          ? (xpRecord.streakBrokenCount || 0) + 1
          : xpRecord.streakBrokenCount || 0,
        totalDaysActive: (xpRecord.totalDaysActive || 0) + 1
      }
    })

    // Generate message
    let message = ''
    if (streakBroken) {
      message = `Streak quebrado! Voce tinha ${previousStreak} dias. Comecando do zero!`
    } else if (streakMilestoneReached) {
      message = `STREAK MILESTONE! ${newStreak} dias consecutivos! +${milestoneBonus} XP!`
    } else if (newStreak > 1) {
      message = `Streak: ${newStreak} dias! Continue assim!`
    } else {
      message = 'Novo streak iniciado!'
    }

    logger.info('[Streak] Streak updated', {
      mlAccountId,
      previousStreak,
      newStreak,
      streakBroken,
      milestoneBonus,
      message
    })

    return {
      streakUpdated: true,
      previousStreak,
      newStreak,
      streakBroken,
      streakMilestoneReached,
      milestoneBonus,
      message
    }
  }

  /**
   * Get current streak status without updating
   */
  static async getStreakStatus(mlAccountId: string): Promise<StreakStatus> {
    const now = new Date()
    const today = this.getDateOnly(now)

    const xpRecord = await prisma.mLAccountXP.findUnique({
      where: { mlAccountId }
    })

    if (!xpRecord) {
      return {
        currentStreak: 0,
        lastActivityDate: null,
        isActive: false,
        willBreakToday: false,
        hoursUntilBreak: 0,
        nextMilestone: 3,
        daysToNextMilestone: 3,
        streakBonus: 0,
        bestStreak: 0,
        totalBrokenStreaks: 0
      }
    }

    const lastActivity = xpRecord.lastActivityDate
    const lastActivityDate = lastActivity ? this.getDateOnly(lastActivity) : null

    // Check if streak is still valid
    let isActive = false
    let willBreakToday = false
    let hoursUntilBreak = 0

    if (lastActivityDate) {
      const daysDiff = this.getDaysDifference(lastActivityDate, today)

      if (daysDiff === 0) {
        // Activity today - streak is active
        isActive = true
        // Will break tomorrow at midnight
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 2)
        hoursUntilBreak = Math.max(0, (tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60))
      } else if (daysDiff === 1) {
        // No activity today but streak can still be saved
        isActive = true
        willBreakToday = true
        // Will break at midnight tonight
        const midnight = new Date(today)
        midnight.setDate(midnight.getDate() + 1)
        hoursUntilBreak = Math.max(0, (midnight.getTime() - now.getTime()) / (1000 * 60 * 60))
      }
      // If daysDiff > 1, streak is already broken
    }

    // Calculate next milestone
    const currentStreak = isActive ? xpRecord.currentStreak : 0
    const { nextMilestone, daysToNextMilestone } = this.getNextMilestone(currentStreak)

    // Get current streak bonus
    const streakBonus = this.getStreakBonus(currentStreak)

    return {
      currentStreak,
      lastActivityDate: xpRecord.lastActivityDate,
      isActive,
      willBreakToday,
      hoursUntilBreak: Math.round(hoursUntilBreak),
      nextMilestone,
      daysToNextMilestone,
      streakBonus,
      bestStreak: xpRecord.bestStreak || 0,
      totalBrokenStreaks: xpRecord.streakBrokenCount || 0
    }
  }

  /**
   * Reset streak for an account (manual or automatic)
   */
  static async resetStreak(mlAccountId: string, reason: string = 'manual'): Promise<void> {
    const xpRecord = await prisma.mLAccountXP.findUnique({
      where: { mlAccountId }
    })

    if (!xpRecord) return

    await prisma.mLAccountXP.update({
      where: { mlAccountId },
      data: {
        currentStreak: 0,
        streakBrokenCount: (xpRecord.streakBrokenCount || 0) + 1
      }
    })

    logger.info('[Streak] Streak reset', {
      mlAccountId,
      previousStreak: xpRecord.currentStreak,
      reason
    })
  }

  /**
   * Run daily job to check and break expired streaks
   * Should be called via cron at 00:05
   */
  static async runDailyStreakCheck(): Promise<{
    checked: number
    broken: number
  }> {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    // Find accounts with activity before yesterday (streak should be broken)
    const expiredStreaks = await prisma.mLAccountXP.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastActivityDate: { lt: yesterday }
      }
    })

    let broken = 0

    for (const record of expiredStreaks) {
      await prisma.mLAccountXP.update({
        where: { mlAccountId: record.mlAccountId },
        data: {
          currentStreak: 0,
          streakBrokenCount: (record.streakBrokenCount || 0) + 1
        }
      })
      broken++
    }

    logger.info('[Streak] Daily check completed', {
      checked: expiredStreaks.length,
      broken
    })

    return {
      checked: expiredStreaks.length,
      broken
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Get date without time component
   */
  private static getDateOnly(date: Date): Date {
    const result = new Date(date)
    result.setHours(0, 0, 0, 0)
    return result
  }

  /**
   * Check if two dates are the same day
   */
  private static isSameDay(date1: Date, date2: Date): boolean {
    return date1.getTime() === date2.getTime()
  }

  /**
   * Get difference in days between two dates
   */
  private static getDaysDifference(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime())
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Get streak bonus for current streak
   */
  static getStreakBonus(streak: number): number {
    if (streak < 3) return 0

    const thresholds = Object.keys(STREAK_BONUSES)
      .map(Number)
      .sort((a, b) => b - a)

    for (const threshold of thresholds) {
      if (streak >= threshold) {
        return STREAK_BONUSES[threshold] ?? 0
      }
    }

    return 0
  }

  /**
   * Get milestone bonus if a new milestone was reached
   */
  private static getMilestoneBonus(newStreak: number, previousStreak: number): number {
    const milestones = Object.keys(STREAK_BONUSES).map(Number).sort((a, b) => a - b)

    for (const milestone of milestones) {
      if (newStreak >= milestone && previousStreak < milestone) {
        return STREAK_BONUSES[milestone] ?? 0
      }
    }

    return 0
  }

  /**
   * Get next milestone and days until it
   */
  private static getNextMilestone(currentStreak: number): {
    nextMilestone: number | null
    daysToNextMilestone: number
  } {
    const milestones = Object.keys(STREAK_BONUSES).map(Number).sort((a, b) => a - b)

    for (const milestone of milestones) {
      if (currentStreak < milestone) {
        return {
          nextMilestone: milestone,
          daysToNextMilestone: milestone - currentStreak
        }
      }
    }

    // Already at max milestone
    return {
      nextMilestone: null,
      daysToNextMilestone: 0
    }
  }

  /**
   * Get all milestones with their bonuses
   */
  static getAllMilestones(): Array<{ days: number; bonus: number; reached: boolean }> {
    return Object.entries(STREAK_BONUSES).map(([days, bonus]) => ({
      days: Number(days),
      bonus,
      reached: false // Will be updated based on current streak
    }))
  }

  /**
   * Format streak status for display
   */
  static formatStreakDisplay(status: StreakStatus): {
    emoji: string
    label: string
    color: string
    urgency: 'none' | 'low' | 'high'
  } {
    if (!status.isActive || status.currentStreak === 0) {
      return {
        emoji: '💔',
        label: 'Sem streak',
        color: 'gray',
        urgency: 'none'
      }
    }

    if (status.willBreakToday) {
      return {
        emoji: '⚠️',
        label: `${status.currentStreak} dias - Responda hoje!`,
        color: 'red',
        urgency: 'high'
      }
    }

    if (status.hoursUntilBreak < 24) {
      return {
        emoji: '🔥',
        label: `${status.currentStreak} dias`,
        color: 'orange',
        urgency: 'low'
      }
    }

    return {
      emoji: '🔥',
      label: `${status.currentStreak} dias`,
      color: 'green',
      urgency: 'none'
    }
  }
}

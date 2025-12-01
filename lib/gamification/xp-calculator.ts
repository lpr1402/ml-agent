/**
 * XP CALCULATOR ENGINE 2.0
 * Sistema de calculo de experiencia - "Velocidade e Rei"
 *
 * Multiplicadores agressivos por velocidade:
 * - S tier (< 2 min) = 5.0x LIGHTNING
 * - A tier (< 5 min) = 3.0x ULTRA-RAPIDA
 * - B tier (< 10 min) = 2.0x RAPIDA
 * - C tier (< 15 min) = 1.5x BOA
 * - D tier (< 30 min) = 1.0x NORMAL
 * - E tier (< 60 min) = 0.5x LENTA
 * - F tier (> 60 min) = 0.25x MUITO LENTA
 */

import { logger } from '@/lib/logger'
import { getCharacterByLevel } from './characters-data'

// ========== TYPES ==========

export type SpeedTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface XPCalculationInput {
  questionId: string
  mlAccountId: string
  responseTimeMinutes: number
  firstApproval: boolean
  answerLength: number
  timestamp: Date
  currentStreak?: number
  currentLevel?: number
}

export interface XPBreakdown {
  // Base and speed
  baseXP: number
  speedMultiplier: number
  speedXP: number
  speedTier: SpeedTier
  speedLabel: string

  // Bonuses
  qualityBonus: number
  qualityDetails: string[]
  streakBonus: number
  streakDays: number
  scheduleBonus: number
  scheduleLabel: string | null

  // Character
  characterMultiplier: number
  characterName: string
  characterAvatarSeed: string

  // Totals
  subtotal: number
  total: number
}

export interface XPCalculationResult {
  xpAwarded: number
  breakdown: XPBreakdown
  actionType: string
  actionDescription: string
  isLightning: boolean
  isUltraFast: boolean
}

// ========== CONFIGURATION ==========

// Base XP for any approved response
const BASE_XP = 50

// Speed tiers with multipliers - "Velocidade e Rei"
export const SPEED_TIERS = [
  { tier: 'S' as SpeedTier, maxMinutes: 2, multiplier: 5.0, label: 'LIGHTNING', emoji: '⚡', color: 'yellow-400' },
  { tier: 'A' as SpeedTier, maxMinutes: 5, multiplier: 3.0, label: 'ULTRA-RAPIDA', emoji: '🚀', color: 'orange-400' },
  { tier: 'B' as SpeedTier, maxMinutes: 10, multiplier: 2.0, label: 'RAPIDA', emoji: '💨', color: 'green-400' },
  { tier: 'C' as SpeedTier, maxMinutes: 15, multiplier: 1.5, label: 'BOA', emoji: '👍', color: 'blue-400' },
  { tier: 'D' as SpeedTier, maxMinutes: 30, multiplier: 1.0, label: 'NORMAL', emoji: '✓', color: 'gray-400' },
  { tier: 'E' as SpeedTier, maxMinutes: 60, multiplier: 0.5, label: 'LENTA', emoji: '🐢', color: 'gray-500' },
  { tier: 'F' as SpeedTier, maxMinutes: Infinity, multiplier: 0.25, label: 'MUITO LENTA', emoji: '💤', color: 'gray-600' }
]

// Quality bonuses
export const QUALITY_BONUSES = {
  FIRST_APPROVAL: { xp: 30, label: 'Primeira Aprovacao' },
  COMPLETE_ANSWER: { xp: 25, label: 'Resposta Completa (200+ chars)' },
  PERFECT_ANSWER: { xp: 50, label: 'Resposta Perfeita (300+ chars)' }
}

// Progressive streak bonuses (aggressive - breaks after 1 day)
export const STREAK_BONUSES: Record<number, number> = {
  3: 50,
  7: 150,
  14: 400,
  30: 1000,
  60: 2500,
  90: 5000,
  180: 12000,
  365: 30000
}

// Schedule bonuses for dedication
export const SCHEDULE_BONUSES = {
  LATE_NIGHT: { xp: 30, label: 'Coruja da Madrugada', hours: [0, 1, 2, 3, 4, 5] },
  EARLY_BIRD: { xp: 15, label: 'Passaro Madrugador', hours: [6, 7] },
  NIGHT_OWL: { xp: 15, label: 'Noturno', hours: [22, 23] }
}

// Milestone bonuses
export const MILESTONE_BONUSES = {
  FIRST_OF_DAY: 100,
  TENTH_OF_DAY: 200,
  FIFTIETH_OF_WEEK: 500
}

// ========== XP CALCULATOR ==========

export class XPCalculator {
  /**
   * Main XP calculation with full breakdown
   */
  static calculate(input: XPCalculationInput): XPCalculationResult {
    const breakdown = this.calculateBreakdown(input)

    // Determine action type and description
    const { actionType, actionDescription } = this.getActionDetails(input, breakdown)

    logger.info('[XP Calculator 2.0] XP calculated', {
      mlAccountId: input.mlAccountId,
      questionId: input.questionId,
      responseTime: `${input.responseTimeMinutes}min`,
      speedTier: breakdown.speedTier,
      xpAwarded: breakdown.total,
      breakdown
    })

    return {
      xpAwarded: breakdown.total,
      breakdown,
      actionType,
      actionDescription,
      isLightning: breakdown.speedTier === 'S',
      isUltraFast: breakdown.speedTier === 'A'
    }
  }

  /**
   * Calculate detailed XP breakdown
   */
  private static calculateBreakdown(input: XPCalculationInput): XPBreakdown {
    // 1. Get speed tier and calculate speed XP
    const speedConfig = this.getSpeedTier(input.responseTimeMinutes)
    const speedXP = Math.round(BASE_XP * speedConfig.multiplier)

    // 2. Quality bonuses
    const { qualityBonus, qualityDetails } = this.calculateQualityBonus(input)

    // 3. Streak bonus
    const { streakBonus, streakDays } = this.calculateStreakBonus(input.currentStreak || 0)

    // 4. Schedule bonus
    const { scheduleBonus, scheduleLabel } = this.calculateScheduleBonus(input.timestamp)

    // 5. Character multiplier
    const character = input.currentLevel ? getCharacterByLevel(input.currentLevel) : null
    const characterMultiplier = character?.xpMultiplier || 1.0

    // 6. Calculate totals
    const subtotal = speedXP + qualityBonus + streakBonus + scheduleBonus
    const total = Math.round(subtotal * characterMultiplier)

    return {
      baseXP: BASE_XP,
      speedMultiplier: speedConfig.multiplier,
      speedXP,
      speedTier: speedConfig.tier,
      speedLabel: speedConfig.label,
      qualityBonus,
      qualityDetails,
      streakBonus,
      streakDays,
      scheduleBonus,
      scheduleLabel,
      characterMultiplier,
      characterName: character?.name || 'Iniciante',
      characterAvatarSeed: character?.avatarSeed || 'mlagent-rookie-starter-v1',
      subtotal,
      total
    }
  }

  /**
   * Get speed tier configuration by response time
   */
  static getSpeedTier(minutes: number): typeof SPEED_TIERS[0] {
    const tier = SPEED_TIERS.find(t => minutes <= t.maxMinutes)
    return tier || SPEED_TIERS[SPEED_TIERS.length - 1]!
  }

  /**
   * Calculate quality bonuses based on answer quality
   */
  private static calculateQualityBonus(input: XPCalculationInput): { qualityBonus: number; qualityDetails: string[] } {
    let bonus = 0
    const details: string[] = []

    // First approval bonus
    if (input.firstApproval) {
      bonus += QUALITY_BONUSES.FIRST_APPROVAL.xp
      details.push(QUALITY_BONUSES.FIRST_APPROVAL.label)
    }

    // Answer length bonuses (only one applies)
    if (input.answerLength >= 300) {
      bonus += QUALITY_BONUSES.PERFECT_ANSWER.xp
      details.push(QUALITY_BONUSES.PERFECT_ANSWER.label)
    } else if (input.answerLength >= 200) {
      bonus += QUALITY_BONUSES.COMPLETE_ANSWER.xp
      details.push(QUALITY_BONUSES.COMPLETE_ANSWER.label)
    }

    return { qualityBonus: bonus, qualityDetails: details }
  }

  /**
   * Calculate streak bonus based on current consecutive days
   */
  private static calculateStreakBonus(currentStreak: number): { streakBonus: number; streakDays: number } {
    if (currentStreak < 3) {
      return { streakBonus: 0, streakDays: currentStreak }
    }

    // Find the highest applicable streak bonus
    const streakThresholds = Object.keys(STREAK_BONUSES)
      .map(Number)
      .sort((a, b) => b - a)

    for (const threshold of streakThresholds) {
      if (currentStreak >= threshold) {
        const bonus = STREAK_BONUSES[threshold]
        return { streakBonus: bonus ?? 0, streakDays: currentStreak }
      }
    }

    return { streakBonus: 0, streakDays: currentStreak }
  }

  /**
   * Calculate schedule bonus for special hours
   */
  private static calculateScheduleBonus(timestamp: Date): { scheduleBonus: number; scheduleLabel: string | null } {
    const hour = timestamp.getHours()

    if (SCHEDULE_BONUSES.LATE_NIGHT.hours.includes(hour)) {
      return { scheduleBonus: SCHEDULE_BONUSES.LATE_NIGHT.xp, scheduleLabel: SCHEDULE_BONUSES.LATE_NIGHT.label }
    }

    if (SCHEDULE_BONUSES.EARLY_BIRD.hours.includes(hour)) {
      return { scheduleBonus: SCHEDULE_BONUSES.EARLY_BIRD.xp, scheduleLabel: SCHEDULE_BONUSES.EARLY_BIRD.label }
    }

    if (SCHEDULE_BONUSES.NIGHT_OWL.hours.includes(hour)) {
      return { scheduleBonus: SCHEDULE_BONUSES.NIGHT_OWL.xp, scheduleLabel: SCHEDULE_BONUSES.NIGHT_OWL.label }
    }

    return { scheduleBonus: 0, scheduleLabel: null }
  }

  /**
   * Get action type and description for the response
   */
  private static getActionDetails(input: XPCalculationInput, breakdown: XPBreakdown): { actionType: string; actionDescription: string } {
    let actionType = 'response'
    let actionDescription = ''

    // Determine action type based on speed tier
    switch (breakdown.speedTier) {
      case 'S':
        actionType = 'lightning_response'
        actionDescription = `LIGHTNING ${Math.floor(input.responseTimeMinutes * 60)}s`
        break
      case 'A':
        actionType = 'ultra_fast_response'
        actionDescription = `Ultra-Rapida em ${input.responseTimeMinutes.toFixed(1)} min`
        break
      case 'B':
        actionType = 'fast_response'
        actionDescription = `Rapida em ${input.responseTimeMinutes.toFixed(0)} min`
        break
      case 'C':
        actionType = 'good_response'
        actionDescription = `Boa em ${input.responseTimeMinutes.toFixed(0)} min`
        break
      case 'D':
        actionType = 'normal_response'
        actionDescription = `Normal em ${input.responseTimeMinutes.toFixed(0)} min`
        break
      default:
        actionType = 'slow_response'
        actionDescription = `Resposta em ${input.responseTimeMinutes.toFixed(0)} min`
    }

    // Add quality indicators
    if (input.firstApproval) {
      actionDescription += ' | Primeira Aprovacao'
    }

    return { actionType, actionDescription }
  }

  /**
   * Calculate milestone bonus for special achievements
   */
  static calculateMilestoneBonus(
    answeredToday: number,
    answeredThisWeek: number
  ): { xp: number; description: string } | null {
    if (answeredToday === 1) {
      return { xp: MILESTONE_BONUSES.FIRST_OF_DAY, description: 'Primeira Resposta do Dia' }
    }

    if (answeredToday === 10) {
      return { xp: MILESTONE_BONUSES.TENTH_OF_DAY, description: '10a Resposta do Dia' }
    }

    if (answeredThisWeek === 50) {
      return { xp: MILESTONE_BONUSES.FIFTIETH_OF_WEEK, description: '50a Resposta da Semana' }
    }

    return null
  }

  /**
   * Get speed category for statistics
   */
  static getSpeedCategory(minutes: number): 'lightning' | 'ultra_fast' | 'fast' | 'normal' | 'slow' {
    if (minutes <= 2) return 'lightning'
    if (minutes <= 5) return 'ultra_fast'
    if (minutes <= 15) return 'fast'
    if (minutes <= 60) return 'normal'
    return 'slow'
  }

  /**
   * Format XP breakdown for display (used in modals)
   */
  static formatBreakdownForDisplay(breakdown: XPBreakdown): {
    lines: Array<{ icon: string; label: string; value: string; highlight?: boolean }>
    total: number
  } {
    const lines: Array<{ icon: string; label: string; value: string; highlight?: boolean }> = []

    // Speed line (always first and most important)
    const speedTierConfig = SPEED_TIERS.find(t => t.tier === breakdown.speedTier)
    lines.push({
      icon: speedTierConfig?.emoji || '✓',
      label: `VELOCIDADE (${breakdown.speedMultiplier}x)`,
      value: `${BASE_XP} -> ${breakdown.speedXP} XP`,
      highlight: breakdown.speedTier === 'S' || breakdown.speedTier === 'A'
    })

    // Quality bonuses
    if (breakdown.qualityBonus > 0) {
      lines.push({
        icon: '✨',
        label: 'QUALIDADE',
        value: `+${breakdown.qualityBonus} XP`
      })
    }

    // Streak bonus
    if (breakdown.streakBonus > 0) {
      lines.push({
        icon: '🔥',
        label: `STREAK (${breakdown.streakDays} dias)`,
        value: `+${breakdown.streakBonus} XP`,
        highlight: true
      })
    }

    // Schedule bonus
    if (breakdown.scheduleBonus > 0) {
      lines.push({
        icon: '🌙',
        label: breakdown.scheduleLabel || 'HORARIO',
        value: `+${breakdown.scheduleBonus} XP`
      })
    }

    // Character multiplier
    if (breakdown.characterMultiplier > 1.0) {
      lines.push({
        icon: '★',
        label: `BONUS ${breakdown.characterName.toUpperCase()}`,
        value: `x${breakdown.characterMultiplier.toFixed(2)}`,
        highlight: true
      })
    }

    return { lines, total: breakdown.total }
  }
}

// ========== EXPORTS ==========

export const XP_CONFIG = {
  BASE_XP,
  SPEED_TIERS,
  QUALITY_BONUSES,
  STREAK_BONUSES,
  SCHEDULE_BONUSES,
  MILESTONE_BONUSES
}

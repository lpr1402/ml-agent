/**
 * 🎮 XP CALCULATOR ENGINE
 * Sistema de cálculo de experiência para motivar vendedores
 * Enterprise-grade com sistema de pontos progressivo e cativante
 */

import { logger } from '@/lib/logger'

// ========== INTERFACES ==========

export interface XPCalculationInput {
  questionId: string
  mlAccountId: string
  responseTimeMinutes: number
  firstApproval: boolean // Aprovado sem revisão
  answerLength: number
  timestamp: Date
}

export interface XPBreakdown {
  baseXP: number
  timeBonus: number
  qualityBonus: number
  streakBonus: number
  scheduleBonus: number
  multiplier: number
  total: number
}

export interface XPCalculationResult {
  xpAwarded: number
  breakdown: XPBreakdown
  actionType: string
  actionDescription: string
}

// ========== CONFIGURAÇÃO DO SISTEMA DE XP ==========

/**
 * 🔥 SISTEMA DE PONTOS CATIVANTE
 *
 * Filosofia: Recompensar velocidade e qualidade
 * - Respostas ultra-rápidas (< 5 min) = DOBRO de XP
 * - Combos e sequências = XP multiplicado
 * - Horários especiais = Bônus extra
 */

// 🎯 XP Base por tempo de resposta (progressivo e motivador)
const XP_BY_RESPONSE_TIME = [
  { maxMinutes: 5, xp: 150, label: 'Ultrarrápida', multiplier: 2.0 },  // DOBRO!
  { maxMinutes: 15, xp: 75, label: 'Velocista', multiplier: 1.0 },
  { maxMinutes: 30, xp: 50, label: 'Rápida', multiplier: 1.0 },
  { maxMinutes: 60, xp: 30, label: 'Normal', multiplier: 1.0 },
  { maxMinutes: 120, xp: 15, label: 'Aceitável', multiplier: 1.0 },
  { maxMinutes: Infinity, xp: 10, label: 'Básica', multiplier: 1.0 }
]

// ✨ Bônus de Qualidade
const QUALITY_BONUSES = {
  FIRST_APPROVAL: 50,      // Aprovado sem revisão
  COMPLETE_ANSWER: 25,     // > 100 caracteres
  DETAILED_ANSWER: 50      // > 200 caracteres
}

// 🔥 Bônus de Sequência (COMBOS VICIANTES!)
const STREAK_BONUSES = {
  3: 75,    // 3 seguidas
  5: 150,   // 5 seguidas
  10: 300,  // 10 seguidas
  20: 750   // 20 seguidas
}

// ⏰ Bônus de Horário Especial (dedicação)
const SCHEDULE_BONUSES = {
  LATE_NIGHT: 50,      // 00h-06h (madrugada)
  EARLY_BIRD: 25,      // 06h-08h (café da manhã)
  NIGHT: 25            // 22h-00h (noite)
}

// 📅 Multiplicadores Especiais
const SPECIAL_MULTIPLIERS = {
  WEEKEND: 1.5,        // Sábado e domingo
  FIRST_OF_DAY: 100,   // Primeira resposta do dia (bonus fixo)
  TENTH_OF_DAY: 200,   // 10ª resposta do dia
  FIFTIETH_OF_WEEK: 500 // 50ª resposta da semana
}

// ========== XP CALCULATOR ==========

export class XPCalculator {
  /**
   * Calcula XP total para uma ação de resposta
   */
  static calculate(input: XPCalculationInput): XPCalculationResult {
    const breakdown: XPBreakdown = {
      baseXP: 0,
      timeBonus: 0,
      qualityBonus: 0,
      streakBonus: 0,
      scheduleBonus: 0,
      multiplier: 1.0,
      total: 0
    }

    // 1️⃣ XP BASE (por tempo de resposta)
    const timeConfig = XP_BY_RESPONSE_TIME.find(
      config => input.responseTimeMinutes <= config.maxMinutes
    )

    if (timeConfig) {
      breakdown.baseXP = timeConfig.xp
      breakdown.multiplier = timeConfig.multiplier
    }

    // 2️⃣ BÔNUS DE QUALIDADE
    if (input.firstApproval) {
      breakdown.qualityBonus += QUALITY_BONUSES.FIRST_APPROVAL
    }

    if (input.answerLength >= 200) {
      breakdown.qualityBonus += QUALITY_BONUSES.DETAILED_ANSWER
    } else if (input.answerLength >= 100) {
      breakdown.qualityBonus += QUALITY_BONUSES.COMPLETE_ANSWER
    }

    // 3️⃣ BÔNUS DE HORÁRIO ESPECIAL
    const hour = input.timestamp.getHours()

    if (hour >= 0 && hour < 6) {
      // Madrugada (00h-06h)
      breakdown.scheduleBonus += SCHEDULE_BONUSES.LATE_NIGHT
    } else if (hour >= 6 && hour < 8) {
      // Café da manhã (06h-08h)
      breakdown.scheduleBonus += SCHEDULE_BONUSES.EARLY_BIRD
    } else if (hour >= 22) {
      // Noite (22h-00h)
      breakdown.scheduleBonus += SCHEDULE_BONUSES.NIGHT
    }

    // 4️⃣ MULTIPLICADOR DE FIM DE SEMANA
    const dayOfWeek = input.timestamp.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (isWeekend) {
      breakdown.multiplier = SPECIAL_MULTIPLIERS.WEEKEND
    }

    // 5️⃣ CÁLCULO TOTAL
    const subtotal = breakdown.baseXP + breakdown.qualityBonus + breakdown.scheduleBonus
    breakdown.total = Math.round(subtotal * breakdown.multiplier)

    // Determinar tipo e descrição da ação
    let actionType = 'response'
    let actionDescription = 'Resposta enviada'

    if (input.responseTimeMinutes <= 5) {
      actionType = 'ultra_fast'
      actionDescription = `Resposta Ultrarrápida em ${input.responseTimeMinutes} min`
    } else if (input.responseTimeMinutes <= 15) {
      actionType = 'fast_response'
      actionDescription = `Resposta Velocista em ${input.responseTimeMinutes} min`
    } else if (input.responseTimeMinutes <= 30) {
      actionType = 'quick_response'
      actionDescription = `Resposta Rápida em ${input.responseTimeMinutes} min`
    } else {
      actionDescription = `Resposta em ${input.responseTimeMinutes} min`
    }

    if (input.firstApproval) {
      actionDescription += ' - Primeira Aprovação'
    }

    logger.info('[XP Calculator] XP calculated', {
      mlAccountId: input.mlAccountId,
      questionId: input.questionId,
      xpAwarded: breakdown.total,
      breakdown
    })

    return {
      xpAwarded: breakdown.total,
      breakdown,
      actionType,
      actionDescription
    }
  }

  /**
   * Calcula bônus de streak (sequência)
   */
  static calculateStreakBonus(currentStreak: number): number {
    // Verifica qual o maior streak bônus aplicável
    const streakKeys = Object.keys(STREAK_BONUSES)
      .map(Number)
      .sort((a, b) => b - a)

    for (const streakTarget of streakKeys) {
      if (currentStreak === streakTarget) {
        return STREAK_BONUSES[streakTarget as keyof typeof STREAK_BONUSES]
      }
    }

    return 0
  }

  /**
   * Calcula XP para milestone (primeira do dia, 10ª, etc)
   */
  static calculateMilestoneBonus(
    answeredToday: number,
    answeredThisWeek: number
  ): { xp: number; description: string } | null {
    if (answeredToday === 1) {
      return {
        xp: SPECIAL_MULTIPLIERS.FIRST_OF_DAY,
        description: 'Primeira Resposta do Dia'
      }
    }

    if (answeredToday === 10) {
      return {
        xp: SPECIAL_MULTIPLIERS.TENTH_OF_DAY,
        description: '10ª Resposta do Dia'
      }
    }

    if (answeredThisWeek === 50) {
      return {
        xp: SPECIAL_MULTIPLIERS.FIFTIETH_OF_WEEK,
        description: '50ª Resposta da Semana'
      }
    }

    return null
  }

  /**
   * Determina categoria de velocidade para stats
   */
  static getSpeedCategory(minutes: number): 'ultra_fast' | 'fast' | 'normal' | 'slow' {
    if (minutes <= 5) return 'ultra_fast'
    if (minutes <= 30) return 'fast'
    if (minutes <= 60) return 'normal'
    return 'slow'
  }
}

// ========== CONSTANTS EXPORT ==========

export const XP_CONFIG = {
  BY_RESPONSE_TIME: XP_BY_RESPONSE_TIME,
  QUALITY_BONUSES,
  STREAK_BONUSES,
  SCHEDULE_BONUSES,
  SPECIAL_MULTIPLIERS
}

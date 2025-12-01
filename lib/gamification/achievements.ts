/**
 * ACHIEVEMENT SYSTEM 2.0
 * 6 tipos de conquistas, cada uma com 10 niveis progressivos
 * Total: 60 conquistas possiveis
 *
 * Tipos:
 * - LIGHTNING: Respostas < 2 min (5x XP)
 * - SPEED: Respostas < 5 min (3x XP)
 * - STREAK: Dias consecutivos
 * - VOLUME: Total de perguntas
 * - QUALITY: Primeira aprovacao
 * - DEDICATION: Horarios especiais
 */

import { logger } from '@/lib/logger'

// ========== TYPES ==========

export type AchievementCategory = 'lightning' | 'speed' | 'streak' | 'volume' | 'quality' | 'dedication'

export type AchievementRarity =
  | 'common'      // Tier 1-2
  | 'uncommon'    // Tier 3-4
  | 'rare'        // Tier 5-6
  | 'epic'        // Tier 7-8
  | 'legendary'   // Tier 9
  | 'mythic'      // Tier 10

export interface AchievementDefinition {
  id: string
  type: AchievementCategory
  tier: number
  tierName: string
  title: string
  description: string
  emoji: string
  target: number
  xpReward: number
  rarity: AchievementRarity
  color: string
  tips: string[]
}

export interface AchievementProgress {
  achievementId: string
  progress: number
  total: number
  percent: number
  unlocked: boolean
  unlockedAt: string | null
  currentTier: number
  nextTier: AchievementDefinition | null
  definition: AchievementDefinition
}

export interface AchievementCheckResult {
  newlyUnlocked: AchievementDefinition[]
  totalXPRewarded: number
}

export interface AchievementStats {
  lightningCount: number    // < 2 min
  ultraFastCount: number    // < 5 min
  fastResponsesCount: number // < 10 min (not used for achievements, just stats)
  currentStreak: number
  bestStreak: number
  questionsAnswered: number
  firstApprovalCount: number
  earlyBirdCount: number
  lateNightCount: number
}

// ========== TIER CONFIGURATION ==========

const TIER_CONFIG = [
  { tier: 1, name: 'Bronze', rarity: 'common' as AchievementRarity, color: 'from-amber-700 to-amber-800' },
  { tier: 2, name: 'Prata', rarity: 'common' as AchievementRarity, color: 'from-slate-400 to-slate-500' },
  { tier: 3, name: 'Ouro', rarity: 'uncommon' as AchievementRarity, color: 'from-yellow-500 to-yellow-600' },
  { tier: 4, name: 'Platina', rarity: 'uncommon' as AchievementRarity, color: 'from-cyan-400 to-cyan-500' },
  { tier: 5, name: 'Diamante', rarity: 'rare' as AchievementRarity, color: 'from-purple-400 to-purple-500' },
  { tier: 6, name: 'Mestre', rarity: 'rare' as AchievementRarity, color: 'from-red-500 to-red-600' },
  { tier: 7, name: 'GrandMestre', rarity: 'epic' as AchievementRarity, color: 'from-pink-500 to-pink-600' },
  { tier: 8, name: 'Lenda', rarity: 'epic' as AchievementRarity, color: 'from-orange-500 to-orange-600' },
  { tier: 9, name: 'Mitico', rarity: 'legendary' as AchievementRarity, color: 'from-indigo-500 to-indigo-600' },
  { tier: 10, name: 'GOAT', rarity: 'mythic' as AchievementRarity, color: 'from-yellow-400 via-pink-500 to-purple-600' }
]

// ========== ACHIEVEMENT FACTORY ==========

function createAchievementTiers(
  type: AchievementCategory,
  baseName: string,
  baseDescription: string,
  emoji: string,
  targets: number[],
  rewards: number[],
  tips: string[]
): AchievementDefinition[] {
  return TIER_CONFIG.map((tier, index) => ({
    id: `${type}_tier_${tier.tier}`,
    type,
    tier: tier.tier,
    tierName: tier.name,
    title: `${baseName} ${tier.name}`,
    description: `${baseDescription} (${targets[index]?.toLocaleString() || 0})`,
    emoji,
    target: targets[index] || 0,
    xpReward: rewards[index] || 0,
    rarity: tier.rarity,
    color: tier.color,
    tips
  }))
}

// ========== ACHIEVEMENT DEFINITIONS ==========

// LIGHTNING: Respostas < 2 min (5x XP!) - A conquista mais valiosa
const LIGHTNING_ACHIEVEMENTS = createAchievementTiers(
  'lightning',
  'Lightning',
  'Respostas em menos de 2 minutos',
  '⚡',
  [5, 15, 30, 60, 100, 200, 350, 500, 750, 1000],
  [300, 600, 1000, 1500, 2500, 4000, 6000, 8000, 12000, 20000],
  [
    'Respostas Lightning ganham 5x XP!',
    'Ative notificacoes push com som',
    'Mantenha o app sempre aberto',
    'Use templates de resposta rapida',
    'Esta e a conquista mais valiosa!'
  ]
)

// SPEED: Respostas < 5 min (3x XP!)
const SPEED_ACHIEVEMENTS = createAchievementTiers(
  'speed',
  'Ultra Rapido',
  'Respostas em menos de 5 minutos',
  '🚀',
  [10, 30, 75, 150, 250, 400, 600, 900, 1200, 1500],
  [200, 400, 800, 1200, 2000, 3000, 4500, 6000, 9000, 15000],
  [
    'Respostas ultra-rapidas ganham 3x XP!',
    'Responda assim que receber a notificacao',
    'Use o ML Agent para sugestoes instantaneas',
    'Clientes valorizam respostas rapidas'
  ]
)

// STREAK: Dias consecutivos (agressivo - quebra apos 1 dia)
const STREAK_ACHIEVEMENTS = createAchievementTiers(
  'streak',
  'Streak Master',
  'Dias consecutivos de atividade',
  '🔥',
  [3, 7, 14, 30, 60, 90, 120, 180, 270, 365],
  [150, 400, 800, 1500, 3000, 5000, 7500, 12000, 18000, 30000],
  [
    'Um dia sem atividade quebra o streak!',
    'Responda pelo menos 1 pergunta por dia',
    'Streaks longos = bonus de XP massivos',
    'Consistencia e a chave do sucesso'
  ]
)

// VOLUME: Total de perguntas respondidas
const VOLUME_ACHIEVEMENTS = createAchievementTiers(
  'volume',
  'Contador',
  'Total de perguntas respondidas',
  '📊',
  [50, 150, 300, 500, 1000, 2000, 3500, 5000, 7500, 10000],
  [200, 500, 1000, 1800, 3000, 5000, 8000, 12000, 18000, 30000],
  [
    'Cada pergunta e uma oportunidade de venda',
    'Quantidade + Qualidade = Sucesso',
    'Voce esta construindo um imperio!',
    'Meta: 10.000 perguntas para GOAT'
  ]
)

// QUALITY: Primeira aprovacao (sem revisao)
const QUALITY_ACHIEVEMENTS = createAchievementTiers(
  'quality',
  'Qualidade Premium',
  'Respostas aprovadas na primeira tentativa',
  '✨',
  [25, 75, 150, 300, 500, 800, 1200, 2000, 3000, 4000],
  [150, 350, 700, 1200, 2000, 3500, 5500, 8000, 12000, 18000],
  [
    'O ML Agent ja sugere respostas excelentes',
    'Leia a pergunta com atencao',
    'Respostas completas evitam revisoes',
    'Qualidade > Quantidade'
  ]
)

// DEDICATION: Horarios especiais (madrugada + manha cedo)
const DEDICATION_ACHIEVEMENTS = createAchievementTiers(
  'dedication',
  'Dedicacao Total',
  'Respostas em horarios especiais',
  '🌙',
  [10, 30, 60, 100, 200, 350, 500, 700, 900, 1000],
  [150, 350, 700, 1200, 2000, 3500, 5500, 8000, 10000, 15000],
  [
    'Madrugada (00h-06h) e manha (06h-08h)',
    'Bonus de XP extra em cada resposta',
    'Clientes matinais valorizam dedicacao',
    'Mostre que voce esta sempre disponivel'
  ]
)

// ========== COMBINED ACHIEVEMENTS ==========

export const ACHIEVEMENTS: AchievementDefinition[] = [
  ...LIGHTNING_ACHIEVEMENTS,
  ...SPEED_ACHIEVEMENTS,
  ...STREAK_ACHIEVEMENTS,
  ...VOLUME_ACHIEVEMENTS,
  ...QUALITY_ACHIEVEMENTS,
  ...DEDICATION_ACHIEVEMENTS
]

// Map by ID for quick access
export const ACHIEVEMENTS_MAP = ACHIEVEMENTS.reduce((map, achievement) => {
  map[achievement.id] = achievement
  return map
}, {} as Record<string, AchievementDefinition>)

// Group by type
export const ACHIEVEMENTS_BY_TYPE = ACHIEVEMENTS.reduce((map, achievement) => {
  if (!map[achievement.type]) {
    map[achievement.type] = []
  }
  map[achievement.type].push(achievement)
  return map
}, {} as Record<AchievementCategory, AchievementDefinition[]>)

// ========== ACHIEVEMENT CHECKER ==========

export class AchievementChecker {
  /**
   * Check which achievements were unlocked based on stats
   */
  static checkUnlocked(
    stats: AchievementStats,
    currentAchievements: string[]
  ): AchievementCheckResult {
    const newlyUnlocked: AchievementDefinition[] = []
    let totalXPRewarded = 0

    for (const achievement of ACHIEVEMENTS) {
      // Already unlocked? Skip
      if (currentAchievements.includes(achievement.id)) {
        continue
      }

      // Check condition
      const unlocked = this.checkCondition(achievement, stats)

      if (unlocked) {
        newlyUnlocked.push(achievement)
        totalXPRewarded += achievement.xpReward

        logger.info('[Achievement 2.0] Unlocked!', {
          achievementId: achievement.id,
          title: achievement.title,
          tier: achievement.tierName,
          xpReward: achievement.xpReward
        })
      }
    }

    return { newlyUnlocked, totalXPRewarded }
  }

  /**
   * Check condition for a specific achievement
   */
  private static checkCondition(
    achievement: AchievementDefinition,
    stats: AchievementStats
  ): boolean {
    const checks: Record<AchievementCategory, () => boolean> = {
      lightning: () => stats.lightningCount >= achievement.target,
      speed: () => stats.ultraFastCount >= achievement.target,
      streak: () => stats.bestStreak >= achievement.target,
      volume: () => stats.questionsAnswered >= achievement.target,
      quality: () => stats.firstApprovalCount >= achievement.target,
      dedication: () => (stats.earlyBirdCount + stats.lateNightCount) >= achievement.target
    }

    const checker = checks[achievement.type]
    return checker ? checker() : false
  }

  /**
   * Calculate progress for all achievements
   */
  static calculateAllProgress(
    stats: AchievementStats,
    unlockedAchievements: Array<{ achievementType: string; unlockedAt: Date }>
  ): AchievementProgress[] {
    const unlockedIds = unlockedAchievements.map(a => a.achievementType)

    // Get current value for each type
    const statValues: Record<AchievementCategory, number> = {
      lightning: stats.lightningCount,
      speed: stats.ultraFastCount,
      streak: stats.bestStreak,
      volume: stats.questionsAnswered,
      quality: stats.firstApprovalCount,
      dedication: stats.earlyBirdCount + stats.lateNightCount
    }

    const progressList: AchievementProgress[] = []

    for (const achievement of ACHIEVEMENTS) {
      const progress = Math.min(statValues[achievement.type], achievement.target)
      const percent = Math.round((progress / achievement.target) * 100)
      const unlocked = unlockedIds.includes(achievement.id)
      const unlockedData = unlockedAchievements.find(a => a.achievementType === achievement.id)

      // Find next tier
      const sameTypeAchievements = ACHIEVEMENTS_BY_TYPE[achievement.type]
        ?.sort((a, b) => a.tier - b.tier) || []
      const currentIndex = sameTypeAchievements.findIndex(a => a.id === achievement.id)
      const nextTier = sameTypeAchievements[currentIndex + 1] || null

      progressList.push({
        achievementId: achievement.id,
        progress,
        total: achievement.target,
        percent,
        unlocked,
        unlockedAt: unlockedData ? unlockedData.unlockedAt.toISOString() : null,
        currentTier: achievement.tier,
        nextTier,
        definition: achievement
      })
    }

    // Sort: Not completed first (by progress desc), completed at the end
    return progressList.sort((a, b) => {
      // Completed always goes to the end
      if (a.unlocked && !b.unlocked) return 1
      if (!a.unlocked && b.unlocked) return -1

      // Both not completed: sort by percent descending
      if (!a.unlocked && !b.unlocked) {
        return b.percent - a.percent
      }

      // Both completed: sort by tier descending (higher tier = more impressive)
      return b.currentTier - a.currentTier
    })
  }

  /**
   * Get highest unlocked tier for each type
   */
  static getHighestTiers(
    unlockedAchievements: Array<{ achievementType: string }>
  ): Record<AchievementCategory, number> {
    const highest: Record<AchievementCategory, number> = {
      lightning: 0,
      speed: 0,
      streak: 0,
      volume: 0,
      quality: 0,
      dedication: 0
    }

    for (const { achievementType } of unlockedAchievements) {
      const achievement = ACHIEVEMENTS_MAP[achievementType]
      if (achievement && achievement.tier > highest[achievement.type]) {
        highest[achievement.type] = achievement.tier
      }
    }

    return highest
  }

  /**
   * Get next achievement to unlock for each type
   */
  static getNextAchievements(
    stats: AchievementStats,
    unlockedAchievements: string[]
  ): Record<AchievementCategory, AchievementProgress | null> {
    const next: Record<AchievementCategory, AchievementProgress | null> = {
      lightning: null,
      speed: null,
      streak: null,
      volume: null,
      quality: null,
      dedication: null
    }

    const statValues: Record<AchievementCategory, number> = {
      lightning: stats.lightningCount,
      speed: stats.ultraFastCount,
      streak: stats.bestStreak,
      volume: stats.questionsAnswered,
      quality: stats.firstApprovalCount,
      dedication: stats.earlyBirdCount + stats.lateNightCount
    }

    for (const type of Object.keys(ACHIEVEMENTS_BY_TYPE) as AchievementCategory[]) {
      const typeAchievements = ACHIEVEMENTS_BY_TYPE[type]?.sort((a, b) => a.tier - b.tier) || []

      // Find first not unlocked
      for (const achievement of typeAchievements) {
        if (!unlockedAchievements.includes(achievement.id)) {
          const progress = Math.min(statValues[type], achievement.target)
          const percent = Math.round((progress / achievement.target) * 100)

          next[type] = {
            achievementId: achievement.id,
            progress,
            total: achievement.target,
            percent,
            unlocked: false,
            unlockedAt: null,
            currentTier: achievement.tier,
            nextTier: typeAchievements[achievement.tier] || null,
            definition: achievement
          }
          break
        }
      }
    }

    return next
  }
}

// ========== STATISTICS ==========

export const ACHIEVEMENT_STATS = {
  totalAchievements: 60,
  categories: 6,
  tiersPerCategory: 10,
  maxTotalXP: ACHIEVEMENTS.reduce((sum, a) => sum + a.xpReward, 0),
  tierNames: TIER_CONFIG.map(t => t.name)
}

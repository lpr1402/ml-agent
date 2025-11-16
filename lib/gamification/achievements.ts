/**
 * 🏆 ACHIEVEMENT SYSTEM - MULTI-LEVEL
 * 6 tipos de conquistas, cada uma com 5 níveis progressivos
 * Total: 30 conquistas possíveis
 */

import { logger } from '@/lib/logger'

// ========== INTERFACES ==========

export interface AchievementDefinition {
  id: string
  type: string // Tipo base (speed, streak, quality, etc)
  tier: number // Nível da conquista (1-5)
  tierName: string // Bronze, Prata, Ouro, Platina, Diamante
  title: string
  description: string
  iconType: string
  target: number
  xpReward: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
  color: string
  category: 'speed' | 'milestone' | 'quality' | 'dedication' | 'consistency'
  tips: string[] // Dicas para alcançar
}

export interface AchievementProgress {
  achievementId: string
  progress: number
  total: number
  unlocked: boolean
  unlockedAt: string | null
  currentTier: number
  nextTier: AchievementDefinition | null
}

export interface AchievementCheckResult {
  newlyUnlocked: AchievementDefinition[]
  totalXPRewarded: number
}

// ========== CONQUISTAS MULTI-LEVEL ==========

const createAchievementTiers = (
  baseType: string,
  baseIcon: string,
  category: string,
  baseName: string,
  baseDescription: string,
  targets: number[],
  rewards: number[],
  baseTips: string[]
): AchievementDefinition[] => {
  const tiers = [
    { tier: 1, tierName: 'Bronze', rarity: 'common' as const, color: 'from-amber-700 via-orange-600 to-amber-800' },
    { tier: 2, tierName: 'Prata', rarity: 'rare' as const, color: 'from-slate-300 via-gray-200 to-slate-400' },
    { tier: 3, tierName: 'Ouro', rarity: 'epic' as const, color: 'from-gold via-gold-light to-gold' },
    { tier: 4, tierName: 'Platina', rarity: 'legendary' as const, color: 'from-cyan-300 via-blue-400 to-cyan-500' },
    { tier: 5, tierName: 'Diamante', rarity: 'mythic' as const, color: 'from-purple-400 via-pink-400 to-purple-500' }
  ]

  return tiers.map((tier, index) => ({
    id: `${baseType}_tier_${tier.tier}`,
    type: baseType,
    tier: tier.tier,
    tierName: tier.tierName,
    title: `${baseName} ${tier.tierName}`,
    description: `${baseDescription} (${targets[index] || 0} vezes)`,
    iconType: baseIcon,
    target: targets[index] || 0,
    xpReward: rewards[index] || 0,
    rarity: tier.rarity,
    color: tier.color,
    category: category as any,
    tips: baseTips
  }))
}

// Velocista (Respostas < 30 min)
const SPEED_ACHIEVEMENTS = createAchievementTiers(
  'speed',
  'speed',
  'speed',
  'Velocista',
  'Responda perguntas em menos de 30 minutos',
  [10, 50, 100, 200, 500],
  [100, 300, 750, 2000, 5000],
  [
    'Ative notificações push para não perder perguntas',
    'Mantenha templates de respostas prontos',
    'Responda assim que receber a notificação',
    'Use o ML Agent para sugestões instantâneas'
  ]
)

// Ultra Velocista (Respostas < 5 min - DOBRO XP!)
const ULTRA_SPEED_ACHIEVEMENTS = createAchievementTiers(
  'ultra_speed',
  'speed',
  'speed',
  'Flash',
  'Responda perguntas em menos de 5 minutos',
  [5, 25, 50, 100, 250],
  [200, 500, 1200, 3000, 7500],
  [
    'Esta é a conquista mais valiosa! DOBRO de XP',
    'Ative som das notificações',
    'Tenha o app sempre aberto',
    'Respostas rápidas = clientes felizes = mais vendas!'
  ]
)

// Sequência (Streaks)
const STREAK_ACHIEVEMENTS = createAchievementTiers(
  'streak',
  'streak',
  'dedication',
  'Combo Master',
  'Mantenha sequência de respostas seguidas',
  [5, 10, 20, 50, 100],
  [150, 400, 1000, 2500, 6000],
  [
    'Responda todas as perguntas do dia',
    'Não deixe perguntas acumularem',
    'Streaks maiores = XP multiplicado!',
    'Uma resposta por dia mantém a sequência'
  ]
)

// Qualidade (Primeira aprovação)
const QUALITY_ACHIEVEMENTS = createAchievementTiers(
  'quality',
  'quality',
  'quality',
  'Qualidade Premium',
  'Respostas aprovadas na primeira tentativa',
  [20, 100, 200, 500, 1000],
  [100, 400, 1000, 2500, 6000],
  [
    'O ML Agent já sugere respostas excelentes',
    'Leia a pergunta com atenção',
    'Respostas completas evitam revisões',
    'Qualidade > Quantidade'
  ]
)

// Madrugador
const EARLY_BIRD_ACHIEVEMENTS = createAchievementTiers(
  'early_bird',
  'early_bird',
  'dedication',
  'Madrugador',
  'Responda perguntas antes das 8h',
  [5, 20, 50, 100, 200],
  [100, 350, 900, 2200, 5500],
  [
    'Comece o dia vendendo!',
    'Clientes matinais valorizam respostas rápidas',
    'Ganhe +25 XP de bônus em cada uma',
    'Defina um alarme para verificar perguntas'
  ]
)

// Milestone (Total de perguntas)
const MILESTONE_ACHIEVEMENTS = createAchievementTiers(
  'milestone',
  'milestone',
  'milestone',
  'Contador de Histórias',
  'Responda perguntas no total',
  [50, 200, 500, 1000, 2500],
  [200, 600, 1500, 4000, 10000],
  [
    'Cada pergunta é uma oportunidade de venda',
    'Consistência é a chave do sucesso',
    'Quanto mais perguntas, mais vendas',
    'Você está construindo um império!'
  ]
)

// Combinar todas as conquistas
export const ACHIEVEMENTS: AchievementDefinition[] = [
  ...ULTRA_SPEED_ACHIEVEMENTS,
  ...SPEED_ACHIEVEMENTS,
  ...STREAK_ACHIEVEMENTS,
  ...QUALITY_ACHIEVEMENTS,
  ...EARLY_BIRD_ACHIEVEMENTS,
  ...MILESTONE_ACHIEVEMENTS
]

// Mapa por ID para acesso rápido
export const ACHIEVEMENTS_MAP = ACHIEVEMENTS.reduce((map, achievement) => {
  map[achievement.id] = achievement
  return map
}, {} as Record<string, AchievementDefinition>)

// ========== ACHIEVEMENT CHECKER ==========

export class AchievementChecker {
  /**
   * Verifica quais achievements foram desbloqueados com base nas stats
   */
  static checkUnlocked(
    stats: {
      ultraFastCount: number
      fastResponsesCount: number
      questionsAnswered: number
      longestStreak: number
      firstApprovalCount: number
      earlyBirdCount: number
    },
    currentAchievements: string[] // IDs já desbloqueados
  ): AchievementCheckResult {
    const newlyUnlocked: AchievementDefinition[] = []
    let totalXPRewarded = 0

    // Verificar cada achievement
    for (const achievement of ACHIEVEMENTS) {
      // Já desbloqueado? Skip
      if (currentAchievements.includes(achievement.id)) {
        continue
      }

      // Verificar condição
      const unlocked = this.checkCondition(achievement, stats)

      if (unlocked) {
        newlyUnlocked.push(achievement)
        totalXPRewarded += achievement.xpReward

        logger.info('[Achievement] Unlocked!', {
          achievementId: achievement.id,
          title: achievement.title,
          tier: achievement.tierName,
          xpReward: achievement.xpReward
        })
      }
    }

    return {
      newlyUnlocked,
      totalXPRewarded
    }
  }

  /**
   * Verifica condição de um achievement específico
   */
  private static checkCondition(
    achievement: AchievementDefinition,
    stats: {
      ultraFastCount: number
      fastResponsesCount: number
      questionsAnswered: number
      longestStreak: number
      firstApprovalCount: number
      earlyBirdCount: number
    }
  ): boolean {
    const typeCheck = {
      ultra_speed: () => stats.ultraFastCount >= achievement.target,
      speed: () => stats.fastResponsesCount >= achievement.target,
      streak: () => stats.longestStreak >= achievement.target,
      quality: () => stats.firstApprovalCount >= achievement.target,
      early_bird: () => stats.earlyBirdCount >= achievement.target,
      milestone: () => stats.questionsAnswered >= achievement.target
    }

    const checker = typeCheck[achievement.type as keyof typeof typeCheck]
    return checker ? checker() : false
  }

  /**
   * Calcula progresso de TODOS os tiers de achievements
   * Retorna array completo para mostrar progresso em cada nível
   */
  static calculateAllTiersProgress(
    stats: {
      ultraFastCount: number
      fastResponsesCount: number
      questionsAnswered: number
      longestStreak: number
      firstApprovalCount: number
      earlyBirdCount: number
    },
    unlockedAchievements: Array<{ achievementType: string; unlockedAt: Date }>
  ): AchievementProgress[] {
    const unlockedIds = unlockedAchievements.map(a => a.achievementType)
    const progressList: AchievementProgress[] = []

    // Calcular progresso por stat type
    const statMap = {
      ultra_speed: stats.ultraFastCount,
      speed: stats.fastResponsesCount,
      streak: stats.longestStreak,
      quality: stats.firstApprovalCount,
      early_bird: stats.earlyBirdCount,
      milestone: stats.questionsAnswered
    }

    // Para cada achievement, calcular progresso
    for (const achievement of ACHIEVEMENTS) {
      const progress = statMap[achievement.type as keyof typeof statMap] || 0
      const unlocked = unlockedIds.includes(achievement.id)
      const unlockedData = unlockedAchievements.find(a => a.achievementType === achievement.id)

      // Encontrar próximo tier do mesmo tipo
      const sameTierAchievements = ACHIEVEMENTS
        .filter(a => a.type === achievement.type)
        .sort((a, b) => a.tier - b.tier)

      const currentIndex = sameTierAchievements.findIndex(a => a.id === achievement.id)
      const nextTier = sameTierAchievements[currentIndex + 1] || null

      progressList.push({
        achievementId: achievement.id,
        progress: Math.min(progress, achievement.target),
        total: achievement.target,
        unlocked,
        unlockedAt: unlockedData ? unlockedData.unlockedAt.toISOString() : null,
        currentTier: achievement.tier,
        nextTier: nextTier || null
      })
    }

    // Ordenar: Não completadas PRIMEIRO (por progresso decrescente), 100% completadas SEMPRE NO FINAL
    return progressList.sort((a, b) => {
      const aPercent = (a.progress / a.total) * 100
      const bPercent = (b.progress / b.total) * 100

      // REGRA FUNDAMENTAL: Completadas (100%) SEMPRE vão para o FINAL
      if (a.unlocked && !b.unlocked) return 1  // a completada vai pra baixo
      if (!a.unlocked && b.unlocked) return -1 // b completada vai pra baixo

      // Se ambas NÃO completadas: ordenar por % decrescente (mais próximas de 100% primeiro)
      if (!a.unlocked && !b.unlocked) {
        return bPercent - aPercent
      }

      // Se ambas completadas: manter ordem
      return 0
    })
  }
}

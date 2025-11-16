/**
 * 📊 LEVEL CALCULATOR
 * Sistema de níveis progressivos com nomes criativos e motivacionais
 * Shared entre frontend e backend para consistência
 */

import { logger } from '@/lib/logger'

// ========== INTERFACES ==========

export interface Level {
  level: number
  xpRequired: number
  name: string
  color: string
  description: string
  emoji: string
}

export interface LevelProgress extends Level {
  xpInCurrentLevel: number
  xpToNextLevel: number
  nextLevel: Level | null
}

// ========== LEVEL DEFINITIONS (CRIATIVOS E ENGRAÇADOS) ==========

export const LEVELS: Level[] = [
  {
    level: 1,
    xpRequired: 0,
    name: 'Newbie',
    color: 'from-gray-500 to-gray-600',
    description: 'Bem-vindo ao ML Agent! Todo gigante começa pequeno.',
    emoji: '🐣'
  },
  {
    level: 2,
    xpRequired: 500,
    name: 'Snow Bunny',
    color: 'from-gray-400 to-gray-500',
    description: 'Você está pegando o jeito! Continue assim.',
    emoji: '🐰'
  },
  {
    level: 3,
    xpRequired: 1200,
    name: 'Hustler',
    color: 'from-blue-500 to-blue-600',
    description: 'A grind está real! Seus clientes estão felizes.',
    emoji: '💼'
  },
  {
    level: 4,
    xpRequired: 2000,
    name: 'Go-Getter',
    color: 'from-blue-400 to-blue-500',
    description: 'Você não para! Essa é a energia que queremos ver.',
    emoji: '🚀'
  },
  {
    level: 5,
    xpRequired: 3000,
    name: 'Pro Player',
    color: 'from-cyan-500 to-cyan-600',
    description: 'Nível profissional alcançado. Você domina o jogo!',
    emoji: '🎮'
  },
  {
    level: 6,
    xpRequired: 4500,
    name: 'Beast Mode',
    color: 'from-green-500 to-green-600',
    description: 'Modo fera ativado! Seus números não mentem.',
    emoji: '🦁'
  },
  {
    level: 7,
    xpRequired: 6500,
    name: 'Sigma Seller',
    color: 'from-emerald-500 to-emerald-600',
    description: 'Mindset sigma desbloqueado. Você está no topo do jogo.',
    emoji: '😎'
  },
  {
    level: 8,
    xpRequired: 9000,
    name: 'Gigachad',
    color: 'from-yellow-500 to-yellow-600',
    description: 'Lendário! Você é a referência que todos querem ser.',
    emoji: '💪'
  },
  {
    level: 9,
    xpRequired: 12000,
    name: 'Unicórnio',
    color: 'from-orange-500 to-orange-600',
    description: 'Raríssimo! Performance que poucos alcançam.',
    emoji: '🦄'
  },
  {
    level: 10,
    xpRequired: 16000,
    name: 'Rockstar',
    color: 'from-red-500 to-red-600',
    description: 'Estrela do rock! Você está arrasando nas vendas.',
    emoji: '🎸'
  },
  {
    level: 11,
    xpRequired: 21000,
    name: 'Sensei',
    color: 'from-purple-500 to-purple-600',
    description: 'Mestre das vendas. Sua sabedoria inspira.',
    emoji: '🥋'
  },
  {
    level: 12,
    xpRequired: 27000,
    name: 'Godzilla',
    color: 'from-pink-500 to-pink-600',
    description: 'Força descomunal! Nada te para.',
    emoji: '🦖'
  },
  {
    level: 13,
    xpRequired: 35000,
    name: 'King Kong',
    color: 'from-gold to-yellow-500',
    description: 'Rei da selva do e-commerce. Você domina tudo!',
    emoji: '🦍'
  },
  {
    level: 14,
    xpRequired: 45000,
    name: 'God Mode',
    color: 'from-gold-light to-gold',
    description: 'Modo Deus ativado. Você transcendeu.',
    emoji: '⚡'
  },
  {
    level: 15,
    xpRequired: 60000,
    name: 'GOAT',
    color: 'from-gold via-gold-light to-gold',
    description: 'Greatest Of All Time. Você é LENDÁRIO!',
    emoji: '🐐'
  }
]

// ========== LEVEL CALCULATOR ==========

export class LevelCalculator {
  /**
   * Calcula nível atual baseado em XP total
   */
  static calculateLevel(totalXP: number): LevelProgress {
    // Encontrar nível atual (reverse search para otimização)
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      const currentLevel = LEVELS[i]
      if (!currentLevel) continue

      if (totalXP >= currentLevel.xpRequired) {
        const nextLevelData = LEVELS[i + 1]

        return {
          ...currentLevel,
          xpInCurrentLevel: totalXP - currentLevel.xpRequired,
          xpToNextLevel: nextLevelData ? nextLevelData.xpRequired - totalXP : 0,
          nextLevel: nextLevelData || null
        }
      }
    }

    // Fallback para nível 1
    const firstLevel = LEVELS[0]!
    const nextLevelData = LEVELS[1]

    return {
      ...firstLevel,
      xpInCurrentLevel: totalXP,
      xpToNextLevel: nextLevelData ? nextLevelData.xpRequired - totalXP : 0,
      nextLevel: nextLevelData || null
    }
  }

  /**
   * Verifica se subiu de nível
   */
  static checkLevelUp(oldXP: number, newXP: number): {
    leveledUp: boolean
    oldLevel: number
    newLevel: number
    levelData: LevelProgress | null
  } {
    const oldLevelData = this.calculateLevel(oldXP)
    const newLevelData = this.calculateLevel(newXP)

    const leveledUp = newLevelData.level > oldLevelData.level

    if (leveledUp) {
      logger.info('[Level] Level Up!', {
        oldLevel: oldLevelData.level,
        newLevel: newLevelData.level,
        levelName: newLevelData.name,
        totalXP: newXP
      })
    }

    return {
      leveledUp,
      oldLevel: oldLevelData.level,
      newLevel: newLevelData.level,
      levelData: leveledUp ? newLevelData : null
    }
  }

  /**
   * Obtém informações de um nível específico
   */
  static getLevelInfo(level: number): Level | null {
    return LEVELS.find(l => l.level === level) || null
  }

  /**
   * Lista todos os níveis
   */
  static getAllLevels(): Level[] {
    return LEVELS
  }
}

/**
 * LEVEL CALCULATOR 2.0
 * Sistema de 100 niveis com 10 personagens
 * Integrado com levels-data.ts e characters-data.ts
 */

import { logger } from '@/lib/logger'
import {
  LEVELS,
  ERAS,
  getLevelByXP,
  getNextLevel,
  getEraByLevel,
  getProgressToNextLevel,
  type Level,
  type Era
} from './levels-data'
import {
  CHARACTERS,
  getCharacterByLevel,
  getCharacterProgress,
  isCharacterUnlockLevel,
  type Character
} from './characters-data'

// ========== TYPES ==========

export interface LevelProgress {
  // Current level info
  level: number
  name: string
  emoji: string
  color: string
  description: string
  era: number

  // XP progress
  totalXP: number
  xpInCurrentLevel: number
  xpToNextLevel: number
  xpNeededForLevel: number
  progressPercent: number

  // Next level
  nextLevel: Level | null

  // Character info
  character: Character
  characterProgress: number
  levelsToNextCharacter: number
  nextCharacter: Character | null

  // Era info
  currentEra: Era
}

export interface LevelUpResult {
  leveledUp: boolean
  oldLevel: number
  newLevel: number
  levelsGained: number
  levelData: LevelProgress | null

  // Character evolution
  characterEvolved: boolean
  oldCharacter: Character | null
  newCharacter: Character | null

  // Era change
  eraChanged: boolean
  oldEra: Era | null
  newEra: Era | null
}

// ========== LEVEL CALCULATOR ==========

export class LevelCalculator {
  /**
   * Calculate current level and progress from total XP
   */
  static calculateLevel(totalXP: number): LevelProgress {
    const currentLevel = getLevelByXP(totalXP)
    const nextLevelData = getNextLevel(currentLevel.level)
    const progress = getProgressToNextLevel(totalXP)
    const currentEra = getEraByLevel(currentLevel.level)
    const character = getCharacterByLevel(currentLevel.level)
    const charProgress = getCharacterProgress(currentLevel.level)

    return {
      // Level info
      level: currentLevel.level,
      name: currentLevel.name,
      emoji: currentLevel.emoji,
      color: currentLevel.color,
      description: currentLevel.description,
      era: currentLevel.era,

      // XP progress
      totalXP,
      xpInCurrentLevel: progress.xpInCurrentLevel,
      xpToNextLevel: nextLevelData ? nextLevelData.xpRequired - totalXP : 0,
      xpNeededForLevel: progress.xpNeededForNext,
      progressPercent: progress.progressPercent,

      // Next level
      nextLevel: nextLevelData,

      // Character info
      character,
      characterProgress: charProgress.progressInEra,
      levelsToNextCharacter: charProgress.levelsToNext,
      nextCharacter: charProgress.next,

      // Era info
      currentEra
    }
  }

  /**
   * Check if level up occurred and return details
   */
  static checkLevelUp(oldXP: number, newXP: number): LevelUpResult {
    const oldLevelData = this.calculateLevel(oldXP)
    const newLevelData = this.calculateLevel(newXP)

    const leveledUp = newLevelData.level > oldLevelData.level
    const levelsGained = newLevelData.level - oldLevelData.level

    // Check character evolution (every 10 levels)
    const oldCharacter = getCharacterByLevel(oldLevelData.level)
    const newCharacter = getCharacterByLevel(newLevelData.level)
    const characterEvolved = oldCharacter.code !== newCharacter.code

    // Check era change
    const oldEra = getEraByLevel(oldLevelData.level)
    const newEra = getEraByLevel(newLevelData.level)
    const eraChanged = oldEra.number !== newEra.number

    if (leveledUp) {
      logger.info('[Level 2.0] Level Up!', {
        oldLevel: oldLevelData.level,
        newLevel: newLevelData.level,
        levelsGained,
        levelName: newLevelData.name,
        totalXP: newXP,
        characterEvolved,
        newCharacter: characterEvolved ? newCharacter.name : null,
        eraChanged,
        newEra: eraChanged ? newEra.name : null
      })
    }

    return {
      leveledUp,
      oldLevel: oldLevelData.level,
      newLevel: newLevelData.level,
      levelsGained,
      levelData: leveledUp ? newLevelData : null,
      characterEvolved,
      oldCharacter: characterEvolved ? oldCharacter : null,
      newCharacter: characterEvolved ? newCharacter : null,
      eraChanged,
      oldEra: eraChanged ? oldEra : null,
      newEra: eraChanged ? newEra : null
    }
  }

  /**
   * Get level info by level number
   */
  static getLevelInfo(level: number): Level | null {
    return LEVELS.find(l => l.level === level) || null
  }

  /**
   * Get all 100 levels
   */
  static getAllLevels(): Level[] {
    return LEVELS
  }

  /**
   * Get all 10 eras
   */
  static getAllEras(): Era[] {
    return ERAS
  }

  /**
   * Get all 10 characters
   */
  static getAllCharacters(): Character[] {
    return CHARACTERS
  }

  /**
   * Get levels for a specific era
   */
  static getLevelsByEra(eraNumber: number): Level[] {
    return LEVELS.filter(l => l.era === eraNumber)
  }

  /**
   * Calculate XP needed to reach a target level
   */
  static getXPForLevel(level: number): number {
    const levelData = this.getLevelInfo(level)
    return levelData?.xpRequired || 0
  }

  /**
   * Estimate questions needed to reach a level
   * Based on average ~110 XP per question
   */
  static estimateQuestionsToLevel(currentXP: number, targetLevel: number): number {
    const targetXP = this.getXPForLevel(targetLevel)
    const xpNeeded = targetXP - currentXP

    if (xpNeeded <= 0) return 0

    // Average XP per question considering speed bonuses
    const AVG_XP_PER_QUESTION = 110
    return Math.ceil(xpNeeded / AVG_XP_PER_QUESTION)
  }

  /**
   * Get milestone levels (character unlock levels)
   */
  static getMilestoneLevels(): number[] {
    return [1, 11, 21, 31, 41, 51, 61, 71, 81, 91]
  }

  /**
   * Check if a level is a character unlock milestone
   */
  static isCharacterMilestone(level: number): boolean {
    return isCharacterUnlockLevel(level)
  }

  /**
   * Get ranking tier based on level
   */
  static getRankingTier(level: number): {
    tier: string
    color: string
    minLevel: number
    maxLevel: number
  } {
    if (level >= 91) return { tier: 'GOAT', color: 'from-purple-600 to-pink-400', minLevel: 91, maxLevel: 100 }
    if (level >= 81) return { tier: 'Divino', color: 'from-amber-500 to-amber-300', minLevel: 81, maxLevel: 90 }
    if (level >= 71) return { tier: 'Cosmico', color: 'from-blue-600 to-indigo-400', minLevel: 71, maxLevel: 80 }
    if (level >= 61) return { tier: 'Magnata', color: 'from-yellow-600 to-yellow-400', minLevel: 61, maxLevel: 70 }
    if (level >= 51) return { tier: 'Gamer', color: 'from-lime-500 to-green-400', minLevel: 51, maxLevel: 60 }
    if (level >= 41) return { tier: 'Sigma', color: 'from-yellow-500 to-amber-500', minLevel: 41, maxLevel: 50 }
    if (level >= 31) return { tier: 'Mito', color: 'from-purple-500 to-violet-400', minLevel: 31, maxLevel: 40 }
    if (level >= 21) return { tier: 'Fera', color: 'from-green-500 to-emerald-400', minLevel: 21, maxLevel: 30 }
    if (level >= 11) return { tier: 'Guerreiro', color: 'from-blue-500 to-cyan-400', minLevel: 11, maxLevel: 20 }
    return { tier: 'Filhote', color: 'from-gray-400 to-blue-400', minLevel: 1, maxLevel: 10 }
  }

  /**
   * Format level for display
   */
  static formatLevelDisplay(level: number): {
    level: number
    name: string
    emoji: string
    character: string
    characterAvatarSeed: string
    era: string
    color: string
  } {
    const levelData = this.getLevelInfo(level)
    const character = getCharacterByLevel(level)
    const era = getEraByLevel(level)

    return {
      level,
      name: levelData?.name || 'Desconhecido',
      emoji: levelData?.emoji || '',
      character: character.name,
      characterAvatarSeed: character.avatarSeed,
      era: era.name,
      color: character.gradientClass
    }
  }
}

// ========== RE-EXPORTS ==========

// Re-export types and data for convenience
export type { Level, Era } from './levels-data'
export type { Character } from './characters-data'
export {
  LEVELS,
  ERAS,
  getLevelByXP,
  getNextLevel,
  getEraByLevel,
  getProgressToNextLevel,
  LEVEL_STATS
} from './levels-data'
export {
  CHARACTERS,
  getCharacterByLevel,
  getCharacterByCode,
  getCharacterProgress,
  CHARACTER_STATS
} from './characters-data'

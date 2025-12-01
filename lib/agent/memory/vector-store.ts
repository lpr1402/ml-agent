/**
 * Vector Store - Sistema de busca de padrões aprendidos
 * Busca por keywords e relevância para injetar no contexto do agente
 *
 * @author ML Agent Team
 * @date 2025-11-21
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * Padrão aprendido retornado da busca
 */
export interface LearnedPattern {
  key: string
  value: string
  confidence: number
  usageCount: number
  source: string
  relevanceScore: number
}

/**
 * Vector Store para busca de padrões
 */
export class VectorStore {
  /**
   * Busca padrões aprendidos relevantes para uma query
   */
  async searchPatterns(
    query: string,
    organizationId: string,
    options: {
      limit?: number
      minConfidence?: number
      memoryTypes?: string[]
    } = {}
  ): Promise<LearnedPattern[]> {
    const {
      limit = 5,
      minConfidence = 0.6,
      memoryTypes = ['pattern', 'preference', 'success']
    } = options

    try {
      logger.info('[VectorStore] Searching patterns', {
        query: query.substring(0, 50),
        organizationId,
        limit,
        minConfidence,
      })

      // Extrair keywords da query
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 10)

      if (keywords.length === 0) {
        logger.debug('[VectorStore] No keywords found')
        return []
      }

      // Buscar padrões relevantes
      const patterns = await prisma.agentMemory.findMany({
        where: {
          organizationId,
          memoryType: {
            in: memoryTypes,
          },
          confidence: {
            gte: minConfidence,
          },
          OR: [
            ...keywords.map((keyword) => ({
              key: {
                contains: keyword,
                mode: 'insensitive' as const,
              },
            })),
            ...keywords.map((keyword) => ({
              value: {
                contains: keyword,
                mode: 'insensitive' as const,
              },
            })),
          ],
        },
        orderBy: [
          { confidence: 'desc' },
          { usageCount: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: limit * 2,
      })

      // Calcular relevance score
      const scoredPatterns = patterns.map((pattern) => {
        const textToScore = `${pattern.key} ${pattern.value}`.toLowerCase()
        const matchedKeywords = keywords.filter((kw) => textToScore.includes(kw))
        const keywordScore = matchedKeywords.length / keywords.length
        const keyInTitle = keywords.some((kw) => pattern.key.toLowerCase().includes(kw))
        const titleBonus = keyInTitle ? 0.3 : 0

        const relevanceScore =
          (keywordScore * 0.5) +
          (pattern.confidence * 0.3) +
          (Math.min(pattern.usageCount / 10, 1) * 0.1) +
          titleBonus

        return {
          key: pattern.key,
          value: pattern.value,
          confidence: pattern.confidence,
          usageCount: pattern.usageCount,
          source: pattern.source || 'unknown',
          relevanceScore,
        }
      })

      // Ordenar por relevance e limitar
      const topPatterns = scoredPatterns
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit)

      // Atualizar lastUsedAt
      if (topPatterns.length > 0) {
        const patternKeys = topPatterns.map((p) => p.key)

        await prisma.agentMemory.updateMany({
          where: {
            organizationId,
            key: {
              in: patternKeys,
            },
          },
          data: {
            lastUsedAt: new Date(),
          },
        }).catch((err) => {
          logger.warn('[VectorStore] Failed to update lastUsedAt', { error: err })
        })
      }

      logger.info('[VectorStore] Patterns found', {
        count: topPatterns.length,
        avgRelevance: topPatterns.length > 0
          ? (topPatterns.reduce((sum, p) => sum + p.relevanceScore, 0) / topPatterns.length).toFixed(2)
          : '0.00',
      })

      return topPatterns
    } catch (error: any) {
      logger.error('[VectorStore] Error searching patterns', {
        error: error.message,
        organizationId,
      })

      return []
    }
  }

  /**
   * Busca preferências da organização
   */
  async getOrganizationPreferences(
    organizationId: string
  ): Promise<Record<string, string>> {
    try {
      const preferences = await prisma.agentMemory.findMany({
        where: {
          organizationId,
          memoryType: 'preference',
        },
        orderBy: {
          confidence: 'desc',
        },
      })

      const prefsMap: Record<string, string> = {}

      preferences.forEach((pref) => {
        prefsMap[pref.key] = pref.value
      })

      logger.info('[VectorStore] Preferences loaded', {
        organizationId,
        count: preferences.length,
      })

      return prefsMap
    } catch (error: any) {
      logger.error('[VectorStore] Error loading preferences', {
        error: error.message,
        organizationId,
      })

      return {}
    }
  }

  /**
   * Salva ou atualiza um padrão aprendido
   */
  async savePattern(
    organizationId: string,
    pattern: {
      key: string
      value: string
      memoryType: 'pattern' | 'preference' | 'success' | 'failure'
      source: string
      confidence: number
      mlAccountId?: string
    }
  ): Promise<void> {
    try {
      const existing = await prisma.agentMemory.findFirst({
        where: {
          organizationId,
          key: pattern.key,
        },
      })

      if (existing) {
        await prisma.agentMemory.update({
          where: { id: existing.id },
          data: {
            value: pattern.value,
            confidence: Math.min(existing.confidence + 0.05, 1.0),
            usageCount: existing.usageCount + 1,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        logger.info('[VectorStore] Pattern updated', {
          key: pattern.key,
          confidence: Math.min(existing.confidence + 0.05, 1.0),
        })
      } else {
        await prisma.agentMemory.create({
          data: {
            organizationId,
            mlAccountId: pattern.mlAccountId || null,
            memoryType: pattern.memoryType,
            key: pattern.key,
            value: pattern.value,
            confidence: pattern.confidence,
            source: pattern.source,
            usageCount: 0,
            embedding: Prisma.JsonNull,
            embeddingDimensions: null,
          },
        })

        logger.info('[VectorStore] Pattern created', {
          key: pattern.key,
        })
      }
    } catch (error: any) {
      logger.error('[VectorStore] Error saving pattern', {
        key: pattern.key,
        error: error.message,
      })
    }
  }

  /**
   * Formata padrões para injeção no prompt
   */
  formatPatternsForPrompt(patterns: LearnedPattern[]): string {
    if (patterns.length === 0) {
      return ''
    }

    const lines: string[] = []
    lines.push('=== PADRÕES APRENDIDOS DA ORGANIZAÇÃO ===')
    lines.push('Baseado em interações anteriores, considere:')
    lines.push('')

    patterns.forEach((pattern, index) => {
      lines.push(`${index + 1}. ${pattern.key}`)
      lines.push(`   → ${pattern.value}`)
      lines.push(`   (Confiança: ${(pattern.confidence * 100).toFixed(0)}%, Usado ${pattern.usageCount}x)`)
      lines.push('')
    })

    return lines.join('\n')
  }

  /**
   * Remove padrões antigos não usados
   */
  async cleanup(organizationId: string, olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      const result = await prisma.agentMemory.deleteMany({
        where: {
          organizationId,
          memoryType: 'pattern',
          usageCount: 0,
          createdAt: {
            lt: cutoffDate,
          },
        },
      })

      if (result.count > 0) {
        logger.info('[VectorStore] Cleanup completed', {
          organizationId,
          deletedCount: result.count,
        })
      }

      return result.count
    } catch (error: any) {
      logger.error('[VectorStore] Cleanup error', {
        error: error.message,
      })

      return 0
    }
  }

  /**
   * Estatísticas de memória
   */
  async getStats(organizationId: string): Promise<{
    totalPatterns: number
    byType: Record<string, number>
    avgConfidence: number
    totalUsage: number
  }> {
    try {
      const memories = await prisma.agentMemory.findMany({
        where: { organizationId },
        select: {
          memoryType: true,
          confidence: true,
          usageCount: true,
        },
      })

      const byType: Record<string, number> = {}
      let totalConfidence = 0
      let totalUsage = 0

      memories.forEach((mem) => {
        byType[mem.memoryType] = (byType[mem.memoryType] || 0) + 1
        totalConfidence += mem.confidence
        totalUsage += mem.usageCount
      })

      return {
        totalPatterns: memories.length,
        byType,
        avgConfidence: memories.length > 0 ? totalConfidence / memories.length : 0,
        totalUsage,
      }
    } catch (error: any) {
      logger.error('[VectorStore] Error getting stats', {
        error: error.message,
      })

      return {
        totalPatterns: 0,
        byType: {},
        avgConfidence: 0,
        totalUsage: 0,
      }
    }
  }
}

// Export singleton
export const vectorStore = new VectorStore()

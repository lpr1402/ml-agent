/**
 * Learning System - Aprendizado contínuo com feedback
 * Analisa edições e extrai padrões inteligentes para melhoria progressiva
 *
 * @author ML Agent Team
 * @date 2025-11-21
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { vectorStore } from './vector-store'

/**
 * Sistema de aprendizado que processa feedback
 */
export class LearningSystem {
  /**
   * Processa feedback de edição/revisão
   */
  async processFeedback(feedback: {
    questionId: string
    originalResponse: string
    finalResponse: string
    feedbackType: 'edit' | 'reject' | 'approve_with_changes'
    organizationId: string
    mlAccountId: string
    createdBy: string
  }): Promise<void> {
    try {
      logger.info('[LearningSystem] Processing feedback', {
        questionId: feedback.questionId,
        type: feedback.feedbackType,
        organizationId: feedback.organizationId,
      })

      // 1. Identificar mudanças específicas
      const edits = this.identifyEdits(feedback.originalResponse, feedback.finalResponse)

      // 2. Extrair padrões aprendidos
      const patterns = this.extractPatterns(edits, feedback)

      // 3. Identificar melhorias
      const improvements = this.identifyImprovements(edits)

      // 4. Salvar no banco
      await prisma.learningFeedback.create({
        data: {
          questionId: feedback.questionId,
          organizationId: feedback.organizationId,
          mlAccountId: feedback.mlAccountId,
          originalResponse: feedback.originalResponse,
          finalResponse: feedback.finalResponse,
          feedbackType: feedback.feedbackType,
          edits: edits as any,
          learnedPatterns: patterns as any,
          improvements: improvements as any,
          createdBy: feedback.createdBy,
          appliedToMemory: true, // Aplicar imediatamente
        },
      })

      // 5. Aplicar padrões à memória
      await this.applyToMemory(patterns, feedback.organizationId, feedback.mlAccountId)

      logger.info('[LearningSystem] Feedback processed', {
        questionId: feedback.questionId,
        patternsFound: patterns.length,
        improvementsIdentified: improvements.length,
      })
    } catch (error: any) {
      logger.error('[LearningSystem] Error processing feedback', {
        questionId: feedback.questionId,
        error: error.message,
      })
    }
  }

  /**
   * Identifica mudanças entre original e final
   */
  private identifyEdits(
    original: string,
    final: string
  ): Array<{
    type: 'addition' | 'removal' | 'modification'
    content: string
    position: number
  }> {
    const edits: Array<{
      type: 'addition' | 'removal' | 'modification'
      content: string
      position: number
    }> = []

    const originalWords = original.split(/\s+/)
    const finalWords = final.split(/\s+/)

    // Detectar adições significativas (>20%)
    if (finalWords.length > originalWords.length * 1.2) {
      edits.push({
        type: 'addition',
        content: `Added ~${finalWords.length - originalWords.length} words`,
        position: 0,
      })
    }

    // Detectar remoções significativas (>20%)
    if (finalWords.length < originalWords.length * 0.8) {
      edits.push({
        type: 'removal',
        content: `Removed ~${originalWords.length - finalWords.length} words`,
        position: 0,
      })
    }

    // Detectar modificações de frases
    const originalSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const finalSentences = final.split(/[.!?]+/).filter(s => s.trim().length > 0)

    for (let i = 0; i < Math.min(originalSentences.length, finalSentences.length); i++) {
      const origSent = originalSentences[i]?.trim() || ''
      const finalSent = finalSentences[i]?.trim() || ''

      if (origSent !== finalSent && origSent.length > 10) {
        edits.push({
          type: 'modification',
          content: `Modified sentence ${i + 1}`,
          position: i,
        })
      }
    }

    return edits
  }

  /**
   * Extrai padrões aprendidos (análise inteligente)
   */
  private extractPatterns(
    edits: any[],
    feedback: { feedbackType: string; originalResponse: string; finalResponse: string }
  ): string[] {
    const patterns: string[] = []

    // Padrão 1: Rejeição completa
    if (feedback.feedbackType === 'reject') {
      patterns.push('response_rejected')
    }

    // Padrão 2: Necessita mais detalhes
    const additions = edits.filter((e) => e.type === 'addition')
    if (additions.length > 0) {
      patterns.push('requires_more_detail')

      // Análise específica: o que foi adicionado?
      const finalLower = feedback.finalResponse.toLowerCase()

      if (finalLower.includes('frete') && !feedback.originalResponse.toLowerCase().includes('frete')) {
        patterns.push('always_mention_shipping')
      }
      if (finalLower.includes('garantia') && !feedback.originalResponse.toLowerCase().includes('garantia')) {
        patterns.push('always_mention_warranty')
      }
      if (finalLower.includes('estoque') && !feedback.originalResponse.toLowerCase().includes('estoque')) {
        patterns.push('always_mention_stock')
      }
      if ((finalLower.includes('pix') || finalLower.includes('parcel')) &&
          !feedback.originalResponse.toLowerCase().includes('pix') &&
          !feedback.originalResponse.toLowerCase().includes('parcel')) {
        patterns.push('always_mention_payment_options')
      }
    }

    // Padrão 3: Resposta muito longa
    const removals = edits.filter((e) => e.type === 'removal')
    if (removals.length > 0) {
      patterns.push('response_too_verbose')
      patterns.push('prefer_concise_responses')
    }

    // Padrão 4: Mudança de tom
    const modifications = edits.filter((e) => e.type === 'modification')
    if (modifications.length > 0) {
      const originalCasual = this.countCasualMarkers(feedback.originalResponse)
      const finalCasual = this.countCasualMarkers(feedback.finalResponse)

      if (finalCasual > originalCasual * 1.5) {
        patterns.push('prefer_casual_tone')
      } else if (finalCasual < originalCasual * 0.5) {
        patterns.push('prefer_formal_tone')
      }
    }

    return patterns
  }

  /**
   * Conta marcadores de casualidade
   */
  private countCasualMarkers(text: string): number {
    const casualMarkers = ['pra ', 'tá ', 'cê ', 'né', 'tô ']
    return casualMarkers.reduce((count, marker) => {
      return count + (text.match(new RegExp(marker, 'gi'))?.length || 0)
    }, 0)
  }

  /**
   * Identifica melhorias sugeridas
   */
  private identifyImprovements(edits: any[]): string[] {
    const improvements: string[] = []

    if (edits.some((e) => e.type === 'addition')) {
      improvements.push('Include more product details')
    }

    if (edits.some((e) => e.type === 'removal')) {
      improvements.push('Be more concise')
    }

    if (edits.some((e) => e.type === 'modification')) {
      improvements.push('Adjust tone or phrasing')
    }

    return improvements
  }

  /**
   * Aplica padrões à memória
   */
  private async applyToMemory(
    patterns: string[],
    organizationId: string,
    mlAccountId: string
  ): Promise<void> {
    for (const patternKey of patterns) {
      try {
        const patternValue = this.getPatternDescription(patternKey)

        await vectorStore.savePattern(organizationId, {
          key: patternKey,
          value: patternValue,
          memoryType: 'pattern',
          source: 'learning_feedback',
          confidence: 0.65,
          mlAccountId,
        })

        logger.debug('[LearningSystem] Pattern applied', {
          pattern: patternKey,
        })
      } catch (error: any) {
        logger.error('[LearningSystem] Error applying pattern', {
          pattern: patternKey,
          error: error.message,
        })
      }
    }
  }

  /**
   * Descrições dos padrões
   */
  private getPatternDescription(patternKey: string): string {
    const descriptions: Record<string, string> = {
      'response_rejected': 'Respostas deste estilo foram rejeitadas - evitar',
      'requires_more_detail': 'Incluir mais detalhes específicos do produto',
      'response_too_verbose': 'Respostas muito longas - ser mais objetivo',
      'prefer_concise_responses': 'Preferência por respostas diretas e concisas',
      'prefer_casual_tone': 'Usar tom casual com contrações (pra, tá, cê)',
      'prefer_formal_tone': 'Usar tom profissional e formal',
      'always_mention_shipping': 'Sempre mencionar frete quando relevante',
      'always_mention_warranty': 'Sempre mencionar garantia quando relevante',
      'always_mention_stock': 'Sempre mencionar disponibilidade',
      'always_mention_payment_options': 'Sempre mencionar PIX e parcelamento',
    }

    return descriptions[patternKey] || `Padrão aprendido: ${patternKey}`
  }

  /**
   * Busca padrões relevantes
   */
  async getRelevantPatterns(
    organizationId: string,
    questionText: string
  ): Promise<string[]> {
    try {
      const patterns = await vectorStore.searchPatterns(questionText, organizationId, {
        limit: 5,
        minConfidence: 0.7,
        memoryTypes: ['pattern', 'preference'],
      })

      return patterns.map((p) => p.value)
    } catch (error: any) {
      logger.error('[LearningSystem] Error fetching patterns', {
        error: error.message,
      })

      return []
    }
  }

  /**
   * Gera relatório de aprendizado
   */
  async generateLearningReport(organizationId: string): Promise<{
    totalFeedbacks: number
    totalPatterns: number
    topPatterns: Array<{ pattern: string; count: number; confidence: number }>
    improvementSuggestions: string[]
  }> {
    try {
      const totalFeedbacks = await prisma.learningFeedback.count({
        where: { organizationId },
      })

      const patterns = await prisma.agentMemory.findMany({
        where: {
          organizationId,
          memoryType: 'pattern',
        },
        orderBy: {
          usageCount: 'desc',
        },
        take: 10,
      })

      const topPatterns = patterns.map((p) => ({
        pattern: p.key,
        count: p.usageCount,
        confidence: p.confidence,
      }))

      const feedbacks = await prisma.learningFeedback.findMany({
        where: {
          organizationId,
          appliedToMemory: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      })

      const allImprovements = feedbacks.flatMap((f) => f.improvements as string[])
      const uniqueImprovements = Array.from(new Set(allImprovements))

      return {
        totalFeedbacks,
        totalPatterns: patterns.length,
        topPatterns,
        improvementSuggestions: uniqueImprovements.slice(0, 5),
      }
    } catch (error: any) {
      logger.error('[LearningSystem] Error generating report', {
        error: error.message,
      })

      return {
        totalFeedbacks: 0,
        totalPatterns: 0,
        topPatterns: [],
        improvementSuggestions: [],
      }
    }
  }
}

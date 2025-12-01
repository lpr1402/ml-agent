/**
 * Context Manager - Gerenciamento de contexto e summarization
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'

/**
 * Gerenciador de contexto com auto-summarization
 */
export class ContextManager {
  private maxContextTokens: number

  constructor(maxContextTokens: number = 100000) {
    this.maxContextTokens = maxContextTokens
  }

  /**
   * Monta contexto completo para o agente
   */
  buildContext(components: {
    productInfo?: string
    buyerHistory?: string
    similarQuestions?: any[]
    sellerProfile?: any
    organizationPreferences?: any
  }): string {
    const sections: string[] = []

    // Adicionar informações do produto
    if (components.productInfo) {
      sections.push('=== INFORMAÇÕES DO PRODUTO ===')
      sections.push(components.productInfo)
      sections.push('')
    }

    // Adicionar histórico do comprador
    if (components.buyerHistory) {
      sections.push('=== HISTÓRICO DO COMPRADOR ===')
      sections.push(components.buyerHistory)
      sections.push('')
    }

    // Adicionar perguntas similares
    if (components.similarQuestions && components.similarQuestions.length > 0) {
      sections.push('=== PERGUNTAS SIMILARES JÁ RESPONDIDAS ===')
      components.similarQuestions.forEach((sq, index) => {
        sections.push(`${index + 1}. Pergunta: "${sq.questionText}"`)
        sections.push(`   Resposta: "${sq.answerText}"`)
        sections.push(`   Sucesso: ${sq.wasSuccessful ? 'Sim' : 'Não'}`)
        sections.push('')
      })
    }

    // Adicionar preferências da organização
    if (components.organizationPreferences) {
      const prefs = components.organizationPreferences
      sections.push('=== PREFERÊNCIAS DA ORGANIZAÇÃO ===')

      if (prefs.response_style) {
        sections.push(`Estilo de resposta: ${prefs.response_style}`)
      }

      if (prefs.custom_guidelines) {
        sections.push(`Guidelines personalizados: ${prefs.custom_guidelines}`)
      }

      sections.push('')
    }

    // Adicionar perfil do vendedor
    if (components.sellerProfile) {
      sections.push('=== PERFIL DO VENDEDOR ===')
      sections.push(`Nome: ${components.sellerProfile.nickname}`)

      if (components.sellerProfile.reputation) {
        const rep = components.sellerProfile.reputation
        sections.push(`Nível de reputação: ${rep.levelId}`)

        if (rep.powerSeller) {
          sections.push(`Power Seller: ${rep.powerSeller}`)
        }

        if (rep.transactions) {
          sections.push(
            `Transações completadas: ${rep.transactions.completed || 0}`
          )
        }
      }

      sections.push('')
    }

    return sections.join('\n')
  }

  /**
   * Estima tokens de um texto (aproximação rápida)
   */
  estimateTokens(text: string): number {
    // Aproximação: ~4 caracteres por token em português
    return Math.ceil(text.length / 4)
  }

  /**
   * Verifica se contexto precisa de summarization
   */
  needsSummarization(context: string): boolean {
    const estimatedTokens = this.estimateTokens(context)
    return estimatedTokens > this.maxContextTokens * 0.8 // 80% do limite
  }

  /**
   * Comprime contexto removendo redundâncias
   */
  compressContext(context: string): string {
    let compressed = context

    // Remover múltiplos espaços em branco
    compressed = compressed.replace(/\s+/g, ' ')

    // Remover linhas vazias consecutivas
    compressed = compressed.replace(/\n{3,}/g, '\n\n')

    // Remover separadores excessivos
    compressed = compressed.replace(/={3,}/g, '===')
    compressed = compressed.replace(/-{3,}/g, '---')

    return compressed.trim()
  }

  /**
   * Trunca contexto se muito grande
   */
  truncateIfNeeded(context: string, maxLength: number = 50000): string {
    if (context.length <= maxLength) {
      return context
    }

    logger.warn('[ContextManager] Context too large, truncating', {
      originalLength: context.length,
      maxLength,
    })

    // Truncar mantendo início e fim
    const halfMax = Math.floor(maxLength / 2)
    const beginning = context.substring(0, halfMax)
    const ending = context.substring(context.length - halfMax)

    return `${beginning}\n\n... [Contexto truncado por tamanho] ...\n\n${ending}`
  }

  /**
   * Prepara contexto otimizado para o agente
   */
  prepareOptimizedContext(components: {
    productInfo?: string
    buyerHistory?: string
    similarQuestions?: any[]
    sellerProfile?: any
    organizationPreferences?: any
  }): string {
    // 1. Construir contexto completo
    let context = this.buildContext(components)

    // 2. Comprimir
    context = this.compressContext(context)

    // 3. Truncar se necessário
    context = this.truncateIfNeeded(context)

    logger.info('[ContextManager] Context prepared', {
      finalLength: context.length,
      estimatedTokens: this.estimateTokens(context),
    })

    return context
  }
}

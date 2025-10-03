/**
 * Generate sequential ID in format XX/DDMM
 * Where XX is the DAILY sequential number (01, 02, 03...) and DDMM is day+month
 *
 * IMPORTANTE: Deve ser calculado ao RECEBER a pergunta com base em quantas
 * perguntas a organização já recebeu HOJE
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Generate REAL sequential ID for today
 * Busca quantas perguntas a organização recebeu hoje e incrementa
 * Format: XX/DDMM onde XX é sequencial do dia
 *
 * @param organizationId - ID da organização
 * @param questionReceivedAt - Data de recebimento da pergunta (default: agora)
 * @returns Sequential ID no formato XX/DDMM (ex: 01/0310, 02/0310)
 */
export async function generateSequentialId(
  organizationId: string,
  questionReceivedAt: Date = new Date()
): Promise<string> {
  try {
    const now = questionReceivedAt
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')

    // Início do dia (00:00:00)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

    // Contar quantas perguntas a organização JÁ recebeu HOJE (incluindo esta)
    const todayQuestionsCount = await prisma.question.count({
      where: {
        mlAccount: {
          organizationId
        },
        receivedAt: {
          gte: startOfDay,
          lte: now // Até o momento atual
        }
      }
    })

    // Próximo número sequencial (se tem 5, esta é a 6ª)
    const sequential = todayQuestionsCount + 1

    // Format as XX/DDMM
    const seqStr = sequential.toString().padStart(2, '0')
    const result = `${seqStr}/${day}${month}`

    logger.info('[SequentialID] Generated sequential ID', {
      organizationId,
      todayCount: todayQuestionsCount,
      sequential,
      result
    })

    return result

  } catch (error) {
    logger.error('[SequentialID] Error generating sequential ID', { error, organizationId })

    // Fallback: usar timestamp para garantir unicidade
    const now = questionReceivedAt
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const timestamp = Date.now().toString().slice(-2) // últimos 2 dígitos do timestamp
    return `${timestamp}/${day}${month}`
  }
}

/**
 * DEPRECATED: Função antiga que gerava ID aleatório
 * Mantida para compatibilidade, mas NÃO DEVE SER USADA
 */
export function generateSequentialIdOld(_questionId: string): string {
  logger.warn('[SequentialID] Using OLD deprecated function - should use async version')
  const now = new Date()
  const day = now.getDate().toString().padStart(2, '0')
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  return `${random}/${day}${month}`
}

/**
 * Parse sequential ID to extract components
 */
export function parseSequentialId(sequentialId: string): {
  sequential: number
  day: string
  month: string
} | null {
  try {
    const match = sequentialId.match(/^(\d{2})\/(\d{2})(\d{2})$/)
    if (!match) return null

    return {
      sequential: parseInt(match[1]!, 10),
      day: match[2]!,
      month: match[3]!
    }
  } catch {
    return null
  }
}
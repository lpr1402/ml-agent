/**
 * Serviço de Tokens Únicos para Links de Aprovação
 * Gera e gerencia tokens seguros para acesso único a perguntas
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

interface TokenData {
  questionId: string
  mlAccountId: string
  organizationId: string
  ipAddress?: string
  userAgent?: string
}

interface TokenValidation {
  valid: boolean
  question?: any
  error?: string
}

class UniqueTokenService {
  // Gerar ID sequencial no formato XX/DDMM onde XX é o número sequencial do dia
  private async generateSequentialId(organizationId: string): Promise<string> {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')

    // Criar datas corretas para início e fim do dia
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    // Contar perguntas do dia para esta organização
    const count = await prisma.question.count({
      where: {
        mlAccount: {
          organizationId: organizationId
        },
        receivedAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    const sequence = String(count + 1).padStart(2, '0')
    return `${sequence}/${day}${month}`
  }

  /**
   * Gerar token único para aprovação de pergunta
   */
  async generateToken(data: TokenData): Promise<{ token: string; sequentialId: string; expiresAt: Date }> {
    try {
      // Gerar token seguro
      const token = crypto.randomBytes(32).toString('base64url')

      // Gerar ID sequencial passando organizationId
      const sequentialId = await this.generateSequentialId(data.organizationId)

      // Token expira em 24 horas
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      // Criar registro no banco
      await prisma.approvalToken.create({
        data: {
          token,
          questionId: data.questionId,
          mlAccountId: data.mlAccountId,
          organizationId: data.organizationId,
          expiresAt,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null
        }
      })

      logger.info('[TokenService] Token generated', {
        questionId: data.questionId,
        sequentialId,
        expiresAt
      })

      return { token, sequentialId, expiresAt }

    } catch (error) {
      logger.error('[TokenService] Failed to generate token', { error })
      throw error
    }
  }

  /**
   * Validar PIN de acesso
   * PIN fixo: 911 (conforme requisito)
   */
  validatePin(pin: string): boolean {
    return pin === '911'
  }

  /**
   * Validar e buscar token
   */
  async validateToken(token: string): Promise<TokenValidation> {
    try {
      const approvalToken = await prisma.approvalToken.findUnique({
        where: { token },
        include: {
          question: {
            include: {
              mlAccount: true
            }
          },
          mlAccount: true,
          organization: true
        }
      })

      if (!approvalToken) {
        return {
          valid: false,
          error: 'Token inválido'
        }
      }

      // Verificar se expirou
      if (new Date() > approvalToken.expiresAt) {
        return {
          valid: false,
          error: 'Token expirado'
        }
      }

      // Verificar se já foi usado
      if (approvalToken.used) {
        return {
          valid: false,
          error: 'Token já utilizado'
        }
      }

      return {
        valid: true,
        question: (approvalToken as any).question
      }

    } catch (error) {
      logger.error('[TokenService] Failed to validate token', { error })
      return {
        valid: false,
        error: 'Erro ao validar token'
      }
    }
  }

  /**
   * Marcar token como usado após aprovação
   */
  async markTokenAsUsed(token: string, approvalType: string): Promise<boolean> {
    try {
      await prisma.approvalToken.update({
        where: { token },
        data: {
          used: true,
          usedAt: new Date(),
          approvalType
        }
      })

      logger.info('[TokenService] Token marked as used', { token })
      return true

    } catch (error) {
      logger.error('[TokenService] Failed to mark token as used', { error })
      return false
    }
  }

  /**
   * Limpar tokens expirados (job de limpeza)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await prisma.approvalToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            {
              used: true,
              usedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Tokens usados há mais de 7 dias
            }
          ]
        }
      })

      logger.info('[TokenService] Expired tokens cleaned', { count: result.count })
      return result.count

    } catch (error) {
      logger.error('[TokenService] Failed to cleanup expired tokens', { error })
      return 0
    }
  }
}

export const tokenService = new UniqueTokenService()
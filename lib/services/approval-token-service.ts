/**
 * Serviço de Tokens de Aprovação Única
 * Garante segurança total para links de aprovação via WhatsApp
 * Multi-tenant com isolamento completo entre organizações
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

export interface CreateTokenParams {
  questionId: string
  mlAccountId: string
  organizationId: string
  expiresInHours?: number // Padrão: 24 horas
  ipAddress?: string
  userAgent?: string
}

export interface ValidateTokenResult {
  valid: boolean
  error?: string
  question?: any
  mlAccount?: any
  organization?: any
}

export class ApprovalTokenService {
  /**
   * Valida PIN de segurança (sempre 911)
   */
  validatePin(pin: string): boolean {
    return pin === '911'
  }

  /**
   * Marca token como usado (alias para markAsUsed)
   */
  async markTokenAsUsed(token: string, approvalType: string): Promise<boolean> {
    return this.markAsUsed(token, approvalType)
  }
  /**
   * Gera um token único e seguro para aprovação
   */
  async createToken(params: CreateTokenParams): Promise<string> {
    const {
      questionId,
      mlAccountId,
      organizationId,
      expiresInHours = 24,
      ipAddress,
      userAgent
    } = params

    try {
      // Gera token único de 32 bytes (64 caracteres hex)
      const token = crypto.randomBytes(32).toString('hex')
      
      // Calcula expiração
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expiresInHours)
      
      // Cria registro do token
      await prisma.approvalToken.create({
        data: {
          token,
          questionId,
          mlAccountId,
          organizationId,
          expiresAt,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          used: false
        }
      })
      
      logger.info('[ApprovalToken] Token created', {
        questionId,
        mlAccountId,
        organizationId,
        expiresInHours
      })
      
      return token
    } catch (error) {
      logger.error('[ApprovalToken] Failed to create token', { error, params })
      throw new Error('Failed to create approval token')
    }
  }
  
  /**
   * Valida um token e retorna os dados associados
   */
  async validateToken(token: string): Promise<ValidateTokenResult> {
    try {
      // Busca token com todos os dados necessários
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
      
      // Token não existe
      if (!approvalToken) {
        logger.warn('[ApprovalToken] Token not found', { token: token.substring(0, 8) })
        return {
          valid: false,
          error: 'Token inválido ou expirado'
        }
      }
      
      // Token já foi usado
      if (approvalToken.used) {
        logger.warn('[ApprovalToken] Token already used', { 
          token: token.substring(0, 8),
          usedAt: approvalToken.usedAt 
        })
        return {
          valid: false,
          error: 'Este link já foi utilizado'
        }
      }
      
      // Token expirado
      if (new Date() > approvalToken.expiresAt) {
        logger.warn('[ApprovalToken] Token expired', { 
          token: token.substring(0, 8),
          expiresAt: approvalToken.expiresAt 
        })
        return {
          valid: false,
          error: 'Link expirado. Solicite um novo link.'
        }
      }
      
      // Validação adicional: pergunta já foi respondida?
      if (approvalToken.question.status === 'COMPLETED' || 
          approvalToken.question.status === 'ANSWERED') {
        logger.warn('[ApprovalToken] Question already answered', { 
          questionId: approvalToken.question.id,
          status: approvalToken.question.status 
        })
        return {
          valid: false,
          error: 'Esta pergunta já foi respondida'
        }
      }
      
      // Token válido!
      logger.info('[ApprovalToken] Token validated successfully', {
        token: token.substring(0, 8),
        questionId: approvalToken.question.id,
        mlAccountId: approvalToken.mlAccount.id
      })
      
      return {
        valid: true,
        question: approvalToken.question,
        mlAccount: approvalToken.mlAccount,
        organization: approvalToken.organization
      }
    } catch (error) {
      logger.error('[ApprovalToken] Validation error', { error })
      return {
        valid: false,
        error: 'Erro ao validar token'
      }
    }
  }
  
  /**
   * Marca um token como usado após aprovação
   */
  async markAsUsed(token: string, approvalType?: string): Promise<boolean> {
    try {
      const result = await prisma.approvalToken.updateMany({
        where: {
          token,
          used: false // Apenas se ainda não foi usado
        },
        data: {
          used: true,
          usedAt: new Date(),
          ...(approvalType ? { approvalType } : {})
        }
      })
      
      if (result.count === 0) {
        logger.warn('[ApprovalToken] Token not found or already used', { 
          token: token.substring(0, 8) 
        })
        return false
      }
      
      logger.info('[ApprovalToken] Token marked as used', {
        token: token.substring(0, 8),
        approvalType
      })
      
      return true
    } catch (error) {
      logger.error('[ApprovalToken] Failed to mark as used', { error })
      return false
    }
  }
  
  /**
   * Limpa tokens expirados (para manutenção)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await prisma.approvalToken.deleteMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: new Date()
              }
            },
            {
              used: true,
              usedAt: {
                lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 dias atrás
              }
            }
          ]
        }
      })
      
      logger.info('[ApprovalToken] Cleanup completed', { 
        deletedCount: result.count 
      })
      
      return result.count
    } catch (error) {
      logger.error('[ApprovalToken] Cleanup failed', { error })
      return 0
    }
  }
  
  /**
   * Gera URL de aprovação com token
   * @param token Token de aprovação
   * @param options Opções adicionais (useRedirect para iOS)
   */
  generateApprovalUrl(token: string, options?: { useRedirect?: boolean }): string {
    const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'

    // Para iOS/WhatsApp, usar redirecionamento inteligente
    if (options?.useRedirect) {
      return `${baseUrl}/api/redirect/answer?token=${token}`
    }

    // Link padrão
    return `${baseUrl}/answer/${token}`
  }

  /**
   * Gera URL universal para acessar o app (PWA deep link)
   * @param organizationId ID da organização
   * @param page Página de destino (padrão: agente)
   * @param sessionToken Token de sessão opcional
   */
  generateUniversalAppUrl(organizationId?: string, page: string = 'agente', sessionToken?: string): string {
    const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'

    let url = `${baseUrl}/api/redirect/app?page=${page}`

    if (organizationId) {
      url += `&org=${organizationId}`
    }

    if (sessionToken) {
      url += `&token=${sessionToken}`
    }

    return url
  }
  
  /**
   * Invalida todos os tokens de uma pergunta (quando aprovada por outro meio)
   */
  async invalidateQuestionTokens(questionId: string): Promise<void> {
    try {
      await prisma.approvalToken.updateMany({
        where: {
          questionId,
          used: false
        },
        data: {
          used: true,
          usedAt: new Date(),
          approvalType: 'INVALIDATED'
        }
      })
      
      logger.info('[ApprovalToken] Invalidated all tokens for question', { questionId })
    } catch (error) {
      logger.error('[ApprovalToken] Failed to invalidate tokens', { error, questionId })
    }
  }
}

// Exportar instância única
export const approvalTokenService = new ApprovalTokenService()
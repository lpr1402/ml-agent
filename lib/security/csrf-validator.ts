/**
 * CSRF Protection with State Validation
 * Previne ataques CSRF no OAuth flow
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { auditSecurityEvent } from '@/lib/audit/audit-logger'

export class CSRFValidator {
  private static usedStates = new Set<string>()
  private static cleanupInterval: NodeJS.Timeout | null = null

  /**
   * Inicia o cleanup automático de states usados
   */
  static initialize() {
    if (!this.cleanupInterval) {
      // Limpa states usados a cada 10 minutos
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldStates()
      }, 10 * 60 * 1000)
    }
  }

  /**
   * Valida e consome um state (uso único)
   */
  static async validateAndConsumeState(
    state: string,
    expectedState?: string
  ): Promise<boolean> {
    try {
      // Verifica se state já foi usado (replay attack)
      if (this.usedStates.has(state)) {
        await auditSecurityEvent('csrf_replay_attempt', { state }, undefined)
        logger.warn('[CSRF] Replay attack detected', { state })
        return false
      }

      // Verifica se state existe no banco e não expirou
      const oauthState = await prisma.oAuthState.findUnique({
        where: { state }
      })

      if (!oauthState) {
        await auditSecurityEvent('csrf_invalid_state', { state }, undefined)
        logger.warn('[CSRF] Invalid state received', { state })
        return false
      }

      // Verifica expiração
      if (oauthState.expiresAt < new Date()) {
        await auditSecurityEvent('csrf_expired_state', { state }, undefined)
        logger.warn('[CSRF] Expired state received', { state })
        
        // Remove state expirado do banco
        await prisma.oAuthState.delete({ where: { state } })
        return false
      }

      // Verifica correspondência se esperado
      if (expectedState && state !== expectedState) {
        await auditSecurityEvent('csrf_mismatch', { 
          received: state, 
          expected: expectedState 
        }, undefined)
        logger.warn('[CSRF] State mismatch', { received: state, expected: expectedState })
        return false
      }

      // Marca state como usado (previne reuso)
      this.usedStates.add(state)

      // Agenda limpeza do state usado após 30 minutos
      setTimeout(() => {
        this.usedStates.delete(state)
      }, 30 * 60 * 1000)

      // Remove state do banco (uso único)
      await prisma.oAuthState.delete({ where: { state } })

      logger.info('[CSRF] State validated and consumed successfully')
      return true

    } catch (error) {
      logger.error('[CSRF] Validation error', { error })
      await auditSecurityEvent('csrf_validation_error', { 
        state, 
        error: String(error) 
      }, undefined)
      return false
    }
  }

  /**
   * Limpa states antigos da memória
   */
  private static cleanupOldStates() {
    const sizeBefore = this.usedStates.size
    
    // Limpa states com mais de 1 hora
    // (Como states são adicionados com timeout de 30min, isso é seguro)
    if (sizeBefore > 1000) {
      // Se tiver muitos, limpa metade dos mais antigos
      const toKeep = Array.from(this.usedStates).slice(-500)
      this.usedStates.clear()
      toKeep.forEach(state => this.usedStates.add(state))
      
      logger.info('[CSRF] Cleanup completed', {
        before: sizeBefore,
        after: this.usedStates.size
      })
    }
  }

  /**
   * Limpa states expirados do banco de dados
   */
  static async cleanupExpiredStates(): Promise<number> {
    try {
      const result = await prisma.oAuthState.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      })

      if (result.count > 0) {
        logger.info('[CSRF] Expired states cleaned from database', {
          count: result.count
        })
      }

      return result.count
    } catch (error) {
      logger.error('[CSRF] Failed to cleanup expired states', { error })
      return 0
    }
  }

  /**
   * Gera um state seguro para OAuth
   */
  static generateSecureState(): string {
    const crypto = require('crypto')
    // 32 bytes = 256 bits de entropia
    return crypto.randomBytes(32).toString('base64url')
  }

  /**
   * Desliga o cleanup interval (para testes ou shutdown)
   */
  static shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.usedStates.clear()
  }
}

// Inicializa automaticamente
CSRFValidator.initialize()

// Cleanup de states expirados a cada hora
setInterval(async () => {
  await CSRFValidator.cleanupExpiredStates()
}, 60 * 60 * 1000)

export default CSRFValidator
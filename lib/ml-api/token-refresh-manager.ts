/**
 * Token Refresh Manager - Sistema Unificado
 * Gerencia refresh automático de tokens ML seguindo documentação oficial
 * Integra com sistema multi-tenant e criptografia
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/security/encryption'
import { auditLog } from '@/lib/audit/audit-logger'
import { fetchWithRateLimit } from '@/lib/api/smart-rate-limiter'

interface RefreshResult {
  success: boolean
  accessToken?: string
  error?: string
}

class TokenRefreshManager {
  private refreshingTokens: Map<string, Promise<RefreshResult>> = new Map()
  private refreshScheduler: Map<string, NodeJS.Timeout> = new Map()
  
  constructor() {
    logger.info('[TokenRefreshManager] Inicializado')
    this.startMonitoring()
  }

  /**
   * Obtém token válido, fazendo refresh automático se necessário
   * Segue padrão da documentação ML: tokens expiram em 6h
   */
  async getValidToken(mlAccountId: string): Promise<string | null> {
    try {
      // Se já está fazendo refresh, aguarda
      if (this.refreshingTokens.has(mlAccountId)) {
        const result = await this.refreshingTokens.get(mlAccountId)!
        return result.success ? result.accessToken! : null
      }

      // Busca conta ML
      const account = await prisma.mLAccount.findUnique({
        where: { id: mlAccountId },
        select: {
          id: true,
          mlUserId: true,
          nickname: true,
          accessToken: true,
          accessTokenIV: true,
          accessTokenTag: true,
          refreshToken: true,
          refreshTokenIV: true,
          refreshTokenTag: true,
          tokenExpiresAt: true,
          isActive: true,
          organizationId: true
        }
      })

      if (!account || !account.isActive) {
        logger.info(`[TokenRefresh] Conta inativa ou não encontrada: ${mlAccountId}`)
        return null
      }

      // Verifica se tem dados de criptografia
      if (!account.accessToken || !account.accessTokenIV || !account.accessTokenTag) {
        logger.error(`[TokenRefresh] Dados de criptografia ausentes para: ${account.nickname}`)
        return null
      }

      // Descriptografa token atual
      let accessToken: string
      try {
        accessToken = decryptToken({
          encrypted: account.accessToken,
          iv: account.accessTokenIV,
          authTag: account.accessTokenTag
        })
      } catch (decryptError) {
        logger.error(`[TokenRefresh] Erro ao descriptografar token para ${account.nickname}:`, {
          error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
        })
        return null
      }

      // Verifica se precisa refresh (5 min antes de expirar)
      const now = new Date()
      const bufferTime = new Date(account.tokenExpiresAt.getTime() - 5 * 60 * 1000)
      
      if (now < bufferTime) {
        // Token ainda válido
        this.scheduleRefresh(mlAccountId, account.tokenExpiresAt)
        return accessToken
      }

      // Precisa fazer refresh
      logger.info(`[TokenRefresh] Token expirando para ${account.nickname}, renovando...`)
      
      const refreshPromise = this.refreshToken(account)
      this.refreshingTokens.set(mlAccountId, refreshPromise)
      
      try {
        const result = await refreshPromise
        return result.success ? result.accessToken! : null
      } finally {
        this.refreshingTokens.delete(mlAccountId)
      }
      
    } catch (error) {
      logger.error(`[TokenRefresh] Erro ao obter token para ${mlAccountId}:`, { error })
      return null
    }
  }

  /**
   * Faz refresh do token seguindo API do ML
   */
  private async refreshToken(account: any): Promise<RefreshResult> {
    try {
      // Descriptografa refresh token
      const refreshToken = decryptToken({
        encrypted: account.refreshToken,
        iv: account.refreshTokenIV,
        authTag: account.refreshTokenTag
      })

      // Faz chamada para API do ML com rate limiting
      const response = await fetchWithRateLimit(
        'https://api.mercadolibre.com/oauth/token',
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env['ML_CLIENT_ID']!,
            client_secret: process.env['ML_CLIENT_SECRET']!,
            refresh_token: refreshToken
          })
        },
        'oauth/token'
      )

      const data = await response.json()

      if (!response.ok) {
        logger.error(`[TokenRefresh] Falha no refresh para ${account.nickname}:`, { error: { error: data } })
        
        // Marca conta como inativa se refresh falhar
        await prisma.mLAccount.update({
          where: { id: account.id },
          data: {
            isActive: false,
            connectionError: data.error_description || data.error || 'Refresh failed'
          }
        })

        // Audit log
        await auditLog({
          action: 'token.refresh_failed',
          entityType: 'ml_account',
          entityId: account.id,
          organizationId: account.organizationId,
          metadata: { 
            error: data.error,
            mlUserId: account.mlUserId
          }
        })

        return { success: false, error: data.error }
      }

      // Criptografa novos tokens
      const encryptedAccess = encryptToken(data.access_token)
      const encryptedRefresh = encryptToken(data.refresh_token)

      // Atualiza no banco
      await prisma.mLAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          lastSyncAt: new Date(),
          connectionError: null
        }
      })

      // Agenda próximo refresh
      const expiresAt = new Date(Date.now() + data.expires_in * 1000)
      this.scheduleRefresh(account.id, expiresAt)

      // Audit log sucesso
      await auditLog({
        action: 'token.refreshed',
        entityType: 'ml_account',
        entityId: account.id,
        organizationId: account.organizationId,
        metadata: {
          mlUserId: account.mlUserId,
          expiresIn: data.expires_in
        }
      })

      logger.info(`[TokenRefresh] Token renovado com sucesso para ${account.nickname}`)
      
      return { 
        success: true, 
        accessToken: data.access_token 
      }
      
    } catch (error) {
      logger.error(`[TokenRefresh] Erro no refresh para ${account.nickname}:`, { error })
      
      await prisma.mLAccount.update({
        where: { id: account.id },
        data: {
          isActive: false,
          connectionError: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Agenda refresh automático 5 minutos antes de expirar
   */
  private scheduleRefresh(mlAccountId: string, expiresAt: Date): void {
    // Cancela agendamento anterior se houver
    if (this.refreshScheduler.has(mlAccountId)) {
      clearTimeout(this.refreshScheduler.get(mlAccountId)!)
    }

    // Calcula tempo até 5 min antes de expirar
    const refreshTime = expiresAt.getTime() - Date.now() - 5 * 60 * 1000
    
    if (refreshTime > 0) {
      const timeout = setTimeout(async () => {
        logger.info(`[TokenRefresh] Refresh agendado executando para ${mlAccountId}`)
        await this.getValidToken(mlAccountId)
      }, refreshTime)
      
      this.refreshScheduler.set(mlAccountId, timeout)
      
      logger.info(`[TokenRefresh] Refresh agendado para ${mlAccountId} em ${new Date(Date.now() + refreshTime)}`)
    }
  }

  /**
   * Monitora todas as contas ativas e agenda refreshes
   */
  private async startMonitoring(): Promise<void> {
    // Executa a cada hora
    setInterval(async () => {
      try {
        const accounts = await prisma.mLAccount.findMany({
          where: { isActive: true },
          select: {
            id: true,
            nickname: true,
            tokenExpiresAt: true
          }
        })

        for (const account of accounts) {
          // Agenda refresh se não estiver agendado
          if (!this.refreshScheduler.has(account.id)) {
            this.scheduleRefresh(account.id, account.tokenExpiresAt)
          }
        }

        logger.info(`[TokenRefresh] Monitorando ${accounts.length} contas ativas`)
        
      } catch (error) {
        logger.error('[TokenRefresh] Erro no monitoramento:', { error })
      }
    }, 60 * 60 * 1000) // 1 hora

    // Executa imediatamente na inicialização
    this.monitorAccounts()
  }

  private async monitorAccounts(): Promise<void> {
    const accounts = await prisma.mLAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nickname: true,
        tokenExpiresAt: true
      }
    })

    for (const account of accounts) {
      this.scheduleRefresh(account.id, account.tokenExpiresAt)
    }

    logger.info(`[TokenRefresh] Iniciado monitoramento de ${accounts.length} contas`)
  }

  /**
   * Para todos os agendamentos (para shutdown limpo)
   */
  stopAll(): void {
    for (const timeout of this.refreshScheduler.values()) {
      clearTimeout(timeout)
    }
    this.refreshScheduler.clear()
    logger.info('[TokenRefresh] Todos os agendamentos cancelados')
  }
}

// Singleton global
let instance: TokenRefreshManager | null = null

export function getTokenRefreshManager(): TokenRefreshManager {
  if (!instance) {
    instance = new TokenRefreshManager()
  }
  return instance
}

// Exporta funções auxiliares
export async function getValidMLToken(mlAccountId: string): Promise<string | null> {
  return getTokenRefreshManager().getValidToken(mlAccountId)
}

export function stopTokenRefresh(): void {
  getTokenRefreshManager().stopAll()
}

// Hook para shutdown gracioso
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    logger.info('[TokenRefresh] SIGTERM recebido, parando refresh...')
    stopTokenRefresh()
  })
  
  process.on('SIGINT', () => {
    logger.info('[TokenRefresh] SIGINT recebido, parando refresh...')
    stopTokenRefresh()
  })
}
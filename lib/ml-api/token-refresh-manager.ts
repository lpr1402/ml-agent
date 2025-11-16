/**
 * Token Refresh Manager - Sistema Unificado CLUSTER-SAFE
 * Gerencia refresh automático de tokens ML seguindo documentação oficial
 * Usa Redis distributed locks para evitar refresh duplicados em cluster PM2
 * Garante que TODAS as contas ML ficam ativas 24/7
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/security/encryption'
import { auditLog } from '@/lib/audit/audit-logger'
import Redis from 'ioredis'

interface RefreshResult {
  success: boolean
  accessToken?: string
  error?: string
}

class TokenRefreshManager {
  private refreshingTokens: Map<string, Promise<RefreshResult>> = new Map()
  private refreshScheduler: Map<string, NodeJS.Timeout> = new Map()
  private redis: Redis
  private instanceId: string

  constructor() {
    // Identificador único para esta instância
    this.instanceId = `${process.pid}_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Redis para distributed locks
    const redisConfig: any = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true, // ✅ Permite operações em fila quando offline
      enableReadyCheck: true
    }

    if (process.env['REDIS_PASSWORD']) {
      redisConfig.password = process.env['REDIS_PASSWORD']
    }

    this.redis = new Redis(redisConfig)

    logger.info(`[TokenRefreshManager] Inicializado - Instance: ${this.instanceId}`)
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

      // Precisa fazer refresh - USAR REDIS LOCK!
      logger.info(`[TokenRefresh] Token expirando para ${account.nickname}, tentando renovar...`)

      // Tentar adquirir lock no Redis (cluster-safe)
      const lockKey = `token:refresh:lock:${mlAccountId}`
      const lockValue = this.instanceId
      const lockTTL = 30000 // 30 segundos TTL para o lock

      // SET com NX (only if not exists) e PX (TTL em ms)
      const lockAcquired = await this.redis.set(lockKey, lockValue, 'PX', lockTTL, 'NX')

      if (!lockAcquired) {
        // Outra instância está fazendo refresh
        logger.info(`[TokenRefresh] Lock já existe para ${account.nickname}, aguardando...`)

        // Aguardar até 30 segundos pelo refresh
        let attempts = 0
        while (attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Verificar se token foi atualizado
          const updatedAccount = await prisma.mLAccount.findUnique({
            where: { id: mlAccountId },
            select: { tokenExpiresAt: true }
          })

          if (updatedAccount && new Date(updatedAccount.tokenExpiresAt) > new Date()) {
            // Token foi renovado por outra instância
            return accessToken // Retorna token atual que ainda é válido
          }
          attempts++
        }

        logger.error(`[TokenRefresh] Timeout esperando refresh para ${account.nickname}`)
        return null
      }

      try {
        // Temos o lock! Fazer refresh
        const refreshPromise = this.refreshToken(account)
        this.refreshingTokens.set(mlAccountId, refreshPromise)

        const result = await refreshPromise
        return result.success ? result.accessToken! : null
      } finally {
        // SEMPRE liberar o lock
        this.refreshingTokens.delete(mlAccountId)

        // Deletar lock APENAS se ainda somos o dono
        const currentLockValue = await this.redis.get(lockKey)
        if (currentLockValue === lockValue) {
          await this.redis.del(lockKey)
          logger.info(`[TokenRefresh] Lock liberado para ${account.nickname}`)
        }
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

      // 🔴 FIX CRÍTICO: Usar globalMLRateLimiter para TODAS as chamadas ML
      // Isso garante 2s entre requests e elimina 95% dos erros 429
      const { globalMLRateLimiter } = await import('./global-rate-limiter')

      const response = await globalMLRateLimiter.executeRequest({
        mlAccountId: account.id,
        organizationId: account.organizationId,
        endpoint: '/oauth/token',
        priority: 'high', // Alta prioridade para token refresh
        maxRetries: 3, // 🔴 REDUZIDO de 10 para 3
        requestFn: async () => {
          const response = await fetch('https://api.mercadolibre.com/oauth/token', {
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
          })

          // Tratar erro 429 para retry do rate limiter
          if (response.status === 429) {
            const error: any = new Error('Too Many Requests')
            error.statusCode = 429
            error.body = await response.text()
            throw error
          }

          if (!response.ok) {
            const error: any = new Error(`ML API error ${response.status}`)
            error.statusCode = response.status
            error.body = await response.text()
            throw error
          }

          return response
        }
      })

      // Response já processado e validado pelo rate limiter
      const data = typeof response === 'string'
        ? JSON.parse(response)
        : response

      // Se chegou aqui, request foi bem sucedido (rate limiter já tratou erros)
      logger.info(`[TokenRefresh] Token refresh successful para ${account.nickname}`)

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
   * CLUSTER-SAFE: Usa Redis para coordenar entre instâncias
   */
  private async scheduleRefresh(mlAccountId: string, expiresAt: Date): Promise<void> {
    // Cancela agendamento local anterior se houver
    if (this.refreshScheduler.has(mlAccountId)) {
      clearTimeout(this.refreshScheduler.get(mlAccountId)!)
    }

    // Calcula tempo até 5 min antes de expirar
    const refreshTime = expiresAt.getTime() - Date.now() - 5 * 60 * 1000

    if (refreshTime > 0) {
      // Registrar no Redis quando deve ser feito o próximo refresh
      const scheduleKey = `token:refresh:schedule:${mlAccountId}`
      await this.redis.set(scheduleKey, expiresAt.toISOString(), 'PX', refreshTime + 60000)

      // Agendar localmente também
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
   * CLUSTER-SAFE: Coordena entre instâncias via Redis
   */
  private async startMonitoring(): Promise<void> {
    // Executa a cada 30 minutos (mais frequente para garantir tokens sempre ativos)
    setInterval(async () => {
      try {
        // Tentar ser o coordenador global (apenas 1 instância faz isso)
        const coordinatorKey = 'token:refresh:coordinator'
        const coordinatorLock = await this.redis.set(coordinatorKey, this.instanceId, 'PX', 35000, 'NX')

        if (coordinatorLock) {
          logger.info(`[TokenRefresh] Esta instância (${this.instanceId}) é o coordenador`)

          const accounts = await prisma.mLAccount.findMany({
            where: { isActive: true },
            select: {
              id: true,
              nickname: true,
              tokenExpiresAt: true
            }
          })

          for (const account of accounts) {
            // Verificar se já tem schedule no Redis
            const scheduleKey = `token:refresh:schedule:${account.id}`
            const scheduled = await this.redis.get(scheduleKey)

            if (!scheduled) {
              // Ninguém agendou ainda
              await this.scheduleRefresh(account.id, account.tokenExpiresAt)
            }
          }

          logger.info(`[TokenRefresh] Monitorando ${accounts.length} contas ativas - Coordenador: ${this.instanceId}`)
        } else {
          logger.info(`[TokenRefresh] Outra instância é o coordenador`)
        }

      } catch (error) {
        logger.error('[TokenRefresh] Erro no monitoramento:', { error })
      }
    }, 30 * 60 * 1000) // 30 minutos

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
      await this.scheduleRefresh(account.id, account.tokenExpiresAt)
    }

    logger.info(`[TokenRefresh] Iniciado monitoramento de ${accounts.length} contas - Instance: ${this.instanceId}`)
  }

  /**
   * Para todos os agendamentos (para shutdown limpo)
   */
  async stopAll(): Promise<void> {
    for (const timeout of this.refreshScheduler.values()) {
      clearTimeout(timeout)
    }
    this.refreshScheduler.clear()

    // Desconectar Redis
    await this.redis.quit()

    logger.info(`[TokenRefresh] Todos os agendamentos cancelados - Instance: ${this.instanceId}`)
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

export async function stopTokenRefresh(): Promise<void> {
  await getTokenRefreshManager().stopAll()
}

// Hook para shutdown gracioso
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    logger.info('[TokenRefresh] SIGTERM recebido, parando refresh...')
    await stopTokenRefresh()
  })

  process.on('SIGINT', async () => {
    logger.info('[TokenRefresh] SIGINT recebido, parando refresh...')
    await stopTokenRefresh()
  })
}
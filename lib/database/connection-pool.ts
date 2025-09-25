/**
 * Otimização de pool de conexões para produção
 * Gerencia conexões do Prisma de forma eficiente
 */

import { logger } from '@/lib/logger'

interface PoolConfig {
  connectionLimit: number
  connectionTimeoutMillis: number
  idleTimeoutMillis: number
  maxRetries: number
}

export class ConnectionPoolOptimizer {
  private static config: PoolConfig = {
    connectionLimit: 20,           // Pool total para 10 contas ML
    connectionTimeoutMillis: 5000, // Timeout de conexão
    idleTimeoutMillis: 10000,      // Timeout de idle
    maxRetries: 3                  // Tentativas de reconexão
  }

  /**
   * Otimiza URL de conexão com parâmetros do pool
   */
  static optimizeConnectionUrl(baseUrl: string): string {
    const url = new URL(baseUrl)

    // Adicionar parâmetros de otimização
    url.searchParams.set('connection_limit', this.config.connectionLimit.toString())
    url.searchParams.set('pool_timeout', '10')
    url.searchParams.set('connect_timeout', '5')
    url.searchParams.set('statement_timeout', '30000') // 30s max por query
    url.searchParams.set('idle_in_transaction_session_timeout', '10000') // 10s

    // Otimizações específicas do PostgreSQL
    url.searchParams.set('pgbouncer', 'true')
    url.searchParams.set('application_name', 'ml-agent-production')

    logger.info('[ConnectionPool] Optimized database URL', {
      connectionLimit: this.config.connectionLimit,
      poolTimeout: 10,
      connectTimeout: 5
    })

    return url.toString()
  }

  /**
   * Monitora saúde do pool
   */
  static async checkPoolHealth(prismaClient: any): Promise<{
    healthy: boolean
    activeConnections: number
    idleConnections: number
    waitingRequests: number
  }> {
    try {
      // Query para verificar conexões ativas
      const result = await prismaClient.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle,
          COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND application_name = 'ml-agent-production'
      `

      const stats = result[0] || { active: 0, idle: 0, idle_in_transaction: 0 }

      const healthy = stats.active < this.config.connectionLimit * 0.8 // Alerta em 80%

      if (!healthy) {
        logger.warn('[ConnectionPool] Pool approaching limit', stats)
      }

      return {
        healthy,
        activeConnections: Number(stats.active),
        idleConnections: Number(stats.idle),
        waitingRequests: Number(stats.idle_in_transaction)
      }
    } catch (error) {
      logger.error('[ConnectionPool] Health check failed', { error })
      return {
        healthy: false,
        activeConnections: -1,
        idleConnections: -1,
        waitingRequests: -1
      }
    }
  }

  /**
   * Limpa conexões idle
   */
  static async cleanupIdleConnections(prismaClient: any): Promise<number> {
    try {
      const result = await prismaClient.$executeRaw`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state = 'idle'
          AND state_change < NOW() - INTERVAL '10 minutes'
          AND application_name = 'ml-agent-production'
      `

      if (result > 0) {
        logger.info(`[ConnectionPool] Cleaned up ${result} idle connections`)
      }

      return result
    } catch (error) {
      logger.error('[ConnectionPool] Cleanup failed', { error })
      return 0
    }
  }

  /**
   * Otimiza queries com prepared statements
   */
  static prepareBatchQueries() {
    return {
      findQuestion: `
        SELECT * FROM "Question"
        WHERE "mlQuestionId" = $1
        LIMIT 1
      `,
      findMLAccount: `
        SELECT id, "mlUserId", "organizationId"
        FROM "MLAccount"
        WHERE "mlUserId" = $1 AND "isActive" = true
        LIMIT 1
      `,
      createQuestion: `
        INSERT INTO "Question" (
          "mlQuestionId", "mlAccountId", "sellerId", "itemId",
          "text", "status", "dateCreated", "receivedAt", "sequentialId"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("mlQuestionId") DO NOTHING
        RETURNING id
      `
    }
  }

  /**
   * Configuração de retry com backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    let lastError: any

    for (let i = 0; i < retries; i++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error

        // Verificar se é erro de conexão
        if (error.code === 'P1001' || error.code === 'P1002') {
          const delay = Math.min(1000 * Math.pow(2, i), 5000) // Exponential backoff
          logger.warn(`[ConnectionPool] Retrying after ${delay}ms (attempt ${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // Se não é erro de conexão, falha imediatamente
        throw error
      }
    }

    throw lastError
  }
}
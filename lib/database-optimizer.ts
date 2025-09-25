/**
 * Database Performance Optimizer
 * Configurações otimizadas para 10k+ usuários simultâneos
 */

import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

// Pool configuration for production scale
const CONNECTION_LIMIT = parseInt(process.env['DB_POOL_SIZE'] || '100')
const POOL_TIMEOUT = parseInt(process.env['DB_POOL_TIMEOUT'] || '5000')
const STATEMENT_TIMEOUT = parseInt(process.env['DB_STATEMENT_TIMEOUT'] || '10000')
const IDLE_TIMEOUT = parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000')

/**
 * Cria URL otimizada do PostgreSQL com parâmetros de performance
 */
export function getOptimizedDatabaseUrl(): string {
  const baseUrl = process.env['DATABASE_URL'] || ''
  
  if (!baseUrl) {
    throw new Error('DATABASE_URL not configured')
  }

  // Parse URL
  const url = new URL(baseUrl)
  
  // Adiciona parâmetros de otimização
  const params = new URLSearchParams({
    // Pool configuration
    connection_limit: CONNECTION_LIMIT.toString(),
    pool_timeout: POOL_TIMEOUT.toString(),
    
    // Statement and query timeouts
    statement_timeout: STATEMENT_TIMEOUT.toString(),
    idle_in_transaction_session_timeout: IDLE_TIMEOUT.toString(),
    
    // PostgreSQL optimizations
    pgbouncer: 'true',
    sslmode: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
    
    // Prepared statements (melhor performance)
    prepare: 'true',
    
    // Schema caching
    schema: 'public'
  })

  url.search = params.toString()
  return url.toString()
}

/**
 * Cria cliente Prisma otimizado com logging e hooks
 */
export function createOptimizedPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: getOptimizedDatabaseUrl()
      }
    },
    log: [
      // Log apenas queries lentas em produção
      {
        emit: 'event',
        level: 'query'
      },
      {
        emit: 'event',
        level: 'error'
      },
      {
        emit: 'event',
        level: 'warn'
      }
    ]
  })

  // Monitor slow queries
  client.$on('query' as never, (e: any) => {
    if (e.duration > 1000) {
      logger.warn('[DB] Slow query detected', {
        query: e.query,
        params: e.params,
        duration: e.duration,
        target: e.target
      })
    }
  })

  // Monitor errors
  client.$on('error' as never, (e: any) => {
    logger.error('[DB] Database error', {
      message: e.message,
      target: e.target
    })
  })

  // Monitor warnings
  client.$on('warn' as never, (e: any) => {
    logger.warn('[DB] Database warning', {
      message: e.message,
      target: e.target
    })
  })

  return client
}

/**
 * Health check para o database
 */
export async function checkDatabaseHealth(client: PrismaClient): Promise<{
  healthy: boolean
  latency: number
  connections: number
  details?: any
}> {
  const start = Date.now()
  
  try {
    // Query simples para medir latência
    await client.$queryRaw`SELECT 1`
    
    // Obtém estatísticas de conexão
    const poolStats = await client.$queryRaw<Array<{
      count: bigint
      state: string
    }>>`
      SELECT COUNT(*), state 
      FROM pg_stat_activity 
      WHERE datname = current_database() 
      GROUP BY state
    `
    
    const latency = Date.now() - start
    const activeConnections = poolStats.reduce((acc, stat) => 
      acc + Number(stat.count), 0
    )

    return {
      healthy: true,
      latency,
      connections: activeConnections,
      details: poolStats.map(s => ({
        state: s.state,
        count: Number(s.count)
      }))
    }
  } catch (error) {
    logger.error('[DB] Health check failed', { error })
    return {
      healthy: false,
      latency: Date.now() - start,
      connections: 0,
      details: { error: String(error) }
    }
  }
}

/**
 * Otimizações de índices essenciais
 */
export const CRITICAL_INDEXES = [
  // Questions performance indexes
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_performance 
   ON "Question" ("mlAccountId", "status", "receivedAt" DESC)`,
  
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_metrics 
   ON "Question" ("sellerId", "status", "dateCreated" DESC) 
   WHERE "status" IN ('COMPLETED', 'ANSWERED')`,
  
  // Webhook processing
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_processing 
   ON "WebhookEvent" ("organizationId", "status", "receivedAt") 
   WHERE "processed" = false`,
  
  // Session cleanup
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_cleanup 
   ON "Session" ("expiresAt") 
   WHERE "expiresAt" < NOW()`,
  
  // Organization lookup
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_primary_lookup 
   ON "Organization"("primaryMLUserId") 
   WHERE "primaryMLUserId" IS NOT NULL`,
  
  // MLAccount primary lookup
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_account_primary 
   ON "MLAccount"("organizationId", "isPrimary") 
   WHERE "isPrimary" = true`,
  
  // Token expiration tracking
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_account_token_expiry 
   ON "MLAccount"("tokenExpiresAt", "isActive") 
   WHERE "isActive" = true`
]

/**
 * Aplica índices críticos no database
 */
export async function applyPerformanceIndexes(client: PrismaClient): Promise<void> {
  logger.info('[DB] Applying performance indexes...')
  
  for (const indexSql of CRITICAL_INDEXES) {
    try {
      await client.$executeRawUnsafe(indexSql)
      logger.info('[DB] Index applied successfully', { 
        index: indexSql.match(/idx_\w+/)?.[0] 
      })
    } catch (error: any) {
      // Ignora erro se índice já existe
      if (!error.message?.includes('already exists')) {
        logger.error('[DB] Failed to create index', { error, sql: indexSql })
      }
    }
  }
  
  logger.info('[DB] Performance indexes applied')
}

/**
 * Configurações de statement timeout por tipo de query
 */
export const QUERY_TIMEOUTS = {
  // Queries rápidas (< 100ms esperado)
  fast: 1000,
  
  // Queries normais (< 500ms esperado)
  normal: 5000,
  
  // Queries complexas (< 2s esperado)
  complex: 10000,
  
  // Queries de relatório (< 10s esperado)
  report: 30000,
  
  // Migrations e operações administrativas
  admin: 60000
}

/**
 * Wrapper para queries com timeout específico
 */
export async function queryWithTimeout<T>(
  client: PrismaClient,
  operation: () => Promise<T>,
  timeout: number = QUERY_TIMEOUTS.normal
): Promise<T> {
  // Set statement timeout for this transaction
  await client.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeout}`)
  
  try {
    return await operation()
  } finally {
    // Reset to default
    await client.$executeRawUnsafe(`RESET statement_timeout`)
  }
}

export default {
  getOptimizedDatabaseUrl,
  createOptimizedPrismaClient,
  checkDatabaseHealth,
  applyPerformanceIndexes,
  queryWithTimeout,
  QUERY_TIMEOUTS
}
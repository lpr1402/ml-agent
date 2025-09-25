/**
 * Database Connection Pool Configuration
 * Otimizado para suportar milhares de usuários simultâneos
 * Pool sizing baseado em best practices para PostgreSQL
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

/**
 * Configuração otimizada de pool para produção
 * Fórmula: connections = ((core_count * 2) + effective_spindle_count)
 * Para 4 cores: (4 * 2) + 1 = 9 conexões por instância
 */
const poolConfig = {
  // Número máximo de conexões no pool
  connection_limit: parseInt(process.env['DB_POOL_SIZE'] || '20'),
  
  // Tempo máximo de espera por conexão (ms)
  pool_timeout: parseInt(process.env['DB_POOL_TIMEOUT'] || '2000'),
  
  // Tempo de idle antes de fechar conexão (ms)
  idle_in_transaction_session_timeout: parseInt(process.env['DB_IDLE_TIMEOUT'] || '10000'),
  
  // Statement timeout para prevenir queries longas (ms)
  statement_timeout: parseInt(process.env['DB_STATEMENT_TIMEOUT'] || '10000'),
  
  // Número de tentativas de conexão
  connect_timeout: parseInt(process.env['DB_CONNECT_TIMEOUT'] || '10'),
}

/**
 * URL de conexão com parâmetros de pool
 * Formato: postgresql://user:pass@host:port/db?param1=value1&param2=value2
 */
function buildDatabaseUrl(): string {
  const baseUrl = process.env['DATABASE_URL']
  
  if (!baseUrl) {
    throw new Error('DATABASE_URL not configured')
  }
  
  // Parse URL para adicionar parâmetros
  const url = new URL(baseUrl)
  
  // Adiciona parâmetros de pool
  url.searchParams.set('connection_limit', poolConfig.connection_limit.toString())
  url.searchParams.set('pool_timeout', poolConfig.pool_timeout.toString())
  url.searchParams.set('statement_timeout', poolConfig.statement_timeout.toString())
  url.searchParams.set('connect_timeout', poolConfig.connect_timeout.toString())
  url.searchParams.set('idle_in_transaction_session_timeout', poolConfig.idle_in_transaction_session_timeout.toString())
  
  // Parâmetros adicionais para performance
  url.searchParams.set('schema', 'public')
  url.searchParams.set('sslmode', process.env['NODE_ENV'] === 'production' ? 'require' : 'prefer')
  url.searchParams.set('pgbouncer', 'true') // Compatível com PgBouncer se usado
  
  return url.toString()
}

/**
 * Cliente Prisma com pool otimizado
 */
export const prismaPooled = new PrismaClient({
  datasources: {
    db: {
      url: buildDatabaseUrl()
    }
  },
  log: process.env['NODE_ENV'] === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  errorFormat: 'minimal'
})

/**
 * Nota: Middleware $use foi removido no Prisma 5
 * Para logging de queries lentas, usar extensões ou telemetry
 * Mantendo código comentado para referência futura
 */
// prismaPooled.$use(async (params, next) => {
//   const before = Date.now()
//   const result = await next(params)
//   const after = Date.now()
//   const duration = after - before
//   
//   // Log queries lentas (> 100ms)
//   if (duration > 100) {
//     logger.warn('[Database] Slow query detected', {
//       model: params.model,
//       action: params.action,
//       duration: `${duration}ms`,
//       args: process.env['NODE_ENV'] === 'development' ? params.args : undefined
//     })
//   }
//   
//   // Adiciona métrica Prometheus
//   if (global.dbQueryLatency) {
//     global.dbQueryLatency.observe(
//       { operation: params.action || 'unknown', table: params.model || 'unknown' },
//       duration / 1000
//     )
//   }
//   
//   return result
// })

/**
 * Health check do pool
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  connections: number
  latency: number
  error?: string
}> {
  const start = Date.now()
  
  try {
    // Query simples para testar conexão
    await prismaPooled.$queryRaw`SELECT 1`
    
    // Obtém estatísticas do pool (se disponível)
    const poolStats = await prismaPooled.$queryRaw<Array<{
      numbackends: number
      max_connections: number
    }>>`
      SELECT 
        COUNT(*) as numbackends,
        setting::int as max_connections
      FROM pg_stat_activity, pg_settings
      WHERE pg_settings.name = 'max_connections'
      GROUP BY setting
    `
    
    const latency = Date.now() - start
    
    return {
      healthy: true,
      connections: poolStats[0]?.numbackends || 0,
      latency
    }
  } catch (error: any) {
    logger.error('[Database] Health check failed', { error })
    
    return {
      healthy: false,
      connections: 0,
      latency: Date.now() - start,
      error: error.message
    }
  }
}

/**
 * Monitora uso do pool
 */
export async function monitorPoolUsage(): Promise<{
  active: number
  idle: number
  waiting: number
  max: number
  utilization: number
}> {
  try {
    const stats = await prismaPooled.$queryRaw<Array<{
      active: number
      idle: number
      waiting: number
    }>>`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
    `
    
    const result = stats[0] || { active: 0, idle: 0, waiting: 0 }
    
    return {
      active: result.active,
      idle: result.idle,
      waiting: result.waiting,
      max: poolConfig.connection_limit,
      utilization: Math.round((result.active / poolConfig.connection_limit) * 100)
    }
  } catch (error) {
    logger.error('[Database] Failed to get pool stats', { error })
    
    return {
      active: 0,
      idle: 0,
      waiting: 0,
      max: poolConfig.connection_limit,
      utilization: 0
    }
  }
}

/**
 * Cleanup ao desligar aplicação
 */
process.on('beforeExit', async () => {
  logger.info('[Database] Closing connection pool')
  await prismaPooled.$disconnect()
})

// Monitora pool periodicamente
if (process.env['NODE_ENV'] === 'production') {
  setInterval(async () => {
    const usage = await monitorPoolUsage()
    
    if (usage.utilization > 80) {
      logger.warn('[Database] Pool utilization high', usage)
    }
    
    // Métricas Prometheus comentadas - configurar quando necessário
    // if (global.dbPoolConnections) {
    //   global.dbPoolConnections.set({ status: 'active' }, usage.active)
    //   global.dbPoolConnections.set({ status: 'idle' }, usage.idle)
    //   global.dbPoolConnections.set({ status: 'waiting' }, usage.waiting)
    // }
  }, 30000) // A cada 30 segundos
}

logger.info('[Database] Connection pool initialized', {
  maxConnections: poolConfig.connection_limit,
  poolTimeout: poolConfig.pool_timeout,
  statementTimeout: poolConfig.statement_timeout
})

export default prismaPooled
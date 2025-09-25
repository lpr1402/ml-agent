/**
 * Optimized Prisma Client Configuration
 * Production-ready database connection pooling for 10k+ users
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

// Parse environment variables with defaults
const DB_POOL_SIZE = parseInt(process.env['DB_POOL_SIZE'] || '50')
const DB_POOL_TIMEOUT = parseInt(process.env['DB_POOL_TIMEOUT'] || '5000')
const DB_STATEMENT_TIMEOUT = parseInt(process.env['DB_STATEMENT_TIMEOUT'] || '10000')
const DB_IDLE_TIMEOUT = parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000')
const DB_CONNECTION_TIMEOUT = parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '5000')

/**
 * Create optimized Prisma client with proper pooling
 */
function createOptimizedPrismaClient(): PrismaClient {
  // Build connection string with pool parameters
  const baseUrl = process.env['DATABASE_URL'] || ''
  const url = new URL(baseUrl)
  
  // Add connection pool parameters
  url.searchParams.set('connection_limit', DB_POOL_SIZE.toString())
  url.searchParams.set('pool_timeout', (DB_POOL_TIMEOUT / 1000).toString())
  url.searchParams.set('statement_timeout', DB_STATEMENT_TIMEOUT.toString())
  url.searchParams.set('idle_in_transaction_session_timeout', DB_IDLE_TIMEOUT.toString())
  url.searchParams.set('connect_timeout', (DB_CONNECTION_TIMEOUT / 1000).toString())
  
  // PostgreSQL specific optimizations
  url.searchParams.set('pgbouncer', 'true') // Enable PgBouncer compatibility
  url.searchParams.set('schema', 'public')
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url.toString()
      }
    },
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    errorFormat: 'minimal'
  })

  // Add middleware for monitoring
  ;(prisma as any).$use(async (params: any, next: any) => {
    const before = Date.now()
    
    try {
      const result = await next(params)
      const after = Date.now()
      const duration = after - before
      
      // Log slow queries
      if (duration > 1000) {
        logger.warn('[Database] Slow query detected', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`
        })
      }
      
      return result
    } catch (error: any) {
      const after = Date.now()
      const duration = after - before
      
      // Log database errors with context
      logger.error('[Database] Query failed', {
        model: params.model,
        action: params.action,
        duration: `${duration}ms`,
        error: error.message,
        code: error.code
      })
      
      // Handle specific database errors
      if (error.code === 'P2024') {
        // Pool timeout
        logger.error('[Database] Connection pool timeout - consider increasing pool size')
      } else if (error.code === 'P2025') {
        // Record not found
        // This is often expected, don't log as error
        logger.debug('[Database] Record not found', {
          model: params.model,
          action: params.action
        })
      }
      
      throw error
    }
  })

  return prisma
}

// Global singleton with proper cleanup
declare global {
  var __optimizedPrisma: PrismaClient | undefined
}

let optimizedPrisma: PrismaClient

if (process.env.NODE_ENV === 'production') {
  optimizedPrisma = createOptimizedPrismaClient()
} else {
  // In development, use global to prevent multiple instances
  if (!global.__optimizedPrisma) {
    global.__optimizedPrisma = createOptimizedPrismaClient()
  }
  optimizedPrisma = global.__optimizedPrisma
}

// Connection pool monitoring
if (process.env.NODE_ENV === 'production') {
  // Monitor pool health every 30 seconds
  setInterval(async () => {
    try {
      // Execute a simple query to check connection
      await optimizedPrisma.$queryRaw`SELECT 1`
      
      // Get pool metrics (if available through pg_stat_database)
      const metrics = await optimizedPrisma.$queryRaw`
        SELECT 
          numbackends as active_connections,
          xact_commit as committed_transactions,
          xact_rollback as rolled_back_transactions,
          blks_hit as cache_hits,
          blks_read as disk_reads,
          tup_fetched as rows_fetched
        FROM pg_stat_database 
        WHERE datname = current_database()
      ` as any[]
      
      if (metrics && metrics[0]) {
        const poolUtilization = (metrics[0].active_connections / DB_POOL_SIZE) * 100
        
        logger.info('[Database] Pool metrics', {
          activeConnections: metrics[0].active_connections,
          poolSize: DB_POOL_SIZE,
          utilization: `${poolUtilization.toFixed(1)}%`,
          cacheHitRatio: metrics[0].cache_hits / (metrics[0].cache_hits + metrics[0].disk_reads) * 100
        })
        
        // Alert if pool is near capacity
        if (poolUtilization > 80) {
          logger.warn('[Database] Connection pool utilization high', {
            utilization: `${poolUtilization.toFixed(1)}%`,
            activeConnections: metrics[0].active_connections,
            poolSize: DB_POOL_SIZE
          })
        }
      }
    } catch (error) {
      logger.error('[Database] Health check failed', { error })
    }
  }, 30000)
}

// Graceful shutdown
async function handleShutdown() {
  logger.info('[Database] Closing database connections...')
  
  try {
    await optimizedPrisma.$disconnect()
    logger.info('[Database] Database connections closed')
  } catch (error) {
    logger.error('[Database] Error closing connections', { error })
  }
}

process.on('SIGTERM', handleShutdown)
process.on('SIGINT', handleShutdown)

// Export optimized client
export { optimizedPrisma }

// Export connection statistics
export async function getDatabaseStats() {
  try {
    const stats = await optimizedPrisma.$queryRaw`
      SELECT 
        numbackends as active_connections,
        xact_commit as committed_transactions,
        xact_rollback as rolled_back_transactions,
        blks_hit as cache_hits,
        blks_read as disk_reads,
        tup_fetched as rows_fetched,
        tup_inserted as rows_inserted,
        tup_updated as rows_updated,
        tup_deleted as rows_deleted,
        deadlocks,
        temp_files,
        temp_bytes
      FROM pg_stat_database 
      WHERE datname = current_database()
    ` as any[]
    
    if (stats && stats[0]) {
      const cacheHitRatio = stats[0].cache_hits / (stats[0].cache_hits + stats[0].disk_reads) * 100
      
      return {
        activeConnections: stats[0].active_connections,
        maxConnections: DB_POOL_SIZE,
        utilizationPercent: (stats[0].active_connections / DB_POOL_SIZE) * 100,
        cacheHitRatio: cacheHitRatio.toFixed(2),
        transactions: {
          committed: stats[0].committed_transactions,
          rolledBack: stats[0].rolled_back_transactions
        },
        operations: {
          fetched: stats[0].rows_fetched,
          inserted: stats[0].rows_inserted,
          updated: stats[0].rows_updated,
          deleted: stats[0].rows_deleted
        },
        issues: {
          deadlocks: stats[0].deadlocks,
          tempFiles: stats[0].temp_files
        }
      }
    }
    
    return null
  } catch (error) {
    logger.error('[Database] Failed to get statistics', { error })
    return null
  }
}
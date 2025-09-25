/**
 * Query Optimizer - Otimiza queries Prisma para máxima performance
 * Previne N+1 queries e implementa best practices
 * Production-ready para 10.000+ vendedores
 */

import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

/**
 * Configurações otimizadas de includes para evitar N+1
 */
export const OPTIMIZED_INCLUDES = {
  // MLAccount com dados relacionados essenciais
  mlAccountFull: {
    organization: {
      select: {
        id: true,
        primaryNickname: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true
      }
    },
    questions: {
      take: 10,
      orderBy: { dateCreated: 'desc' as const },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        dateCreated: true
      }
    },
    metrics: {
      take: 1,
      orderBy: { date: 'desc' as const }
    }
  } satisfies Prisma.MLAccountInclude,
  
  // Question com dados mínimos necessários
  questionWithAccount: {
    mlAccount: {
      select: {
        id: true,
        nickname: true,
        mlUserId: true,
        organizationId: true
      }
    },
    revisions: {
      orderBy: { createdAt: 'desc' as const },
      take: 1
    }
  } satisfies Prisma.QuestionInclude,
  
  // Organization com contas
  organizationWithAccounts: {
    mlAccounts: {
      where: { isActive: true },
      select: {
        id: true,
        mlUserId: true,
        nickname: true,
        isPrimary: true,
        lastSyncAt: true,
        tokenExpiresAt: true
      }
    },
    sessions: {
      where: { 
        expiresAt: { gt: new Date() }
      },
      take: 5,
      orderBy: { createdAt: 'desc' as const }
    }
  } satisfies Prisma.OrganizationInclude
}

/**
 * Otimizações de where clauses
 */
export const OPTIMIZED_WHERE = {
  // Contas ativas com token válido
  activeMLAccount: {
    isActive: true,
    tokenExpiresAt: { gt: new Date() },
    connectionError: null
  } satisfies Prisma.MLAccountWhereInput,
  
  // Questions pendentes
  pendingQuestions: {
    status: { in: ['RECEIVED', 'PROCESSING'] },
    answeredAt: null
  } satisfies Prisma.QuestionWhereInput,
  
  // Organizações ativas
  activeOrganization: {
    subscriptionStatus: { in: ['TRIAL', 'ACTIVE'] }
  } satisfies Prisma.OrganizationWhereInput
}

/**
 * Configurações de paginação otimizadas
 */
export const PAGINATION_DEFAULTS = {
  QUESTIONS_PER_PAGE: 20,
  METRICS_PER_PAGE: 50,
  ACCOUNTS_PER_PAGE: 10,
  MAX_PAGE_SIZE: 100
}

/**
 * Helper para criar query com paginação
 */
export function paginateQuery(
  page: number = 1,
  pageSize: number = PAGINATION_DEFAULTS.QUESTIONS_PER_PAGE
): { skip: number; take: number } {
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(pageSize, PAGINATION_DEFAULTS.MAX_PAGE_SIZE)
  
  return {
    skip: (safePage - 1) * safePageSize,
    take: safePageSize
  }
}

/**
 * Helper para criar índices compostos eficientes
 */
export function createOptimalIndexes(): string[] {
  return [
    // Índices para MLAccount
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mlaccount_org_active ON "MLAccount"("organizationId", "isActive") WHERE "isActive" = true',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mlaccount_token_expires ON "MLAccount"("tokenExpiresAt") WHERE "isActive" = true',
    
    // Índices para Question
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_account_status ON "Question"("mlAccountId", "status", "dateCreated")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_pending ON "Question"("status") WHERE "status" IN (\'RECEIVED\', \'PROCESSING\')',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_date_range ON "Question"("dateCreated") WHERE "dateCreated" > NOW() - INTERVAL \'7 days\'',
    
    // Índices para métricas
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_account_date ON "MLMetrics"("mlAccountId", "date" DESC)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_type ON "MLMetrics"("metricType", "date" DESC)',
    
    // Índices para WebhookEvent
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_pending ON "WebhookEvent"("status", "receivedAt") WHERE "processed" = false',
    
    // Índices para Session
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_active ON "Session"("organizationId", "expiresAt") WHERE "expiresAt" > NOW()'
  ]
}

/**
 * Query builder otimizado para relatórios
 */
export class OptimizedQueryBuilder {
  /**
   * Busca questions com dados relacionados otimizados
   */
  static questionsWithFullData(mlAccountId: string, limit: number = 20) {
    return {
      where: {
        mlAccountId,
        ...OPTIMIZED_WHERE.pendingQuestions
      },
      include: OPTIMIZED_INCLUDES.questionWithAccount,
      orderBy: { dateCreated: 'desc' as const },
      take: limit
    }
  }
  
  /**
   * Busca métricas agregadas eficientemente
   */
  static async getAggregatedMetrics(
    _organizationId: string,
    _startDate: Date,
    _endDate: Date
  ) {
    // Usa query raw otimizada para agregação
    return `
      SELECT 
        DATE_TRUNC('day', m.date) as day,
        m."metricType",
        SUM(m.value) as total,
        AVG(m.value) as average,
        COUNT(*) as count
      FROM "MLMetrics" m
      JOIN "MLAccount" a ON a.id = m."mlAccountId"
      WHERE 
        a."organizationId" = $1
        AND m.date BETWEEN $2 AND $3
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2
    `
  }
  
  /**
   * Query para dashboard otimizada
   */
  static dashboardData(organizationId: string) {
    return {
      organization: {
        where: { id: organizationId },
        include: OPTIMIZED_INCLUDES.organizationWithAccounts
      },
      recentQuestions: {
        where: {
          mlAccount: {
            organizationId
          },
          dateCreated: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        select: {
          id: true,
          status: true,
          dateCreated: true,
          mlAccount: {
            select: {
              nickname: true
            }
          }
        },
        take: 10,
        orderBy: { dateCreated: 'desc' as const }
      }
    }
  }
}

/**
 * Connection pool optimization
 */
export const CONNECTION_POOL_CONFIG = {
  // Para 10.000+ vendedores
  connection_limit: 100,        // Total de conexões no pool
  pool_timeout: 10,             // Timeout para obter conexão (segundos)
  idle_in_transaction_session_timeout: 10, // Timeout para transações idle
  statement_timeout: 30000,     // Timeout para statements (30s)
  
  // Otimizações específicas do PostgreSQL
  pgBouncer: {
    pool_mode: 'transaction',
    max_client_conn: 1000,
    default_pool_size: 25,
    min_pool_size: 10,
    reserve_pool_size: 5,
    server_lifetime: 3600,
    server_idle_timeout: 600
  }
}

/**
 * Monitora performance de queries
 */
export class QueryPerformanceMonitor {
  private static slowQueryThreshold = 1000 // 1 segundo
  
  static async monitorQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await queryFn()
      const duration = Date.now() - startTime
      
      if (duration > this.slowQueryThreshold) {
        logger.warn('[QueryOptimizer] Slow query detected', {
          queryName,
          duration,
          threshold: this.slowQueryThreshold
        })
      }
      
      return result
    } catch (error) {
      logger.error('[QueryOptimizer] Query failed', {
        queryName,
        error,
        duration: Date.now() - startTime
      })
      throw error
    }
  }
}

/**
 * Batch operations para reduzir round trips
 */
export class BatchOperations {
  /**
   * Atualiza múltiplos registros em uma transação
   */
  static async batchUpdate<T>(
    prisma: any,
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    return prisma.$transaction(operations)
  }
  
  /**
   * Insert em batch otimizado
   */
  static async batchInsert(
    prisma: any,
    model: string,
    data: any[]
  ): Promise<number> {
    // Usa createMany para insert em batch
    const result = await prisma[model].createMany({
      data,
      skipDuplicates: true
    })
    
    return result.count
  }
}
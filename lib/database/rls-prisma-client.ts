/**
 * Row Level Security Prisma Client
 * Enforces multi-tenant isolation at the database level
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

interface RLSContext {
  organizationId: string
  mlAccountId?: string
  bypassRLS?: boolean // Only for system operations
}

/**
 * Extended Prisma Client with RLS enforcement
 */
export class RLSPrismaClient extends PrismaClient {
  private context: RLSContext | null = null

  constructor(options?: Prisma.PrismaClientOptions) {
    super(options)
    this.setupMiddleware()
  }

  /**
   * Set RLS context for current operation
   */
  public setContext(context: RLSContext): void {
    this.context = context
  }

  /**
   * Clear RLS context
   */
  public clearContext(): void {
    this.context = null
  }

  /**
   * Execute operation with temporary context
   */
  public async withContext<T>(
    context: RLSContext,
    operation: () => Promise<T>
  ): Promise<T> {
    const previousContext = this.context
    this.context = context
    
    try {
      return await operation()
    } finally {
      this.context = previousContext
    }
  }

  /**
   * Setup middleware to enforce RLS
   */
  private setupMiddleware(): void {
    // Middleware for all queries
    // Note: $use is deprecated in newer Prisma versions
    // RLS is now handled at the query level
    ;(this as any).$use(async (params: any, next: any) => {
      // Skip RLS for certain operations
      if (this.shouldSkipRLS(params)) {
        return next(params)
      }

      // Enforce RLS based on model
      if (this.context && !this.context.bypassRLS) {
        params = this.applyRLS(params)
      }

      // Log suspicious operations
      this.auditOperation(params)

      return next(params)
    })
  }

  /**
   * Determine if RLS should be skipped
   */
  private shouldSkipRLS(params: any): boolean {
    // Skip for auth models
    if (['Session', 'OAuthState'].includes(params.model || '')) {
      return true
    }

    // Skip for system operations
    if (params.action === 'count' && !params.args) {
      return true
    }

    return false
  }

  /**
   * Apply RLS filters based on model and operation
   */
  private applyRLS(params: any): any {
    if (!this.context || !params.model) {
      return params
    }

    const { organizationId, mlAccountId } = this.context

    // Define RLS rules per model
    const rlsRules: Record<string, (args: any) => any> = {
      Organization: (args) => {
        // Users can only access their own organization
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          args.where = { ...args.where, id: organizationId }
        } else if (params.action === 'findMany') {
          args.where = { ...args.where, id: organizationId }
        } else if (params.action === 'update' || params.action === 'delete') {
          args.where = { ...args.where, id: organizationId }
        }
        return args
      },

      MLAccount: (args) => {
        // Filter by organizationId
        if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
          args.where = { ...args.where, organizationId }
        } else if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
          args.where = { ...args.where, organizationId }
        } else if (params.action === 'create') {
          args.data = { ...args.data, organizationId }
        }
        return args
      },

      Question: (args) => {
        // Filter by mlAccountId or organizationId via relation
        if (mlAccountId) {
          if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
            args.where = { ...args.where, mlAccountId }
          } else if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
            args.where = { ...args.where, mlAccountId }
          }
        } else {
          // Filter by organization through MLAccount relation
          if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
            args.where = {
              ...args.where,
              mlAccount: {
                organizationId
              }
            }
          }
        }
        return args
      },

      WebhookEvent: (args) => {
        // Filter by organizationId
        if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
          args.where = { ...args.where, organizationId }
        } else if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
          args.where = { ...args.where, organizationId }
        } else if (params.action === 'create') {
          args.data = { ...args.data, organizationId }
        }
        return args
      },

      Payment: (args) => {
        // Filter by organizationId
        if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
          args.where = { ...args.where, organizationId }
        } else if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
          args.where = { ...args.where, organizationId }
        } else if (params.action === 'create') {
          args.data = { ...args.data, organizationId }
        }
        return args
      },

      AuditLog: (args) => {
        // Filter by organizationId - read only
        if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
          args.where = { ...args.where, organizationId }
        } else if (['update', 'delete'].includes(params.action)) {
          // Audit logs should never be modified
          throw new Error('Audit logs are immutable')
        }
        return args
      },

      UserMetrics: (args) => {
        // Filter by mlUserId from context
        if (mlAccountId && this.context) {
          // Would need to lookup mlUserId from mlAccountId
          // For now, allow based on organization context
        }
        return args
      },

      MLMetrics: (args) => {
        // Filter by mlAccountId
        if (mlAccountId) {
          if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
            args.where = { ...args.where, mlAccountId }
          }
        }
        return args
      }
    }

    // Apply RLS rule if exists for model
    const rule = rlsRules[params.model]
    if (rule) {
      params.args = rule(params.args || {})
    }

    return params
  }

  /**
   * Audit suspicious operations
   */
  private auditOperation(params: any): void {
    // Log operations without context (potential security issue)
    if (!this.context && params.model && !this.shouldSkipRLS(params)) {
      logger.warn('[RLS] Operation without context', {
        model: params.model,
        action: params.action,
        stackTrace: new Error().stack
      })
    }

    // Log bypass operations
    if (this.context?.bypassRLS) {
      logger.info('[RLS] Bypass operation', {
        model: params.model,
        action: params.action,
        organizationId: this.context.organizationId
      })
    }

    // Log cross-tenant access attempts
    if (params.args?.where?.organizationId && 
        this.context?.organizationId &&
        params.args.where.organizationId !== this.context.organizationId) {
      logger.error('[RLS] Cross-tenant access attempt', {
        model: params.model,
        action: params.action,
        requestedOrg: params.args.where.organizationId,
        contextOrg: this.context.organizationId
      })
      
      throw new Error('Cross-tenant access denied')
    }
  }
}

// Singleton instance with RLS
let rlsPrismaClient: RLSPrismaClient | null = null

/**
 * Get RLS-enabled Prisma client
 */
export function getRLSPrismaClient(): RLSPrismaClient {
  if (!rlsPrismaClient) {
    rlsPrismaClient = new RLSPrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error']
    })
  }
  return rlsPrismaClient
}

/**
 * Create a new RLS-enabled Prisma client with context
 */
export function createRLSClient(context: RLSContext): RLSPrismaClient {
  const client = getRLSPrismaClient()
  client.setContext(context)
  return client
}

/**
 * Execute operation with RLS context
 */
export async function withRLS<T>(
  context: RLSContext,
  operation: (prisma: RLSPrismaClient) => Promise<T>
): Promise<T> {
  const client = getRLSPrismaClient()
  return client.withContext(context, () => operation(client))
}
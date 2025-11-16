/**
 * Sistema de Audit Logging
 * Obrigatório para segurança e compliance
 * Rastreia: Quem fez o quê, quando, de onde e com que resultado
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export interface AuditLogData {
  action: string
  entityType: string
  entityId: string
  mlAccountId?: string
  organizationId?: string
  metadata?: any
  ipAddress?: string
  userAgent?: string
}

/**
 * Registra uma ação no audit log
 * Obrigatório para todas as operações críticas
 */
export async function auditLog(data: AuditLogData): Promise<void> {
  try {
    // Tenta obter IP e User-Agent do contexto da requisição
    let ipAddress = data.ipAddress
    let userAgent = data.userAgent

    try {
      const headersList = await headers()
      ipAddress = ipAddress || headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      userAgent = userAgent || headersList.get('user-agent') || 'unknown'
    } catch {
      // Em contextos sem headers (jobs, etc), usa valores default
    }

    // ✅ FIX CRÍTICO: Garantir organizationId SEMPRE presente
    let organizationId = data.organizationId

    // Tentar buscar organizationId da conta ML
    if (!organizationId && data.mlAccountId) {
      const mlAccount = await prisma.mLAccount.findUnique({
        where: { id: data.mlAccountId },
        select: { organizationId: true }
      })
      if (mlAccount?.organizationId) {
        organizationId = mlAccount.organizationId
      }
    }

    // ✅ FIX: Se ainda não tiver org, criar/buscar organização "system"
    if (!organizationId || organizationId === 'system' || organizationId === 'unknown') {
      let systemOrg = await prisma.organization.findFirst({
        where: { username: '__system__' }
      })

      if (!systemOrg) {
        // Criar organização system (executa uma vez apenas)
        systemOrg = await prisma.organization.create({
          data: {
            username: '__system__',
            organizationName: 'System Internal',
            role: 'SUPER_ADMIN'
          }
        })
        logger.info('[AUDIT] Created system organization', { id: systemOrg.id })
      }

      organizationId = systemOrg.id
    }

    // ✅ Criar registro de audit (organizationId SEMPRE presente agora)
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        mlAccountId: data.mlAccountId ?? null,
        organizationId: organizationId, // ✅ Variável local garantida
        metadata: data.metadata || {},
        ipAddress: ipAddress || 'system',
        userAgent: userAgent || 'system',
        createdAt: new Date()
      }
    })

    // Log também no console para monitoramento
    logger.info(`[AUDIT] ${data.action} | Org: ${organizationId} | Account: ${data.mlAccountId || 'system'} | Entity: ${data.entityType}:${data.entityId}`)
    
  } catch (error) {
    // Nunca falha silenciosamente - audit é crítico
    logger.error('[AUDIT] Failed to create audit log:', { error })
    logger.error('[AUDIT] Data:', { error: { error: data } })
  }
}

/**
 * Busca logs de auditoria
 */
export async function getAuditLogs(
  organizationId: string,
  filters?: {
    userId?: string
    action?: string
    entityType?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }
) {
  const where: any = { organizationId }
  
  if (filters?.userId) where.userId = filters.userId
  if (filters?.action) where.action = filters.action
  if (filters?.entityType) where.entityType = filters.entityType
  
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }
  
  return prisma.auditLog.findMany({
    where,
    include: {
      organization: {
        select: {
          id: true,
          primaryNickname: true,
          primaryEmail: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 100
  })
}

/**
 * Ações auditadas no sistema
 */
export const AUDIT_ACTIONS = {
  // Autenticação
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_LOGOUT: 'user.logout',
  USER_REGISTER: 'user.register',
  PASSWORD_RESET: 'user.password_reset',
  SESSION_EXPIRED: 'user.session_expired',
  
  // ML OAuth
  OAUTH_INITIATED: 'oauth.initiated',
  OAUTH_FAILED: 'oauth.failed',
  ML_ACCOUNT_CONNECTED: 'ml_account.connected',
  ML_ACCOUNT_DISCONNECTED: 'ml_account.disconnected',
  ML_ACCOUNT_REVOKED: 'ml_account.revoked',
  ML_ACCOUNT_SWITCHED: 'ml_account.switched',
  TOKEN_REFRESHED: 'token.refreshed',
  TOKEN_REFRESH_FAILED: 'token.refresh_failed',
  
  // Operações ML
  QUESTION_ANSWERED: 'question.answered',
  QUESTION_REVISED: 'question.revised',
  QUESTION_AUTO_APPROVED: 'question.auto_approved',
  QUESTION_MANUALLY_APPROVED: 'question.manually_approved',
  QUESTION_REJECTED: 'question.rejected',
  METRICS_SYNCED: 'metrics.synced',
  WEBHOOK_RECEIVED: 'webhook.received',
  WEBHOOK_PROCESSED: 'webhook.processed',
  
  // Pagamentos
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  
  // Administração
  USER_INVITED: 'user.invited',
  USER_REMOVED: 'user.removed',
  PERMISSIONS_CHANGED: 'permissions.changed',
  ORGANIZATION_UPDATED: 'organization.updated',
  ORGANIZATION_CREATED: 'organization.created',
  
  // Erros e Segurança
  API_REQUEST_FAILED: 'api.request_failed',
  RATE_LIMIT_HIT: 'security.rate_limit_hit',
  INVALID_TOKEN: 'security.invalid_token',
  CSRF_ATTEMPT: 'security.csrf_attempt',
  WEBHOOK_INVALID_IP: 'security.webhook_invalid_ip',
  WEBHOOK_INVALID_SIGNATURE: 'security.webhook_invalid_signature',
  WEBHOOK_VALIDATION_FAILED: 'webhook.validation_failed',
  SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  SECURITY_ALERT: 'security.alert',
  DATA_EXPORT: 'security.data_export',
  ENCRYPTION_KEY_ROTATED: 'security.encryption_key_rotated'
} as const

/**
 * Helper para log de ações de segurança
 */
export async function auditSecurityEvent(
  action: string,
  details: any,
  mlAccountId?: string,
  organizationId?: string
) {
  const logData: AuditLogData = {
    action: `security.${action}`,
    entityType: 'security',
    entityId: 'system',
    metadata: {
      ...details,
      timestamp: new Date().toISOString(),
      severity: determineSeverity(action)
    }
  }
  
  if (mlAccountId) {
    logData.mlAccountId = mlAccountId
  }
  
  if (organizationId) {
    logData.organizationId = organizationId
  }
  
  await auditLog(logData)
}

/**
 * Determina a severidade de um evento de segurança
 */
function determineSeverity(action: string): string {
  if (action.includes('csrf') || action.includes('injection')) return 'critical'
  if (action.includes('invalid') || action.includes('failed')) return 'warning'
  return 'info'
}

/**
 * Limpa logs antigos (LGPD compliance)
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 90) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  
  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  })
  
  if (result.count > 0) {
    logger.info(`[AUDIT] Cleaned up ${result.count} old audit logs`)
  }
  
  return result.count
}
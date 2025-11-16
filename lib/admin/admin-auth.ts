/**
 * Admin Authentication Helper
 * Valida se o usuário tem acesso de SUPER_ADMIN
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { cookies } from 'next/headers'

export interface AdminSession {
  isAdmin: boolean
  organizationId: string
  organizationName: string
  username: string
  sessionId: string
}

/**
 * Verificar se usuário tem acesso admin
 */
export async function isAdminSession(): Promise<AdminSession | null> {
  try {
    // Pegar session token do cookie
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('ml-agent-session')?.value

    if (!sessionToken) {
      return null
    }

    // Buscar sessão
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: {
          select: {
            id: true,
            username: true,
            organizationName: true,
            role: true
          }
        }
      }
    })

    if (!session) {
      return null
    }

    // Verificar se sessão expirou
    if (session.expiresAt < new Date()) {
      return null
    }

    // Verificar se é SUPER_ADMIN
    if (session.organization.role !== 'SUPER_ADMIN') {
      return null
    }

    return {
      isAdmin: true,
      organizationId: session.organization.id,
      organizationName: session.organization.organizationName || 'Admin',
      username: session.organization.username || 'AXNEX',
      sessionId: session.id
    }

  } catch (error) {
    logger.error('[AdminAuth] Error checking admin session:', { error })
    return null
  }
}

/**
 * Middleware para rotas admin - lança erro se não for admin
 */
export async function requireAdmin(): Promise<AdminSession> {
  const adminSession = await isAdminSession()

  if (!adminSession) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  return adminSession
}

/**
 * Validar acesso admin em API routes
 */
export async function validateAdminAccess(): Promise<{
  isValid: boolean
  session?: AdminSession
  error?: string
}> {
  try {
    const session = await isAdminSession()

    if (!session) {
      return {
        isValid: false,
        error: 'Admin authentication required'
      }
    }

    return {
      isValid: true,
      session
    }

  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Authentication error'
    }
  }
}

/**
 * Log de ação administrativa
 */
export async function logAdminAction(
  action: string,
  entityType: string,
  entityId: string,
  metadata?: any
) {
  try {
    const session = await isAdminSession()

    if (!session) {
      logger.warn('[AdminAuth] Attempted admin action without valid session', { action })
      return
    }

    await prisma.auditLog.create({
      data: {
        action: `admin.${action}`,
        entityType,
        entityId,
        organizationId: session.organizationId,
        metadata: {
          ...metadata,
          adminUser: session.username,
          timestamp: new Date().toISOString()
        }
      }
    })

    logger.info(`[AdminAuth] Admin action logged`, {
      action,
      entityType,
      entityId,
      adminUser: session.username
    })

  } catch (error) {
    logger.error('[AdminAuth] Error logging admin action:', { error })
  }
}

/**
 * Session Validator
 * Validates and manages user sessions with security checks
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface SessionValidation {
  valid: boolean
  session?: any
  reason?: string
}

/**
 * Verify session token and return session data
 */
export async function verifySession(token: string): Promise<any | null> {
  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        organization: {
          include: {
            mlAccounts: {
              where: { isActive: true }
            }
          }
        }
      }
    })

    if (!session) {
      return null
    }

    // Check if session expired
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({
        where: { sessionToken: token }
      })
      return null
    }

    // Update last activity
    await prisma.session.update({
      where: { sessionToken: token },
      data: { lastActivityAt: new Date() }
    })

    return session
  } catch (error) {
    logger.error('[Session] Validation error:', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

/**
 * Validate session with security checks
 */
export async function validateSessionSecurity(
  sessionToken: string,
  currentIP?: string,
  userAgent?: string
): Promise<SessionValidation> {
  try {
    const session = await verifySession(sessionToken)
    
    if (!session) {
      return { valid: false, reason: 'Session not found or expired' }
    }

    // Check IP address change
    if (currentIP && session.ipAddress && session.ipAddress !== currentIP) {
      logger.warn('[Session] IP address changed', {
        sessionId: session.id,
        originalIP: session.ipAddress,
        currentIP
      })
      
      // Could implement stricter security here
      // For now, just log the change
    }

    // Check user agent change
    if (userAgent && session.userAgent && session.userAgent !== userAgent) {
      logger.warn('[Session] User agent changed', {
        sessionId: session.id,
        originalUA: session.userAgent,
        currentUA: userAgent
      })
    }

    return { valid: true, session }
  } catch (error) {
    logger.error('[Session] Security validation error:', { error: error instanceof Error ? error.message : String(error) })
    return { valid: false, reason: 'Validation error' }
  }
}

/**
 * Invalidate session
 */
export async function invalidateSession(sessionToken: string): Promise<boolean> {
  try {
    await prisma.session.delete({
      where: { sessionToken }
    })
    return true
  } catch (error) {
    logger.error('[Session] Failed to invalidate:', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/**
 * Clean expired sessions
 */
export async function cleanExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    
    if (result.count > 0) {
      logger.info(`[Session] Cleaned ${result.count} expired sessions`)
    }
    
    return result.count
  } catch (error) {
    logger.error('[Session] Failed to clean expired sessions:', { error: error instanceof Error ? error.message : String(error) })
    return 0
  }
}

// Export for use in other modules
export { verifySession as validateSession }
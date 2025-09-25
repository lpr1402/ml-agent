/**
 * Enhanced Session Manager with Security Best Practices
 * Implements secure session handling with automatic cleanup
 */

import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { logger } from '@/lib/logger'

const SESSION_DURATION = 12 * 60 * 60 * 1000 // 12 hours
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour

export class SessionManager {
  private static instance: SessionManager
  private cleanupTimer?: NodeJS.Timeout

  private constructor() {
    this.startCleanupJob()
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  private startCleanupJob(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const deleted = await prisma.session.deleteMany({
          where: {
            expiresAt: {
              lt: new Date()
            }
          }
        })
        
        if (deleted.count > 0) {
          logger.info(`Cleaned up ${deleted.count} expired sessions`)
        }
      } catch (error) {
        logger.error('Session cleanup failed', { error })
      }
    }, SESSION_CLEANUP_INTERVAL)

    // Cleanup on process exit
    process.on('SIGTERM', () => this.cleanup())
    process.on('SIGINT', () => this.cleanup())
  }

  private cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }

  async createSession(organizationId: string, mlAccountId: string, request: any): Promise<string> {
    const sessionToken = this.generateSecureToken()
    const ipAddress = this.extractIP(request)
    const userAgent = request.headers?.['user-agent'] || 'unknown'

    await prisma.session.create({
      data: {
        sessionToken,
        organizationId,
        activeMLAccountId: mlAccountId,
        expiresAt: new Date(Date.now() + SESSION_DURATION),
        ipAddress,
        userAgent
      }
    })

    logger.info('Session created', { 
      organizationId, 
      mlAccountId,
      ip: ipAddress 
    })

    return sessionToken
  }

  async validateSession(token: string): Promise<any | null> {
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

    if (!session || session.expiresAt < new Date()) {
      return null
    }

    // Extend session on activity
    await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: new Date(Date.now() + SESSION_DURATION),
        updatedAt: new Date()
      }
    })

    return session
  }

  async revokeSession(token: string): Promise<void> {
    await prisma.session.delete({
      where: { sessionToken: token }
    }).catch(() => {
      // Session might not exist
    })
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex')
  }

  private extractIP(request: any): string {
    const forwarded = request.headers?.['x-forwarded-for']
    const real = request.headers?.['x-real-ip']
    const connection = request.connection?.remoteAddress
    
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    
    return real || connection || 'unknown'
  }
}

export const sessionManager = SessionManager.getInstance()
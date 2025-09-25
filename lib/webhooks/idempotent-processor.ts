/**
 * Idempotent Webhook Processor
 * Ensures webhooks are processed exactly once even with retries
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createHash } from 'crypto'

interface WebhookPayload {
  topic?: string
  resource?: string
  resource_id?: string
  user_id?: string
  application_id?: string
  attempt_id?: string
  sent?: string
  [key: string]: any
}

export class IdempotentWebhookProcessor {
  /**
   * Generate idempotency key from webhook payload
   */
  public generateIdempotencyKey(payload: WebhookPayload): string {
    // Use combination of unique identifiers
    const components = [
      payload.topic || 'unknown',
      payload.resource || 'unknown',
      payload.resource_id || 'unknown',
      payload.user_id || 'unknown',
      payload.sent || Date.now().toString(),
      payload.attempt_id || 'no-attempt'
    ]
    
    // Create hash for consistent key
    const hash = createHash('sha256')
    hash.update(components.join(':'))
    return hash.digest('hex')
  }

  /**
   * Process webhook with idempotency guarantee
   */
  public async processWebhook(
    payload: WebhookPayload,
    organizationId: string,
    mlAccountId?: string
  ): Promise<{ processed: boolean; webhookId?: string; error?: string }> {
    const idempotencyKey = this.generateIdempotencyKey(payload)
    
    try {
      // Try to create webhook event with idempotency key
      const webhookEvent = await prisma.webhookEvent.create({
        data: {
          idempotencyKey,
          organizationId,
          mlAccountId: mlAccountId || null,
          eventType: payload.topic || 'unknown',
          eventId: payload.resource_id || null,
          topic: payload.topic || null,
          resourceId: payload.resource_id || 'unknown',
          resourceUrl: payload.resource || null,
          userId: payload.user_id || null,
          applicationId: payload.application_id || null,
          attemptId: payload.attempt_id || null,
          status: 'PENDING',
          payload: payload as any,
          receivedAt: new Date()
        }
      })
      
      logger.info(`[Webhook] Created new event: ${webhookEvent.id} (Key: ${idempotencyKey})`)
      
      return {
        processed: true,
        webhookId: webhookEvent.id
      }
    } catch (error: any) {
      // Check if it's a unique constraint violation
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        // Webhook already processed
        const existingWebhook = await prisma.webhookEvent.findUnique({
          where: { idempotencyKey }
        })
        
        if (existingWebhook) {
          logger.info(`[Webhook] Duplicate detected: ${existingWebhook.id} (Key: ${idempotencyKey})`)
          
          // Check if it failed previously and needs retry
          if (existingWebhook.status === 'FAILED') {
            // Update status to retry
            await prisma.webhookEvent.update({
              where: { id: existingWebhook.id },
              data: {
                status: 'PENDING'
              }
            })
            
            logger.info(`[Webhook] Retrying failed webhook: ${existingWebhook.id}`)
            
            return {
              processed: true,
              webhookId: existingWebhook.id
            }
          }
          
          // Already processed successfully
          return {
            processed: false,
            webhookId: existingWebhook.id,
            error: 'Webhook already processed'
          }
        }
      }
      
      // Other database error
      logger.error('[Webhook] Failed to create webhook event:', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * Mark webhook as processing
   */
  public async markAsProcessing(webhookId: string): Promise<boolean> {
    try {
      const result = await prisma.webhookEvent.updateMany({
        where: {
          id: webhookId,
          status: 'PENDING'
        },
        data: {
          status: 'PROCESSING'
        }
      })
      
      return result.count > 0
    } catch (_error) {
      logger.error(`[Webhook] Failed to mark as processing: ${webhookId}`, { error: _error instanceof Error ? _error.message : String(_error) })
      return false
    }
  }

  /**
   * Mark webhook as completed
   */
  public async markAsCompleted(webhookId: string): Promise<void> {
    try {
      await prisma.webhookEvent.update({
        where: { id: webhookId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date()
        }
      })
      
      logger.info(`[Webhook] Marked as completed: ${webhookId}`)
    } catch (_error) {
      logger.error(`[Webhook] Failed to mark as completed: ${webhookId}`, { error: _error instanceof Error ? _error.message : String(_error) })
    }
  }

  /**
   * Mark webhook as failed
   */
  public async markAsFailed(
    webhookId: string,
    error: string,
    canRetry: boolean = true
  ): Promise<void> {
    try {
      await prisma.webhookEvent.update({
        where: { id: webhookId },
        data: {
          status: canRetry ? 'FAILED' : 'FAILED_PERMANENT',
          processingError: error
        }
      })
      
      logger.error(`[Webhook] Marked as failed: ${webhookId} - ${error}`)
    } catch (err) {
      logger.error(`[Webhook] Failed to mark as failed: ${webhookId}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  /**
   * Get pending webhooks for processing
   */
  public async getPendingWebhooks(limit: number = 100): Promise<any[]> {
    try {
      const webhooks = await prisma.webhookEvent.findMany({
        where: {
          status: 'PENDING',
          receivedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: [
          { priority: 'desc' },
          { receivedAt: 'asc' }
        ],
        take: limit,
        include: {
          mlAccount: {
            select: {
              id: true,
              mlUserId: true,
              nickname: true,
              organizationId: true
            }
          }
        }
      })
      
      return webhooks
    } catch (_error) {
      logger.error('[Webhook] Failed to get pending webhooks:', { error: _error instanceof Error ? _error.message : String(_error) })
      return []
    }
  }

  /**
   * Cleanup old processed webhooks
   */
  public async cleanupOldWebhooks(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      const result = await prisma.webhookEvent.deleteMany({
        where: {
          status: 'COMPLETED',
          processedAt: {
            lt: cutoffDate
          }
        }
      })
      
      logger.info(`[Webhook] Cleaned up ${result.count} old webhooks`)
      return result.count
    } catch (_error) {
      logger.error('[Webhook] Failed to cleanup old webhooks:', { error: _error instanceof Error ? _error.message : String(_error) })
      return 0
    }
  }

  /**
   * Get webhook processing statistics
   */
  public async getStatistics(): Promise<any> {
    try {
      const [
        total,
        pending,
        processing,
        completed,
        failed
      ] = await Promise.all([
        prisma.webhookEvent.count(),
        prisma.webhookEvent.count({ where: { status: 'PENDING' } }),
        prisma.webhookEvent.count({ where: { status: 'PROCESSING' } }),
        prisma.webhookEvent.count({ where: { status: 'COMPLETED' } }),
        prisma.webhookEvent.count({ where: { status: { in: ['FAILED', 'FAILED_PERMANENT'] } } })
      ])
      
      return {
        total,
        pending,
        processing,
        completed,
        failed,
        successRate: total > 0 ? (completed / total) * 100 : 0
      }
    } catch (_error) {
      logger.error('[Webhook] Failed to get statistics:', { error: _error instanceof Error ? _error.message : String(_error) })
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        successRate: 0
      }
    }
  }
}

// Export singleton instance
export const webhookProcessor = new IdempotentWebhookProcessor()
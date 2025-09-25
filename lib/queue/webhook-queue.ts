/**
 * Webhook Processing Queue
 * Scalable webhook processing with Bull queue
 */

import Bull from 'bull'
import { logger } from '@/lib/logger'
import { webhookProcessor } from '@/lib/webhooks/idempotent-processor'

interface WebhookJob {
  webhookId: string
  payload: any
  organizationId: string
  mlAccountId: string
  priority: number
  attemptNumber: number
}

// Redis configuration for Bull Queue
function getRedisConfig() {
  const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379'

  try {
    // Bull Queue requer formato específico
    if (redisUrl.includes('redis://')) {
      const url = new URL(redisUrl)
      return {
        host: url.hostname || 'localhost',
        port: parseInt(url.port || '6379'),
        password: url.password || undefined,
        db: 0,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000)
          return delay
        }
      }
    }
    // Se for formato simples host:port
    const [host, port] = redisUrl.split(':')
    return {
      host: host || 'localhost',
      port: parseInt(port || '6379'),
      password: undefined,
      db: 0,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      }
    }
  } catch (error) {
    logger.warn('[WebhookQueue] Using default Redis config', { error })
    return {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      }
    }
  }
}

// Queue configuration
const QUEUE_CONFIG = {
  redis: getRedisConfig(),
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
}

class WebhookQueueManager {
  private queue: Bull.Queue<WebhookJob>
  private processingMetrics = {
    processed: 0,
    failed: 0,
    retried: 0,
    avgProcessingTime: 0
  }

  constructor() {
    try {
      // Initialize queue with Redis configuration
      const redisConfig = QUEUE_CONFIG.redis
      logger.info('[WebhookQueue] Initializing with Redis config', {
        host: redisConfig.host,
        port: redisConfig.port
      })

      this.queue = new Bull<WebhookJob>('webhook-processing', redisConfig as any, {
        defaultJobOptions: QUEUE_CONFIG.defaultJobOptions
      })

      // Set up event handlers
      this.setupEventHandlers()

      // Start processing
      this.startProcessing()

      // Setup monitoring
      this.setupMonitoring()

      logger.info('[WebhookQueue] Manager initialized successfully')
    } catch (error) {
      logger.error('[WebhookQueue] Failed to initialize', { error })
      throw error
    }
  }

  /**
   * Add webhook to processing queue
   */
  async addWebhook(
    webhookId: string,
    payload: any,
    organizationId: string,
    mlAccountId?: string,
    priority: number = 0
  ): Promise<Bull.Job<WebhookJob>> {
    try {
      const job = await this.queue.add(
        'process-webhook',
        {
          webhookId,
          payload,
          organizationId,
          mlAccountId: mlAccountId || '',
          priority,
          attemptNumber: 1
        },
        {
          priority,
          delay: 0,
          ...QUEUE_CONFIG.defaultJobOptions
        }
      )
      
      logger.info(`[WebhookQueue] Added webhook to queue`, {
        webhookId,
        jobId: job.id,
        priority
      })
      
      return job
    } catch (_error) {
      logger.error('[WebhookQueue] Failed to add webhook to queue', {
        error: _error,
        webhookId
      })
      throw _error
    }
  }

  /**
   * Process webhooks from queue
   */
  private startProcessing() {
    // Process with concurrency based on environment
    const concurrency = parseInt(process.env['WEBHOOK_QUEUE_CONCURRENCY'] || '5')
    
    this.queue.process('process-webhook', concurrency, async (job: Bull.Job<WebhookJob>) => {
      const startTime = Date.now()
      const { webhookId, payload, organizationId, mlAccountId } = job.data
      
      try {
        logger.info(`[WebhookQueue] Processing webhook`, {
          webhookId,
          jobId: job.id,
          attempt: job.attemptsMade + 1
        })
        
        // Mark webhook as processing
        await webhookProcessor.markAsProcessing(webhookId)
        
        // Process based on webhook topic
        await this.processWebhookByTopic(payload, organizationId, mlAccountId)
        
        // Mark as completed
        await webhookProcessor.markAsCompleted(webhookId)
        
        // Update metrics
        const processingTime = Date.now() - startTime
        this.updateMetrics('success', processingTime)
        
        logger.info(`[WebhookQueue] Webhook processed successfully`, {
          webhookId,
          processingTime
        })
        
        return { success: true, webhookId, processingTime }
        
      } catch (error: any) {
        logger.error(`[WebhookQueue] Webhook processing failed`, {
          error: error.message,
          webhookId,
          attempt: job.attemptsMade + 1
        })
        
        // Check if should retry
        if (job.attemptsMade < 2) {
          this.updateMetrics('retry', Date.now() - startTime)
          throw error // Will trigger retry
        } else {
          // Final failure
          await webhookProcessor.markAsFailed(
            webhookId,
            error.message,
            false // No more retries
          )
          
          this.updateMetrics('fail', Date.now() - startTime)
          throw error
        }
      }
    })
  }

  /**
   * Process webhook based on topic
   */
  private async processWebhookByTopic(
    payload: any,
    organizationId: string,
    mlAccountId: string
  ): Promise<void> {
    const { topic, resource_id } = payload
    
    switch (topic) {
      case 'questions':
        await this.processQuestionWebhook(resource_id, organizationId, mlAccountId)
        break
        
      case 'orders_v2':
        await this.processOrderWebhook(resource_id, organizationId, mlAccountId)
        break
        
      case 'messages':
        await this.processMessageWebhook(resource_id, organizationId, mlAccountId)
        break
        
      case 'claims':
        await this.processClaimWebhook(resource_id, organizationId, mlAccountId)
        break
        
      default:
        logger.warn(`[WebhookQueue] Unknown webhook topic: ${topic}`)
    }
  }

  /**
   * Process question webhook
   */
  private async processQuestionWebhook(
    questionId: string,
    organizationId: string,
    mlAccountId: string
  ): Promise<void> {
    try {
      logger.info(`[WebhookQueue] Processing question: ${questionId}`, {
        organizationId,
        mlAccountId
      })
      
      // Import question processor
      const { processQuestionWebhook } = await import('@/lib/webhooks/question-processor')
      
      // Get ML Account details
      const { prisma } = await import('@/lib/prisma')
      const mlAccount = await prisma.mLAccount.findUnique({
        where: { id: mlAccountId },
        select: {
          id: true,
          mlUserId: true,
          organizationId: true
        }
      })
      
      if (!mlAccount) {
        logger.error(`[WebhookQueue] ML Account not found: ${mlAccountId}`)
        throw new Error(`ML Account not found: ${mlAccountId}`)
      }
      
      // Process the question webhook
      await processQuestionWebhook(
        {
          topic: 'questions',
          resource: `/questions/${questionId}`,
          user_id: mlAccount.mlUserId,
          application_id: process.env['ML_CLIENT_ID'] || ''
        },
        mlAccount
      )
      
      logger.info(`[WebhookQueue] Question processed successfully: ${questionId}`)
    } catch (error) {
      logger.error(`[WebhookQueue] Question processing failed: ${questionId}`, { error })
      throw error
    }
  }

  /**
   * Process order webhook
   */
  private async processOrderWebhook(
    orderId: string,
    organizationId: string,
    mlAccountId: string
  ): Promise<void> {
    logger.info(`[WebhookQueue] Processing order: ${orderId}`, {
      organizationId,
      mlAccountId
    })
    // Implementation for order processing
  }

  /**
   * Process message webhook
   */
  private async processMessageWebhook(
    messageId: string,
    organizationId: string,
    mlAccountId: string
  ): Promise<void> {
    logger.info(`[WebhookQueue] Processing message: ${messageId}`, {
      organizationId,
      mlAccountId
    })
    // Implementation for message processing
  }

  /**
   * Process claim webhook (high priority)
   */
  private async processClaimWebhook(
    claimId: string,
    organizationId: string,
    mlAccountId: string
  ): Promise<void> {
    logger.warn(`[WebhookQueue] Processing CLAIM: ${claimId}`, {
      organizationId,
      mlAccountId
    })
    // High priority claim processing
    // Send immediate notifications
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    // Job completed
    this.queue.on('completed', (job, result) => {
      logger.debug(`[WebhookQueue] Job completed`, {
        jobId: job.id,
        webhookId: result.webhookId
      })
    })
    
    // Job failed
    this.queue.on('failed', (job, err) => {
      logger.error(`[WebhookQueue] Job failed`, {
        jobId: job.id,
        error: err.message,
        webhookId: job.data.webhookId
      })
    })
    
    // Job stalled
    this.queue.on('stalled', (job) => {
      logger.warn(`[WebhookQueue] Job stalled`, {
        jobId: job.id,
        webhookId: job.data.webhookId
      })
    })
    
    // Queue error
    this.queue.on('error', (error) => {
      logger.error(`[WebhookQueue] Queue error`, { error })
    })
  }

  /**
   * Setup monitoring
   */
  private setupMonitoring() {
    // Monitor queue health every 30 seconds
    setInterval(async () => {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          this.queue.getWaitingCount(),
          this.queue.getActiveCount(),
          this.queue.getCompletedCount(),
          this.queue.getFailedCount(),
          this.queue.getDelayedCount()
        ])
        
        const health = {
          waiting,
          active,
          completed,
          failed,
          delayed,
          metrics: this.processingMetrics
        }
        
        // Store metrics in Redis for monitoring
        // Import redis dynamically to avoid circular dependency
        const { redis } = await import('@/lib/redis')
        await redis.set(
          'webhook-queue:health',
          JSON.stringify(health),
          'EX',
          60
        )
        
        // Log if queue is backing up
        if (waiting > 100) {
          logger.warn('[WebhookQueue] Queue backing up', { waiting })
        }
        
      } catch (_error) {
        logger.error('[WebhookQueue] Monitoring error', { error: _error })
      }
    }, 30000)
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(type: 'success' | 'fail' | 'retry', processingTime: number) {
    if (type === 'success') {
      this.processingMetrics.processed++
    } else if (type === 'fail') {
      this.processingMetrics.failed++
    } else {
      this.processingMetrics.retried++
    }
    
    // Update average processing time
    const total = this.processingMetrics.processed + this.processingMetrics.failed
    if (total > 0) {
      this.processingMetrics.avgProcessingTime = 
        (this.processingMetrics.avgProcessingTime * (total - 1) + processingTime) / total
    }
  }

  /**
   * Get queue statistics
   */
  async getStatistics() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.isPaused()
    ])
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      metrics: this.processingMetrics,
      health: this.calculateHealth(waiting, failed)
    }
  }

  /**
   * Calculate queue health
   */
  private calculateHealth(waiting: number, failed: number): string {
    if (failed > 100) return 'critical'
    if (waiting > 500) return 'degraded'
    if (waiting > 100) return 'warning'
    return 'healthy'
  }

  /**
   * Pause processing
   */
  async pause(): Promise<void> {
    await this.queue.pause()
    logger.info('[WebhookQueue] Queue paused')
  }

  /**
   * Resume processing
   */
  async resume(): Promise<void> {
    await this.queue.resume()
    logger.info('[WebhookQueue] Queue resumed')
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(grace: number = 86400000): Promise<void> {
    const [completed, failed] = await Promise.all([
      this.queue.clean(grace, 'completed'),
      this.queue.clean(grace, 'failed')
    ])
    
    logger.info('[WebhookQueue] Cleaned old jobs', {
      completed: completed.length,
      failed: failed.length
    })
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('[WebhookQueue] Shutting down...')
    
    // Pause new job processing
    await this.queue.pause()
    
    // Wait for active jobs to complete (max 30 seconds)
    let activeCount = await this.queue.getActiveCount()
    let waitTime = 0
    
    while (activeCount > 0 && waitTime < 30000) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      activeCount = await this.queue.getActiveCount()
      waitTime += 1000
    }
    
    // Close queue
    await this.queue.close()
    
    logger.info('[WebhookQueue] Shutdown complete')
  }
}

// Export singleton instance
export const webhookQueue = new WebhookQueueManager()

// Graceful shutdown
process.on('SIGTERM', async () => {
  await webhookQueue.shutdown()
})

process.on('SIGINT', async () => {
  await webhookQueue.shutdown()
})
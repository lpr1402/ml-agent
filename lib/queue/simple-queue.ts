/**
 * Simple Queue Implementation for Next.js
 * Compatible with serverless and edge environments
 * Uses Redis for persistence without Bull's process forking
 */

import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { processQuestionWebhook } from '@/lib/webhooks/question-processor'

interface QueueJob {
  id: string
  data: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  createdAt: Date
  processedAt?: Date
  error?: string
}

class SimpleQueueManager {
  private isProcessing = false
  private isCurrentlyProcessing = false
  private processingInterval: NodeJS.Timeout | null = null

  /**
   * Add job to queue
   */
  async addJob(eventId: string, data: any): Promise<void> {
    const job: QueueJob = {
      id: eventId,
      data,
      status: 'pending',
      attempts: 0,
      createdAt: new Date()
    }

    await redis.lpush('webhook-queue', JSON.stringify(job))
    logger.info(`[SimpleQueue] Job added: ${eventId}`)

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing()
    }
  }

  /**
   * Start processing jobs
   */
  private async startProcessing() {
    if (this.isProcessing) return

    this.isProcessing = true
    logger.info('[SimpleQueue] Started processing')

    // Process immediately on start
    this.processNextJob()

    // Process jobs every 15 seconds to avoid rate limit
    // PROCESSAMENTO SEQUENCIAL - Um job por vez!
    this.processingInterval = setInterval(async () => {
      if (!this.isCurrentlyProcessing) {
        await this.processNextJob()
      }
    }, 15000) // 15 segundos entre processamentos
  }

  /**
   * Process next job in queue
   */
  private async processNextJob() {
    try {
      // Get next job from queue
      const jobData = await redis.rpop('webhook-queue')
      if (!jobData) return

      const job: QueueJob = JSON.parse(jobData)
      logger.info(`[SimpleQueue] 🎬 Processing job: ${job.id}`, {
        jobId: job.id,
        topic: job.data.topic,
        resourceId: job.data.resource_id,
        userId: job.data.user_id,
        attempts: job.attempts,
        timestamp: new Date().toISOString()
      })

      console.log('[SimpleQueue] 📋 Job details:', {
        id: job.id,
        questionId: job.data.resource_id,
        sellerId: job.data.user_id
      })

      // Update job status
      job.status = 'processing'
      job.attempts++

      try {
        // Process based on webhook type
        if (job.data.topic === 'questions') {
          await this.processQuestionJob(job)
        }

        // Mark as completed
        job.status = 'completed'
        job.processedAt = new Date()

        logger.info(`[SimpleQueue] Job completed: ${job.id}`)
      } catch (error: any) {
        logger.error(`[SimpleQueue] Job failed: ${job.id}`, { error: error.message })

        job.error = error.message

        // Retry if attempts < 3
        if (job.attempts < 3) {
          job.status = 'pending'
          // Re-add to queue with exponential backoff
          setTimeout(() => {
            redis.lpush('webhook-queue', JSON.stringify(job))
          }, Math.pow(2, job.attempts) * 1000)
        } else {
          job.status = 'failed'
          // Store failed job for debugging
          await redis.setex(`failed-job:${job.id}`, 86400, JSON.stringify(job))
        }
      }
    } catch (error) {
      logger.error('[SimpleQueue] Processing error:', { error })
    } finally {
      this.isCurrentlyProcessing = false // Liberar para próximo job
    }
  }

  /**
   * Process question webhook job
   */
  private async processQuestionJob(job: QueueJob) {
    const { resource_id, resource, user_id, notification } = job.data

    // Get ML Account
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        mlUserId: user_id,
        isActive: true
      },
      select: {
        id: true,
        mlUserId: true,
        organizationId: true
      }
    })

    if (!mlAccount) {
      throw new Error(`No ML account found for user ${user_id}`)
    }

    // Process the question
    await processQuestionWebhook(
      {
        topic: 'questions',
        resource: resource || `/questions/${resource_id}`,
        user_id: user_id,
        application_id: notification?.application_id
      },
      mlAccount
    )

    // Update webhook event status
    await prisma.webhookEvent.updateMany({
      where: { id: job.id },
      data: {
        status: 'PROCESSED',
        processed: true,
        processedAt: new Date()
      }
    })
  }

  /**
   * Stop processing
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    this.isProcessing = false
    logger.info('[SimpleQueue] Stopped processing')
  }

  /**
   * Get queue statistics
   */
  async getStatistics() {
    const queueLength = await redis.llen('webhook-queue')

    // Get failed jobs count
    const failedKeys = await redis.keys('failed-job:*')

    return {
      waiting: queueLength,
      failed: failedKeys.length,
      processing: this.isProcessing,
      health: queueLength > 100 ? 'warning' : 'healthy'
    }
  }
}

// Export singleton instance
export const simpleQueue = new SimpleQueueManager()

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    simpleQueue.stopProcessing()
  })

  process.on('SIGINT', () => {
    simpleQueue.stopProcessing()
  })
}
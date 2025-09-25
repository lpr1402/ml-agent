/**
 * Integration Test: Webhook Processing
 * Tests webhook validation, idempotency, and processing
 */

import { prisma } from '@/lib/prisma'
import { webhookProcessor } from '@/lib/webhooks/idempotent-processor'
import { MLWebhookValidator } from '@/lib/webhooks/ml-webhook-validator'
// NextRequest import removed - not used

describe('Webhook Processing Integration', () => {
  let testOrg: any
  let testAccount: any

  beforeEach(async () => {
    // Clean database
    await prisma.webhookEvent.deleteMany()
    await prisma.question.deleteMany()
    await prisma.mLAccount.deleteMany()
    await prisma.organization.deleteMany()

    // Create test data
    testOrg = await prisma.organization.create({
      data: {
        plan: 'PRO'
      }
    })

    testAccount = await prisma.mLAccount.create({
      data: {
        mlUserId: 'ML_WEBHOOK_TEST',
        nickname: 'WEBHOOK_SELLER',
        siteId: 'MLB',
        organization: {
          connect: { id: testOrg.id }
        },
        accessToken: 'encrypted',
        accessTokenIV: 'iv',
        accessTokenTag: 'tag',
        refreshToken: 'encrypted',
        refreshTokenIV: 'iv',
        refreshTokenTag: 'tag',
        tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        isPrimary: true,
        isActive: true
      }
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  describe('Idempotency', () => {
    it('should prevent duplicate webhook processing', async () => {
      const webhookPayload = {
        topic: 'questions',
        resource: '/questions/12345',
        resource_id: '12345',
        user_id: 'ML_WEBHOOK_TEST',
        application_id: 'APP123',
        attempt_id: 'attempt-1',
        sent: new Date().toISOString()
      }

      // Process webhook first time
      const result1 = await webhookProcessor.processWebhook(
        webhookPayload,
        testOrg.id,
        testAccount.id
      )

      expect(result1.processed).toBe(true)
      expect(result1.webhookId).toBeDefined()

      // Try to process same webhook again
      const result2 = await webhookProcessor.processWebhook(
        webhookPayload,
        testOrg.id,
        testAccount.id
      )

      expect(result2.processed).toBe(false)
      expect(result2.error).toContain('already processed')

      // Verify only one webhook event exists
      const events = await prisma.webhookEvent.findMany({
        where: { resourceId: '12345' }
      })
      expect(events).toHaveLength(1)
    })

    it('should generate consistent idempotency keys', () => {
      const payload = {
        topic: 'questions',
        resource: '/questions/12345',
        resource_id: '12345',
        user_id: 'ML123',
        sent: '2025-01-01T00:00:00Z'
      }

      const key1 = webhookProcessor.generateIdempotencyKey(payload)
      const key2 = webhookProcessor.generateIdempotencyKey(payload)

      expect(key1).toBe(key2)
      expect(key1).toHaveLength(64) // SHA-256 hex length
    })

    it('should retry failed webhooks', async () => {
      const webhookPayload = {
        topic: 'orders',
        resource: '/orders/99999',
        resource_id: '99999',
        user_id: 'ML_WEBHOOK_TEST',
        application_id: 'APP123',
        sent: new Date().toISOString()
      }

      // Process webhook
      const result = await webhookProcessor.processWebhook(
        webhookPayload,
        testOrg.id,
        testAccount.id
      )

      // Mark as failed
      await webhookProcessor.markAsFailed(result.webhookId!, 'Test error')

      // Try to process again (should retry)
      const retryResult = await webhookProcessor.processWebhook(
        webhookPayload,
        testOrg.id,
        testAccount.id
      )

      expect(retryResult.processed).toBe(true)
      
      // Check status was reset to PENDING
      const webhook = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: result.webhookId || '' }
      })
      expect(webhook?.status).toBe('PENDING')
    })
  })

  describe('Webhook Validation', () => {
    it('should validate webhook payload structure', () => {
      const validPayload = {
        resource: '/questions/12345',
        user_id: 'ML123456',
        topic: 'questions',
        application_id: 'APP123',
        sent: new Date().toISOString()
      }

      const isValid = MLWebhookValidator['validatePayloadStructure'](validPayload)
      expect(isValid).toBe(true)

      // Invalid payload (missing required fields)
      const invalidPayload = {
        resource: '/questions/12345'
      }

      const isInvalid = MLWebhookValidator['validatePayloadStructure'](invalidPayload)
      expect(isInvalid).toBe(false)
    })

    it('should validate webhook topics', () => {
      const validTopics = [
        'questions',
        'orders_v2',
        'items',
        'messages',
        'claims',
        'shipments',
        'payments'
      ]

      validTopics.forEach(topic => {
        const payload = {
          resource: '/test',
          user_id: 'ML123',
          topic,
          application_id: 'APP123',
          sent: new Date().toISOString()
        }

        const isValid = MLWebhookValidator['validatePayloadStructure'](payload)
        expect(isValid).toBe(true)
      })

      // Invalid topic
      const invalidPayload = {
        resource: '/test',
        user_id: 'ML123',
        topic: 'invalid_topic',
        application_id: 'APP123',
        sent: new Date().toISOString()
      }

      const isInvalid = MLWebhookValidator['validatePayloadStructure'](invalidPayload)
      expect(isInvalid).toBe(false)
    })
  })

  describe('Question Webhook Processing', () => {
    it('should create question from webhook', async () => {
      const questionPayload = {
        topic: 'questions',
        resource: '/questions/Q123456',
        resource_id: 'Q123456',
        user_id: 'ML_WEBHOOK_TEST',
        application_id: 'APP123',
        sent: new Date().toISOString()
      }

      // Process webhook
      const result = await webhookProcessor.processWebhook(
        questionPayload,
        testOrg.id,
        testAccount.id
      )

      expect(result.processed).toBe(true)

      // Verify webhook event was created
      const webhookEvent = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: result.webhookId || '' }
      })

      expect(webhookEvent).toBeDefined()
      expect(webhookEvent?.eventType).toBe('questions')
      expect(webhookEvent?.resourceId).toBe('Q123456')
      expect(webhookEvent?.status).toBe('PENDING')
    })
  })

  describe('Webhook Statistics', () => {
    it('should track webhook processing statistics', async () => {
      // Create multiple webhooks with different statuses
      const webhooks = [
        { status: 'PENDING', resourceId: 'test1' },
        { status: 'PENDING', resourceId: 'test2' },
        { status: 'PROCESSING', resourceId: 'test3' },
        { status: 'COMPLETED', resourceId: 'test4' },
        { status: 'COMPLETED', resourceId: 'test5' },
        { status: 'FAILED', resourceId: 'test6' }
      ]

      for (const webhook of webhooks) {
        await prisma.webhookEvent.create({
          data: {
            idempotencyKey: `key-${webhook.resourceId}`,
            organizationId: testOrg.id,
            mlAccountId: testAccount.id,
            eventType: 'test',
            resourceId: webhook.resourceId,
            status: webhook.status,
            receivedAt: new Date(),
            payload: {}
          }
        })
      }

      // Get statistics
      const stats = await webhookProcessor.getStatistics()

      expect(stats.total).toBe(6)
      expect(stats.pending).toBe(2)
      expect(stats.processing).toBe(1)
      expect(stats.completed).toBe(2)
      expect(stats.failed).toBe(1)
      expect(stats.successRate).toBeCloseTo(33.33, 1)
    })

    it('should get pending webhooks for processing', async () => {
      // Create webhooks with different priorities
      await prisma.webhookEvent.create({
        data: {
          idempotencyKey: 'high-priority',
          organizationId: testOrg.id,
          eventType: 'claims',
          resourceId: 'CLAIM123',
          status: 'PENDING',
          priority: 10,
          receivedAt: new Date(),
          payload: {}
        }
      })

      await prisma.webhookEvent.create({
        data: {
          idempotencyKey: 'normal-priority',
          organizationId: testOrg.id,
          eventType: 'questions',
          resourceId: 'Q456',
          status: 'PENDING',
          priority: 0,
          receivedAt: new Date(),
          payload: {}
        }
      })

      // Get pending webhooks
      const pending = await webhookProcessor.getPendingWebhooks(10)

      expect(pending).toHaveLength(2)
      // High priority should come first
      expect(pending[0].resourceId).toBe('CLAIM123')
      expect(pending[1].resourceId).toBe('Q456')
    })
  })

  describe('Webhook Cleanup', () => {
    it('should cleanup old completed webhooks', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 40) // 40 days ago

      // Create old completed webhook
      await prisma.webhookEvent.create({
        data: {
          idempotencyKey: 'old-webhook',
          organizationId: testOrg.id,
          eventType: 'test',
          resourceId: 'OLD123',
          status: 'COMPLETED',
          receivedAt: oldDate,
          processedAt: oldDate,
          payload: {}
        }
      })

      // Create recent completed webhook
      await prisma.webhookEvent.create({
        data: {
          idempotencyKey: 'recent-webhook',
          organizationId: testOrg.id,
          eventType: 'test',
          resourceId: 'RECENT123',
          status: 'COMPLETED',
          receivedAt: new Date(),
          processedAt: new Date(),
          payload: {}
        }
      })

      // Cleanup webhooks older than 30 days
      const cleaned = await webhookProcessor.cleanupOldWebhooks(30)

      expect(cleaned).toBe(1)

      // Verify only recent webhook remains
      const remaining = await prisma.webhookEvent.findMany()
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.resourceId).toBe('RECENT123')
    })
  })
})
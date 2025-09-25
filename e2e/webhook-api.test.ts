/**
 * E2E Test: Webhook and API Integration
 * Tests webhook processing and ML API integration
 */

import { prisma } from '@/lib/prisma'
import { webhookProcessor } from '@/lib/webhooks/idempotent-processor'
import { webhookQueue } from '@/lib/queue/webhook-queue'

describe('E2E: Webhook and API Integration', () => {
  const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'https://gugaleo.axnexlabs.com.br'
  let testOrg: any
  let testAccount: any
  
  beforeAll(async () => {
    // Create test organization and account
    testOrg = await prisma.organization.create({
      data: {
        plan: 'PRO',
        subscriptionStatus: 'ACTIVE'
      }
    })
    
    testAccount = await prisma.mLAccount.create({
      data: {
        mlUserId: 'ML_WEBHOOK_E2E_' + Date.now(),
        nickname: 'WEBHOOK_E2E_SELLER',
        siteId: 'MLB',
        organizationId: testOrg.id,
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
  
  afterAll(async () => {
    // Cleanup
    await prisma.webhookEvent.deleteMany({
      where: { organizationId: testOrg.id }
    })
    await prisma.question.deleteMany({
      where: { 
        mlAccount: {
          organizationId: testOrg.id
        }
      }
    })
    await prisma.mLAccount.deleteMany({
      where: { organizationId: testOrg.id }
    })
    await prisma.organization.delete({
      where: { id: testOrg.id }
    })
    await webhookQueue.shutdown()
    await prisma.$disconnect()
  })
  
  describe('Webhook Processing', () => {
    it('should process webhook with idempotency', async () => {
      const webhookPayload = {
        _id: 'test-webhook-' + Date.now(),
        topic: 'questions',
        resource: '/questions/TEST123',
        resource_id: 'TEST123',
        user_id: testAccount.mlUserId,
        application_id: 'APP_E2E',
        sent: new Date().toISOString(),
        attempts: 1
      }
      
      // Send webhook
      const response = await fetch(`${API_URL}/api/webhooks/ml`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Real-IP': '52.55.239.180' // ML IP for testing
        },
        body: JSON.stringify(webhookPayload)
      })
      
      expect(response.status).toBe(200)
      
      // Try to send duplicate
      const duplicateResponse = await fetch(`${API_URL}/api/webhooks/ml`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Real-IP': '52.55.239.180'
        },
        body: JSON.stringify(webhookPayload)
      })
      
      expect(duplicateResponse.status).toBe(200)
      const data = await duplicateResponse.json()
      expect(data.message).toBe('Already processed')
      
      // Verify only one webhook event created
      const events = await prisma.webhookEvent.findMany({
        where: { resourceId: 'TEST123' }
      })
      expect(events).toHaveLength(1)
    })
    
    it('should handle webhook queue processing', async () => {
      const webhookPayload = {
        topic: 'orders_v2',
        resource: '/orders/ORDER123',
        resource_id: 'ORDER123',
        user_id: testAccount.mlUserId,
        application_id: 'APP_E2E',
        sent: new Date().toISOString()
      }
      
      // Process through queue
      const result = await webhookProcessor.processWebhook(
        webhookPayload,
        testOrg.id,
        testAccount.id
      )
      
      expect(result.processed).toBe(true)
      expect(result.webhookId).toBeDefined()
      
      // Add to queue
      const job = await webhookQueue.addWebhook(
        result.webhookId!,
        webhookPayload,
        testOrg.id,
        testAccount.id,
        0
      )
      
      expect(job.id).toBeDefined()
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Check queue statistics
      const stats = await webhookQueue.getStatistics()
      expect(stats.health).toBe('healthy')
    })
  })
  
  describe('Circuit Breaker', () => {
    it('should handle circuit breaker states', async () => {
      // Get circuit breaker status
      const response = await fetch(`${API_URL}/api/health`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.checks).toHaveProperty('circuitBreaker')
      
      if (data.checks.circuitBreaker) {
        expect(data.checks.circuitBreaker.status).toBeDefined()
        expect(['healthy', 'degraded']).toContain(data.checks.circuitBreaker.status)
      }
    })
  })
  
  describe('Metrics Endpoint', () => {
    it('should expose Prometheus metrics', async () => {
      const response = await fetch(`${API_URL}/api/metrics`)
      
      // Should work without auth in test, or return 401 if protected
      expect([200, 401]).toContain(response.status)
      
      if (response.status === 200) {
        const metrics = await response.text()
        
        // Check for key metrics
        expect(metrics).toContain('nodejs_memory_heap_used_bytes')
        expect(metrics).toContain('http_requests_total')
        expect(metrics).toContain('webhook_queue')
        expect(metrics).toContain('circuit_breaker')
      }
    })
  })
  
  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const startTime = Date.now()
      const concurrentRequests = 10
      
      // Make concurrent health check requests
      const requests = Array(concurrentRequests).fill(null).map(() =>
        fetch(`${API_URL}/api/health`)
      )
      
      const responses = await Promise.all(requests)
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Should complete within reasonable time (5 seconds for 10 requests)
      expect(totalTime).toBeLessThan(5000)
      
      // Average response time should be good
      const avgResponseTime = totalTime / concurrentRequests
      expect(avgResponseTime).toBeLessThan(500) // <500ms average
    })
    
    it('should maintain performance under load', async () => {
      const iterations = 5
      const responseTimes: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now()
        const response = await fetch(`${API_URL}/api/health`)
        const end = Date.now()
        
        expect(response.status).toBe(200)
        responseTimes.push(end - start)
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Calculate P95 response time
      responseTimes.sort((a, b) => a - b)
      const p95Index = Math.floor(responseTimes.length * 0.95)
      const p95ResponseTime = responseTimes[p95Index]
      
      // P95 should be under 500ms
      expect(p95ResponseTime).toBeLessThan(500)
    })
  })
})
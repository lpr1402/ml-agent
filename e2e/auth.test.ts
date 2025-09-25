/**
 * E2E Test: Authentication Flow
 * Tests complete OAuth flow in production environment
 */

import { prisma } from '@/lib/prisma'

describe('E2E: Authentication Flow', () => {
  const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'https://gugaleo.axnexlabs.com.br'
  
  beforeAll(async () => {
    // Ensure test organization exists
    await prisma.organization.upsert({
      where: { id: 'test-org-e2e' },
      update: {},
      create: {
        id: 'test-org-e2e',
        plan: 'PRO',
        subscriptionStatus: 'ACTIVE'
      }
    })
  })
  
  afterAll(async () => {
    // Cleanup test data
    await prisma.session.deleteMany({
      where: { organizationId: 'test-org-e2e' }
    })
    await prisma.mLAccount.deleteMany({
      where: { organizationId: 'test-org-e2e' }
    })
    await prisma.organization.delete({
      where: { id: 'test-org-e2e' }
    })
    await prisma.$disconnect()
  })
  
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${API_URL}/api/health`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.status).toBe('healthy')
      expect(data.checks).toHaveProperty('database')
      expect(data.checks).toHaveProperty('redis')
      expect(data.checks).toHaveProperty('memory')
    })
  })
  
  describe('Session Management', () => {
    it('should create and validate session', async () => {
      // Create test ML account
      const mlAccount = await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_E2E_TEST_' + Date.now(),
          nickname: 'E2E_TEST_SELLER',
          siteId: 'MLB',
          organizationId: 'test-org-e2e',
          accessToken: 'encrypted_test_token',
          accessTokenIV: 'test_iv',
          accessTokenTag: 'test_tag',
          refreshToken: 'encrypted_refresh',
          refreshTokenIV: 'refresh_iv',
          refreshTokenTag: 'refresh_tag',
          tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
          isPrimary: true,
          isActive: true
        }
      })
      
      // Create session
      const sessionToken = 'e2e-session-' + Date.now()
      const session = await prisma.session.create({
        data: {
          sessionToken,
          organizationId: 'test-org-e2e',
          activeMLAccountId: mlAccount.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ipAddress: '127.0.0.1',
          userAgent: 'E2E Test Agent'
        }
      })
      
      // Use session to avoid unused variable error
      expect(session.id).toBeDefined()
      
      // Validate session endpoint
      const response = await fetch(`${API_URL}/api/auth/session`, {
        headers: {
          'Cookie': `ml-agent-session=${sessionToken}`
        }
      })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.valid).toBe(true)
      expect(data.organizationId).toBe('test-org-e2e')
    })
    
    it('should reject invalid session', async () => {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        headers: {
          'Cookie': 'ml-agent-session=invalid-token'
        }
      })
      
      expect(response.status).toBe(401)
    })
  })
  
  describe('Multi-Account Management', () => {
    it('should handle account switching', async () => {
      // Create primary account
      const primary = await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_PRIMARY_E2E_' + Date.now(),
          nickname: 'PRIMARY_E2E',
          organizationId: 'test-org-e2e',
          siteId: 'MLB',
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
      
      // Create secondary account
      const secondary = await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_SECONDARY_E2E_' + Date.now(),
          nickname: 'SECONDARY_E2E',
          organizationId: 'test-org-e2e',
          siteId: 'MLB',
          accessToken: 'encrypted',
          accessTokenIV: 'iv',
          accessTokenTag: 'tag',
          refreshToken: 'encrypted',
          refreshTokenIV: 'iv',
          refreshTokenTag: 'tag',
          tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
          isPrimary: false,
          isActive: true
        }
      })
      
      // Create session with primary
      const sessionToken = 'e2e-switch-' + Date.now()
      await prisma.session.create({
        data: {
          sessionToken,
          organizationId: 'test-org-e2e',
          activeMLAccountId: primary.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      })
      
      // Switch to secondary account
      const response = await fetch(`${API_URL}/api/ml-accounts/switch`, {
        method: 'POST',
        headers: {
          'Cookie': `ml-agent-session=${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accountId: secondary.id })
      })
      
      expect(response.status).toBe(200)
      
      // Verify switch
      const session = await prisma.session.findUnique({
        where: { sessionToken }
      })
      expect(session?.activeMLAccountId).toBe(secondary.id)
    })
  })
  
  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = []
      
      // Make 25 rapid requests (over limit)
      for (let i = 0; i < 25; i++) {
        requests.push(
          fetch(`${API_URL}/api/health`)
        )
      }
      
      const responses = await Promise.all(requests)
      const statusCodes = responses.map(r => r.status)
      
      // Some should be rate limited
      expect(statusCodes).toContain(429)
    })
  })
})
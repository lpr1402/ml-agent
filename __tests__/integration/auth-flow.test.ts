/**
 * Integration Test: Authentication Flow
 * Tests the complete OAuth flow with Mercado Livre
 */

import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/security/encryption'
import { verifySession } from '@/lib/auth/session-validator'
import { generateCSRFToken } from '@/lib/security/csrf'

describe('Authentication Flow Integration', () => {
  beforeEach(async () => {
    // Clean database
    await prisma.session.deleteMany()
    await prisma.mLAccount.deleteMany()
    await prisma.organization.deleteMany()
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  describe('OAuth Callback', () => {
    it('should create organization and ML account on first login', async () => {
      // Simulate ML OAuth callback
      const mlUserId = 'ML123456'
      const accessToken = 'test-access-token'
      const refreshToken = 'test-refresh-token'
      
      // Create organization
      const org = await prisma.organization.create({
        data: {}
      })

      // Encrypt tokens
      const encrypted = encryptToken(accessToken)
      
      // Create ML account
      const mlAccount = await prisma.mLAccount.create({
        data: {
          mlUserId,
          nickname: 'TESTSELLER',
          siteId: 'MLB',
          organizationId: org.id,
          accessToken: encrypted.encrypted,
          accessTokenIV: encrypted.iv,
          accessTokenTag: encrypted.authTag,
          refreshToken: encryptToken(refreshToken).encrypted,
          refreshTokenIV: encryptToken(refreshToken).iv,
          refreshTokenTag: encryptToken(refreshToken).authTag,
          tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
          isPrimary: true,
          isActive: true
        }
      })

      expect(mlAccount).toBeDefined()
      expect(mlAccount.mlUserId).toBe(mlUserId)
      expect(mlAccount.isPrimary).toBe(true)
    })

    it('should handle multiple accounts for same organization', async () => {
      // Create organization
      const org = await prisma.organization.create({
        data: {
          plan: 'PRO'
        }
      })

      // Create primary account
      await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_PRIMARY',
          nickname: 'PRIMARY_SELLER',
          siteId: 'MLB',
          organizationId: org.id,
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

      // Create secondary accounts
      await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_SECONDARY_1',
          nickname: 'SECONDARY_1',
          siteId: 'MLB',
          organizationId: org.id,
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

      // Verify accounts
      const accounts = await prisma.mLAccount.findMany({
        where: { organizationId: org.id }
      })

      expect(accounts).toHaveLength(2)
      expect(accounts.filter(a => a.isPrimary)).toHaveLength(1)
      expect(accounts.filter(a => !a.isPrimary)).toHaveLength(1)
    })

    it('should not create duplicate organizations for same ML user', async () => {
      const mlUserId = 'ML_DUPLICATE_TEST'
      
      // First login
      const org1 = await prisma.organization.create({
        data: {}
      })

      await prisma.mLAccount.create({
        data: {
          mlUserId,
          nickname: 'SELLER',
          siteId: 'MLB',
          organizationId: org1.id,
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

      // Second login with same ML user
      const existingAccount = await prisma.mLAccount.findUnique({
        where: { mlUserId },
        include: { organization: true }
      })

      expect(existingAccount).toBeDefined()
      expect(existingAccount?.organizationId).toBe(org1.id)
      
      // Should not create new organization
      const orgs = await prisma.organization.findMany()
      expect(orgs).toHaveLength(1)
    })
  })

  describe('Session Management', () => {
    it('should create and validate session', async () => {
      // Create test organization and account
      const org = await prisma.organization.create({
        data: {}
      })

      const mlAccount = await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_SESSION',
          nickname: 'SESSION_TEST',
          siteId: 'MLB',
          organizationId: org.id,
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

      // Create session
      const sessionToken = 'test-session-token-' + Date.now()
      await prisma.session.create({
        data: {
          sessionToken,
          organizationId: org.id,
          activeMLAccountId: mlAccount.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent'
        }
      })

      // Validate session
      const validSession = await verifySession(sessionToken)
      
      expect(validSession).toBeDefined()
      expect(validSession?.organizationId).toBe(org.id)
      expect(validSession?.activeMLAccountId).toBe(mlAccount.id)
    })

    it('should reject expired sessions', async () => {
      const org = await prisma.organization.create({
        data: {}
      })

      // Create expired session
      const sessionToken = 'expired-session-' + Date.now()
      await prisma.session.create({
        data: {
          sessionToken,
          organizationId: org.id,
          expiresAt: new Date(Date.now() - 1000), // Already expired
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent'
        }
      })

      // Try to validate
      const validSession = await verifySession(sessionToken)
      
      expect(validSession).toBeNull()
      
      // Session should be deleted
      const deletedSession = await prisma.session.findUnique({
        where: { sessionToken }
      })
      expect(deletedSession).toBeNull()
    })
  })

  describe('CSRF Protection', () => {
    it('should generate and validate CSRF tokens', () => {
      const token = generateCSRFToken()
      
      expect(token).toBeDefined()
      expect(token.length).toBeGreaterThan(32)
      
      // Token should be different each time
      const token2 = generateCSRFToken()
      expect(token2).not.toBe(token)
    })
  })

  describe('Account Switching', () => {
    it('should allow switching between ML accounts', async () => {
      // Create organization with multiple accounts
      const org = await prisma.organization.create({
        data: {
          plan: 'PRO'
        }
      })

      const account1 = await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_ACC1',
          nickname: 'ACCOUNT_1',
          siteId: 'MLB',
          organizationId: org.id,
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

      const account2 = await prisma.mLAccount.create({
        data: {
          mlUserId: 'ML_ACC2',
          nickname: 'ACCOUNT_2',
          siteId: 'MLB',
          organizationId: org.id,
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

      // Create session with first account
      const sessionToken = 'switch-test-' + Date.now()
      let session = await prisma.session.create({
        data: {
          sessionToken,
          organizationId: org.id,
          activeMLAccountId: account1.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      })

      expect(session.activeMLAccountId).toBe(account1.id)

      // Switch to second account
      session = await prisma.session.update({
        where: { sessionToken },
        data: { activeMLAccountId: account2.id }
      })

      expect(session.activeMLAccountId).toBe(account2.id)
      
      // Organization should remain the same
      expect(session.organizationId).toBe(org.id)
    })
  })
})
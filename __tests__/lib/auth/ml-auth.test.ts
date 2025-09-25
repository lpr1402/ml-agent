/**
 * Tests for ML Authentication System
 */

import { createSession, addMLAccountToOrganization, getCurrentSession } from '@/lib/auth/ml-auth'
import { prisma } from '@/lib/prisma'
// import { encryptToken - unused } from '@/lib/security/encryption'

jest.mock('@/lib/security/encryption', () => ({
  generateSecureToken: jest.fn(() => 'test-token-123'),
  encryptToken: jest.fn(() => ({
    encrypted: 'encrypted-token',
    iv: 'test-iv',
    authTag: 'test-tag',
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  headers: jest.fn(() => ({
    get: jest.fn(() => '127.0.0.1'),
  })),
}))

describe('ML Authentication', () => {
  describe('createSession', () => {
    it('should create a new session for first-time user', async () => {
      // Mock no existing account
      ;(prisma.mLAccount.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValue(null)
      
      // Mock transaction
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          mLAccount: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'ml-account-123',
              mlUserId: 'ML123',
              nickname: 'TestSeller',
              organizationId: 'org-123',
            }),
          },
          organization: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'org-123',
              primaryMLUserId: 'ML123',
              primaryNickname: 'TestSeller',
            }),
            update: jest.fn(),
          },
          session: {
            create: jest.fn().mockResolvedValue({
              id: 'session-123',
              sessionToken: 'test-token-123',
              organizationId: 'org-123',
              activeMLAccountId: 'ml-account-123',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }),
          },
        }
        return callback(mockTx)
      })

      const session = await createSession(
        'ML123',
        'TestSeller',
        'test@example.com',
        'MLB',
        {
          access_token: 'ml-access-token',
          refresh_token: 'ml-refresh-token',
          expires_in: 21600,
        }
      )

      expect(session).toMatchObject({
        organizationId: 'org-123',
        primaryMLUserId: 'ML123',
        primaryNickname: 'TestSeller',
        sessionToken: 'test-token-123',
      })
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should use existing organization for returning user', async () => {
      // Mock existing account
      const existingAccount = {
        id: 'ml-account-existing',
        mlUserId: 'ML123',
        organizationId: 'org-existing',
        organization: {
          id: 'org-existing',
          primaryMLUserId: 'ML123',
          primaryNickname: 'TestSeller',
        },
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          mLAccount: {
            findUnique: jest.fn().mockResolvedValue(existingAccount),
            update: jest.fn().mockResolvedValue(existingAccount),
          },
          session: {
            create: jest.fn().mockResolvedValue({
              id: 'session-new',
              sessionToken: 'test-token-new',
              organizationId: 'org-existing',
              activeMLAccountId: 'ml-account-existing',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }),
          },
        }
        return callback(mockTx)
      })

      const session = await createSession(
        'ML123',
        'TestSeller',
        'test@example.com',
        'MLB',
        {
          access_token: 'ml-access-token',
          refresh_token: 'ml-refresh-token',
          expires_in: 21600,
        }
      )

      expect(session.organizationId).toBe('org-existing')
      expect(session.primaryMLUserId).toBe('ML123')
    })
  })

  describe('addMLAccountToOrganization', () => {
    it('should add new ML account to existing organization', async () => {
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-123',
        primaryMLUserId: 'ML111',
      })
      
      ;(prisma.mLAccount.findUnique as jest.Mock).mockResolvedValue(null)
      
      ;(prisma.mLAccount.create as jest.Mock).mockResolvedValue({
        id: 'ml-account-new',
        mlUserId: 'ML222',
        nickname: 'SecondStore',
        organizationId: 'org-123',
        isPrimary: false,
      })

      const accountId = await addMLAccountToOrganization(
        'org-123',
        'ML222',
        'SecondStore',
        'second@example.com',
        'MLB',
        {
          access_token: 'ml-access-token-2',
          refresh_token: 'ml-refresh-token-2',
          expires_in: 21600,
        }
      )

      expect(accountId).toBe('ml-account-new')
      expect(prisma.mLAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mlUserId: 'ML222',
            nickname: 'SecondStore',
            isPrimary: false,
            organizationId: 'org-123',
          }),
        })
      )
    })

    it('should throw error if account already exists', async () => {
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-123',
      })
      
      ;(prisma.mLAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-account',
        mlUserId: 'ML222',
        organizationId: 'org-other',
      })

      await expect(
        addMLAccountToOrganization(
          'org-123',
          'ML222',
          'SecondStore',
          null,
          'MLB',
          {
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 21600,
          }
        )
      ).rejects.toThrow('Esta conta ML (SecondStore) já está conectada a outra organização')
    })
  })

  describe('getCurrentSession', () => {
    it('should return null if no session cookie', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue(undefined),
      })

      const session = await getCurrentSession()
      expect(session).toBeNull()
    })

    it('should return session if valid', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: 'valid-token' }),
      })

      ;(prisma.session.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-123',
        sessionToken: 'valid-token',
        organizationId: 'org-123',
        activeMLAccountId: 'ml-account-123',
        expiresAt: new Date(Date.now() + 1000000),
        organization: {
          primaryMLUserId: 'ML123',
          primaryNickname: 'TestSeller',
          primaryMLAccountId: 'ml-account-123',
        },
      })

      const session = await getCurrentSession()
      
      expect(session).toMatchObject({
        id: 'session-123',
        organizationId: 'org-123',
        primaryMLUserId: 'ML123',
        primaryNickname: 'TestSeller',
      })
    })

    it('should return null if session expired', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: 'expired-token' }),
      })

      ;(prisma.session.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-123',
        sessionToken: 'expired-token',
        expiresAt: new Date(Date.now() - 1000000), // Expired
        organization: {},
      })

      const session = await getCurrentSession()
      expect(session).toBeNull()
    })
  })
})
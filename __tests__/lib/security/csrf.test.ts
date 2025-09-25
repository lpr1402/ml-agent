/**
 * Tests for CSRF Protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  generateCSRFToken, 
  verifyCSRFToken, 
  csrfMiddleware 
} from '@/lib/security/csrf'

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

describe('CSRF Protection', () => {
  describe('generateCSRFToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = generateCSRFToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken()
      const token2 = generateCSRFToken()
      expect(token1).not.toBe(token2)
    })
  })

  describe('verifyCSRFToken', () => {
    it('should skip verification for GET requests', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
      })

      const result = await verifyCSRFToken(request)
      expect(result).toBe(true)
    })

    it('should skip verification for webhook endpoints', async () => {
      const request = new NextRequest('https://example.com/api/webhooks/ml', {
        method: 'POST',
      })

      const result = await verifyCSRFToken(request)
      expect(result).toBe(true)
    })

    it('should fail if no CSRF token in cookie', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue(undefined),
      })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await verifyCSRFToken(request)
      expect(result).toBe(false)
    })

    it('should fail if no CSRF token in header', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: 'token123' }),
      })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })

      const result = await verifyCSRFToken(request)
      expect(result).toBe(false)
    })

    it('should fail if tokens do not match', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: 'token123' }),
      })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'different-token',
        },
      })

      const result = await verifyCSRFToken(request)
      expect(result).toBe(false)
    })

    it('should succeed if tokens match', async () => {
      const validToken = 'valid-csrf-token-123'
      
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: validToken }),
      })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': validToken,
        },
      })

      const result = await verifyCSRFToken(request)
      expect(result).toBe(true)
    })
  })

  describe('csrfMiddleware', () => {
    it('should return null for valid requests', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: 'valid-token' }),
      })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'valid-token',
        },
      })

      const result = await csrfMiddleware(request)
      expect(result).toBeNull()
    })

    it('should return 403 for invalid CSRF token', async () => {
      const { cookies } = await import('next/headers')
      ;(cookies as jest.Mock).mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: 'cookie-token' }),
      })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'wrong-token',
        },
      })

      const result = await csrfMiddleware(request)
      expect(result).toBeInstanceOf(NextResponse)
      expect(result?.status).toBe(403)
    })
  })
})
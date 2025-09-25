/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const CSRF_COOKIE_NAME = 'ml-agent-csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Set CSRF token in cookie
 */
export async function setCSRFCookie(response: NextResponse): Promise<void> {
  const token = generateCSRFToken()
  // @ts-expect-error - cookieStore is used in middleware context
  const _cookieStore = await cookies()

  // Set CSRF token cookie
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/'
  })
}

/**
 * Verify CSRF token from request
 */
export async function verifyCSRFToken(request: NextRequest): Promise<boolean> {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true
  }

  // Skip for public API endpoints that use different auth
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api/webhooks/') || 
      pathname.startsWith('/api/ml-webhook/') ||
      pathname.startsWith('/api/health')) {
    return true
  }

  const cookieStore = await cookies()
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  // Both tokens must exist and match
  if (!cookieToken || !headerToken) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(cookieToken, headerToken)
}

/**
 * Constant-time string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * CSRF middleware for API routes
 */
export async function csrfMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const isValid = await verifyCSRFToken(request)
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }
  
  return null // Continue to next middleware
}

/**
 * Get CSRF token for client-side use
 */
export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_COOKIE_NAME)?.value || null
}
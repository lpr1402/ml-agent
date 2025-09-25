/**
 * Endpoint administrativo para gerenciar OAuth Rate Limiting
 * Apenas para debugging e manutenção
 */

import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { clearOAuthRateLimit, getOAuthRateLimitStatus } from '@/lib/api/oauth-rate-limiter'

export async function GET() {
  try {
    const status = await getOAuthRateLimitStatus()

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[Admin] Failed to get OAuth rate limit status', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Verificar autenticação admin (implementar conforme necessário)
    // Por enquanto, aceitar apenas em desenvolvimento
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Not allowed in production' },
        { status: 403 }
      )
    }

    await clearOAuthRateLimit()

    return NextResponse.json({
      success: true,
      message: 'OAuth rate limit cleared',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[Admin] Failed to clear OAuth rate limit', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to clear rate limit' },
      { status: 500 }
    )
  }
}
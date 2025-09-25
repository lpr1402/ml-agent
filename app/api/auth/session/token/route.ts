import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAccount } from '@/lib/api/session-auth'
import { sign } from 'jsonwebtoken'
import { logger } from '@/lib/logger'

/**
 * GET /api/auth/session/token
 * Retorna um token JWT para autenticação do WebSocket
 */
export async function GET(_request: NextRequest) {
  try {
    // Verificar se usuário está autenticado
    const auth = await getAuthenticatedAccount()

    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Criar payload do token
    const payload = {
      mlAccountId: auth.mlAccount.id,
      mlUserId: auth.mlAccount.mlUserId,
      organizationId: auth.organizationId,
      nickname: auth.mlAccount.nickname,
      type: 'websocket',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hora
    }

    // Assinar token
    const secret = process.env['SESSION_SECRET'] || 'ml-agent-session-secret-2025'
    const token = sign(payload, secret)

    logger.info('[Session Token] Token generated for WebSocket auth', {
      mlAccountId: auth.mlAccount.id,
      organizationId: auth.organizationId
    })

    return NextResponse.json({
      token,
      expiresIn: 3600
    })

  } catch (error) {
    logger.error('[Session Token] Error generating token:', { error })
    return NextResponse.json(
      { error: 'Failed to generate session token' },
      { status: 500 }
    )
  }
}
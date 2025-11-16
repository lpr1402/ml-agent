/**
 * Profile Refresh Endpoint
 * Permite refresh manual do perfil da conta ML (nickname, avatar, reputação)
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { profileRefreshManager } from '@/lib/ml-api/profile-refresh-manager'

export async function POST(request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { accountId, force = false } = await request.json()

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    // Verificar se a conta pertence à organização do usuário
    const { prisma } = await import('@/lib/prisma')

    const account = await prisma.mLAccount.findFirst({
      where: {
        id: accountId,
        organizationId: session.organizationId
      }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    logger.info('[API] Profile refresh requested', {
      accountId,
      nickname: account.nickname,
      force,
      organizationId: session.organizationId
    })

    // Executar refresh
    const result = await profileRefreshManager.refreshProfile(accountId, 'manual', force)

    if (result.success) {
      return NextResponse.json({
        success: true,
        changes: result.changes,
        message: result.changes.length > 0
          ? `Perfil atualizado: ${result.changes.join(', ')}`
          : 'Perfil já estava atualizado'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to refresh profile'
      }, { status: 500 })
    }

  } catch (error) {
    logger.error('[API] Profile refresh error', { error })

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

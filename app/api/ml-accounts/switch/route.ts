import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * GET /api/ml-accounts/switch
 * Lista todas as contas ML da organização
 */
export async function GET(request: NextRequest) {
  try {
    // Obter sessão do usuário
    const sessionToken = request.cookies.get('ml-agent-session')?.value
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Buscar sessão no banco pelo TOKEN, não pelo ID!
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: {
          include: {
            mlAccounts: {
              orderBy: [
                { isPrimary: 'desc' },
                { nickname: 'asc' }
              ]
            }
          }
        }
      }
    })
    
    if (!session || !session.organization) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 })
    }

    // 🎯 OTIMIZAÇÃO PRODUCTION-READY
    // Avatares são capturados no OAuth callback e atualizados por background worker diário
    // Isso elimina chamadas API desnecessárias e previne rate limit 429
    logger.info('[ML Accounts] Returning accounts from database (avatars updated by background worker)')

    // Mapear contas com status
    const accounts = session.organization.mlAccounts.map(account => ({
      id: account.id,
      mlUserId: account.mlUserId,
      nickname: account.nickname,
      email: account.email,
      siteId: account.siteId,
      thumbnail: account.thumbnail,
      isPrimary: account.isPrimary,
      isActive: account.isActive,
      isCurrentActive: account.id === session.activeMLAccountId,
      tokenValid: account.tokenExpiresAt > new Date(),
      connectionError: account.connectionError
    }))
    
    return NextResponse.json({
      accounts,
      activeAccountId: session.activeMLAccountId,
      organizationId: session.organizationId
    })
    
  } catch (error) {
    logger.error('[ML Accounts] Error fetching accounts:', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/ml-accounts/switch
 * Alterna entre contas ML
 */
export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json()
    
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }
    
    // Obter sessão do usuário
    const sessionToken = request.cookies.get('ml-agent-session')?.value
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Buscar sessão e verificar se conta pertence à organização
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: {
          include: {
            mlAccounts: {
              where: { id: accountId }
            }
          }
        }
      }
    })
    
    if (!session || !session.organization) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 })
    }
    
    if (session.organization.mlAccounts.length === 0) {
      return NextResponse.json({ error: 'Account not found in organization' }, { status: 403 })
    }
    
    // Atualizar conta ativa na sessão
    await prisma.session.update({
      where: { sessionToken },
      data: {
        activeMLAccountId: accountId,
        updatedAt: new Date()
      }
    })
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'SWITCH_ACCOUNT',
        entityType: 'MLAccount',
        entityId: accountId,
        organizationId: session.organizationId,
        metadata: {
          previousAccountId: session.activeMLAccountId,
          newAccountId: accountId
        }
      }
    })
    
    logger.info('[ML Accounts] Account switched', {
      organizationId: session.organizationId,
      previousAccount: session.activeMLAccountId,
      newAccount: accountId
    })
    
    return NextResponse.json({
      success: true,
      activeAccountId: accountId
    })
    
  } catch (error) {
    logger.error('[ML Accounts] Error switching account:', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
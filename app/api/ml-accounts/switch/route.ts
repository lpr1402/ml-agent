import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { fetchWithRateLimit } from '@/lib/api/smart-rate-limiter'

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

    // Atualizar avatares de todas as contas usando users/me
    logger.info('[ML Accounts] Updating avatars for all accounts')

    const { decryptToken } = require('@/lib/security/encryption')

    for (const account of session.organization.mlAccounts) {
      // Só atualizar se tem token válido
      if (account.tokenExpiresAt > new Date() && account.accessToken) {
        try {
          // Descriptografar token
          const accessToken = decryptToken({
            encrypted: account.accessToken,
            iv: account.accessTokenIV,
            authTag: account.accessTokenTag
          })

          // Buscar dados do usuário via users/me
          const userResponse = await fetchWithRateLimit(
            'https://api.mercadolibre.com/users/me',
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            },
            'users/me'
          )

          if (userResponse.ok) {
            const userData = await userResponse.json()

            // Extrair URL do avatar seguindo ordem de prioridade da API do ML
            let avatarUrl = null

            // 1. Thumbnail object (formato correto da API): { picture_id: "...", picture_url: "..." }
            if (userData.thumbnail && typeof userData.thumbnail === 'object' && userData.thumbnail.picture_url) {
              avatarUrl = userData.thumbnail.picture_url
            }
            // 2. Thumbnail string (formato legacy)
            else if (userData.thumbnail && typeof userData.thumbnail === 'string') {
              avatarUrl = userData.thumbnail
            }
            // 3. Logo (usuários empresariais)
            else if (userData.logo && typeof userData.logo === 'string') {
              avatarUrl = userData.logo
            }

            // Garantir URL completa
            if (avatarUrl) {
              if (avatarUrl.startsWith('//')) {
                avatarUrl = `https:${avatarUrl}`
              } else if (!avatarUrl.startsWith('http')) {
                avatarUrl = `https://http2.mlstatic.com${avatarUrl}`
              }
            }

            // Atualizar no banco se mudou
            if (avatarUrl && avatarUrl !== account.thumbnail) {
              await prisma.mLAccount.update({
                where: { id: account.id },
                data: {
                  thumbnail: avatarUrl,
                  updatedAt: new Date()
                }
              })

              // Atualizar o objeto local também
              account.thumbnail = avatarUrl

              logger.info(`[ML Accounts] Avatar updated for ${account.nickname}`, { avatarUrl })
            }
          }
        } catch (error) {
          logger.warn(`[ML Accounts] Failed to update avatar for ${account.nickname}`, { error })
        }
      }
    }

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
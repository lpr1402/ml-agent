/**
 * API para adicionar nova conta ML à organização existente
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/ml-auth'
import { prisma } from '@/lib/prisma'
import { 
  generateCodeVerifier, 
  generateCodeChallenge, 
  generateSecureToken 
} from '@/lib/security/encryption'

/**
 * GET /api/ml-accounts/add
 * Retorna a URL de autorização OAuth para adicionar nova conta
 */
export async function GET(_request: NextRequest) {
  try {
    // Verifica sessão
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Validar limites de conta por plano
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      include: {
        _count: {
          select: { mlAccounts: true }
        }
      }
    })
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    // Limites por plano
    const accountLimits = {
      TRIAL: 1,
      ACTIVE: 10,
      PAST_DUE: 3,
      CANCELLED: 0,
      EXPIRED: 0
    }
    
    const currentAccountCount = organization._count.mlAccounts
    const maxAccounts = accountLimits[organization.subscriptionStatus]
    
    if (currentAccountCount >= maxAccounts) {
      return NextResponse.json(
        { 
          error: 'Account limit reached',
          message: `Your ${organization.subscriptionStatus.toLowerCase()} plan allows ${maxAccounts} ML account(s). You currently have ${currentAccountCount}.`,
          requiresUpgrade: organization.subscriptionStatus === 'TRIAL'
        },
        { status: 403 }
      )
    }
    
    const clientId = process.env['ML_CLIENT_ID']!
    const redirectUri = process.env['ML_REDIRECT_URI']!
    
    // Gera PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateSecureToken(32)
    
    // Salva state no banco com organizationId para adicionar conta após callback
    await prisma.oAuthState.create({
      data: {
        state,
        codeVerifier,
        organizationId: session.organizationId,
        isPrimaryLogin: false, // Adicionando conta secundária
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    })
    
    // URL de autorização ML
    const authUrl = new URL('https://auth.mercadolivre.com.br/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('scope', 'offline_access write read')
    
    logger.info(`[ML Accounts] Initiating add account for org ${session.organizationId}`)
    
    return NextResponse.json({ 
      authUrl: authUrl.toString(),
      currentAccountCount,
      maxAccounts
    })
    
  } catch (error) {
    logger.error('[ML Accounts] Error getting auth URL:', { error })
    return NextResponse.json(
      { error: 'Failed to initiate ML account connection' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ml-accounts/add
 * Método legado - mantido para compatibilidade
 */
export async function POST(_request: Request) {
  try {
    // Verifica sessão
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Validar limites de conta por plano
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      include: {
        _count: {
          select: { mlAccounts: true }
        }
      }
    })
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    // Limites por plano
    const accountLimits = {
      TRIAL: 1,
      ACTIVE: 10,
      PAST_DUE: 3,
      CANCELLED: 0,
      EXPIRED: 0
    }
    
    const currentAccountCount = organization._count.mlAccounts
    const maxAccounts = accountLimits[organization.subscriptionStatus]
    
    if (currentAccountCount >= maxAccounts) {
      return NextResponse.json(
        { 
          error: 'Account limit reached',
          message: `Your ${organization.subscriptionStatus.toLowerCase()} plan allows ${maxAccounts} ML account(s). You currently have ${currentAccountCount}.`,
          requiresUpgrade: organization.subscriptionStatus === 'TRIAL'
        },
        { status: 403 }
      )
    }
    
    const clientId = process.env['ML_CLIENT_ID']!
    const redirectUri = process.env['ML_REDIRECT_URI']!
    
    // Gera PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateSecureToken(32)
    
    // Salva state no banco com organizationId para adicionar conta após callback
    await prisma.oAuthState.create({
      data: {
        state,
        codeVerifier,
        organizationId: session.organizationId,
        isPrimaryLogin: false, // Adicionando conta secundária
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    })
    
    // URL de autorização ML
    const authUrl = new URL('https://auth.mercadolivre.com.br/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('scope', 'offline_access write read')
    
    logger.info(`[ML Accounts] Initiating add account for org ${session.organizationId}`)
    
    return NextResponse.json({ authUrl: authUrl.toString() })
    
  } catch (error) {
    logger.error('[ML Accounts] Error adding account:', { error })
    return NextResponse.json(
      { error: 'Failed to initiate ML account connection' },
      { status: 500 }
    )
  }
}
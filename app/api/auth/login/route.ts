/**
 * Login endpoint for Mercado Livre OAuth 2.0
 * Implements PKCE flow for enhanced security
 */

import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { oauthManager } from '@/lib/auth/oauth-manager'
import { generateCodeChallenge } from '@/lib/security/encryption'

const PRODUCTION_URL = 'https://gugaleo.axnexlabs.com.br'

export async function GET(_request: Request) {
  const startTime = Date.now()

  try {
    const clientId = process.env['ML_CLIENT_ID']!
    const redirectUri = process.env['ML_REDIRECT_URI']!

    // Validar configuração
    if (!clientId || !redirectUri) {
      logger.error('[Auth] Missing OAuth configuration', {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri
      })
      return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=ConfigurationError`)
    }

    logger.info('[Auth] Starting OAuth login flow')

    // Usar OAuth Manager para criar state e fazer limpeza automática
    let state: string
    let codeVerifier: string
    let codeChallenge: string

    try {
      const oauthState = await oauthManager.createOAuthState(undefined, true)
      state = oauthState.state
      codeVerifier = oauthState.codeVerifier
      codeChallenge = generateCodeChallenge(codeVerifier)

      logger.info('[Auth] OAuth state created', {
        statePrefix: state.substring(0, 8),
        expiresIn: '10 minutes'
      })
    } catch (stateError) {
      logger.error('[Auth] Failed to create OAuth state', { error: stateError })
      return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=StateCreationFailed`)
    }

    // 6. Construir URL de autorização do Mercado Livre
    // Usar domínio correto baseado no país (.com.br para Brasil)
    const authUrl = new URL('https://auth.mercadolivre.com.br/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('scope', 'offline_access write read')

    const duration = Date.now() - startTime
    logger.info('[Auth] Redirecting to ML OAuth', {
      duration,
      authDomain: authUrl.hostname
    })

    // 7. Redirecionar para o Mercado Livre
    return NextResponse.redirect(authUrl.toString())

  } catch (_error) {
    const duration = Date.now() - startTime
    logger.error('[Auth] Login initiation error', { error: _error,
      stack: _error instanceof Error ? _error.stack : undefined,
      duration
    })

    // Sempre usar URL absoluta em produção
    return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=LoginFailed`)
  }
}

export async function POST(_request: Request) {
  // Alternativa: retorna a URL ao invés de redirecionar
  // Útil para aplicações SPA ou quando precisamos de mais controle
  const startTime = Date.now()

  try {
    const clientId = process.env['ML_CLIENT_ID']!
    const redirectUri = process.env['ML_REDIRECT_URI']!

    if (!clientId || !redirectUri) {
      return NextResponse.json({
        error: 'Missing OAuth configuration'
      }, { status: 500 })
    }

    logger.info('[Auth] POST login request - generating auth URL')

    // Usar OAuth Manager para criar state com limpeza automática
    const oauthState = await oauthManager.createOAuthState(undefined, true)
    const state = oauthState.state
    const codeVerifier = oauthState.codeVerifier
    const codeChallenge = generateCodeChallenge(codeVerifier)

    const authUrl = new URL('https://auth.mercadolivre.com.br/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('scope', 'offline_access write read')

    const duration = Date.now() - startTime
    logger.info('[Auth] Auth URL generated', { duration })

    return NextResponse.json({
      authUrl: authUrl.toString(),
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    })

  } catch (_error) {
    logger.error('[Auth] POST login error', { error: _error })
    return NextResponse.json({
      error: 'Failed to initiate login'
    }, { status: 500 })
  }
}

// Endpoint para verificar status do OAuth
export async function OPTIONS(_request: Request) {
  try {
    // Limpar rate limits se necessário
    await oauthManager.clearRateLimits().catch(() => {})

    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    })

  } catch (_error) {
    return NextResponse.json({
      status: 'error',
      error: 'OAuth manager not ready'
    }, { status: 503 })
  }
}
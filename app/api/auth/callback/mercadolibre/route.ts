import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createSession, addMLAccountToOrganization } from "@/lib/auth/ml-auth"
import { auditSecurityEvent } from "@/lib/audit/audit-logger"
import { fetchWithRateLimit } from "@/lib/api/smart-rate-limiter"
import { oauthManager } from "@/lib/auth/oauth-manager"
import { prisma } from "@/lib/prisma"
import crypto from 'crypto'
const REDIRECT_URI = process.env['ML_REDIRECT_URI']!
const PRODUCTION_URL = 'https://gugaleo.axnexlabs.com.br'

/**
 * Handles OAuth callback from Mercado Livre
 * Following official ML OAuth 2.0 documentation
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const state = searchParams.get("state")

  // Log inicial sem expor dados sensíveis
  logger.info("[OAuth Callback] Starting OAuth callback processing", {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    errorType: error
  })

  // 1. Tratar erros do Mercado Livre
  if (error) {
    logger.warn("[OAuth Callback] OAuth error from ML", { error })
    return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=${error}`)
  }

  // 2. Validar presença do código
  if (!code) {
    logger.error("[OAuth Callback] No authorization code received")
    return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=NoCode`)
  }

  // 3. Validar state (PKCE + CSRF protection)
  if (!state) {
    logger.error("[OAuth Callback] No state parameter - possible CSRF attempt")
    await auditSecurityEvent('oauth_no_state', {}, undefined)
    return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=NoState`)
  }

  try {
    // 4. Buscar e validar OAuth state usando o manager
    const oauthState = await oauthManager.validateAndConsumeState(state)

    if (!oauthState) {
      logger.error("[OAuth Callback] Invalid or expired state", { state })
      await auditSecurityEvent('oauth_invalid_state', { state }, undefined)
      return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=InvalidState`)
    }

    const { codeVerifier, organizationId, isPrimaryLogin } = oauthState

    logger.info("[OAuth Callback] State validated", {
      isPrimaryLogin,
      hasOrganizationId: !!organizationId
    })

    // 6. Tentar buscar token do cache primeiro (caso de retry rápido)
    let tokens = await oauthManager.getCachedToken(code)

    if (!tokens) {
      logger.info("[OAuth Callback] Starting token exchange with retry logic", {
        isPrimaryLogin,
        hasCodeVerifier: !!codeVerifier
      })

      // 7. Token Exchange com retry inteligente e rate limiting
      try {
        tokens = await oauthManager.exchangeCodeForToken(
          code,
          codeVerifier,
          REDIRECT_URI
        )
      } catch (exchangeError: any) {
        logger.error("[OAuth Callback] Token exchange failed after retries", {
          error: exchangeError.message
        })

        // Mapear erro para mensagem amigável
        let errorMessage = 'Error during authentication. Please try again.'
        let errorCode = 'TokenExchange'

        if (exchangeError.message?.includes('invalid or expired')) {
          errorMessage = 'Authorization code invalid or expired. Please try again.'
          errorCode = 'InvalidGrant'
        } else if (exchangeError.message?.includes('Rate limited')) {
          errorMessage = 'Too many login attempts. Please wait a moment and try again.'
          errorCode = 'RateLimit'
        }

        return NextResponse.redirect(
          `${PRODUCTION_URL}/auth/error?error=${errorCode}&message=${encodeURIComponent(errorMessage)}`
        )
      }
    } else {
      logger.info("[OAuth Callback] Using cached token")
    }

    // 9. Validar que temos os tokens necessários
    if (!tokens || !tokens.access_token) {
      logger.error("[OAuth Callback] No access token received")
      return NextResponse.redirect(
        `${PRODUCTION_URL}/auth/error?error=NoToken&message=${encodeURIComponent('No access token received')}`
      )
    }

    logger.info("[OAuth Callback] Token exchange successful, fetching user info")

    // 10. Buscar informações do usuário
    const userResponse = await fetchWithRateLimit(
      "https://api.mercadolibre.com/users/me",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "User-Agent": "ML-Agent/1.0"
        },
      },
      'users/me'
    )

    const userResponseText = await userResponse.text()
    let user: any = {}

    try {
      user = userResponseText ? JSON.parse(userResponseText) : {}
    } catch (jsonError) {
      logger.error("[OAuth Callback] Failed to parse user response", {
        error: jsonError,
        response: userResponseText
      })
      return NextResponse.redirect(
        `${PRODUCTION_URL}/auth/error?error=InvalidUserResponse&message=${encodeURIComponent('Failed to get user information')}`
      )
    }

    if (!userResponse.ok) {
      logger.error("[OAuth Callback] Failed to fetch user info", {
        error: user,
        status: userResponse.status
      })
      return NextResponse.redirect(`${PRODUCTION_URL}/auth/error?error=UserInfo`)
    }

    // Buscar dados completos do usuário com foto de perfil
    const fullUserResponse = await fetchWithRateLimit(
      `https://api.mercadolibre.com/users/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "User-Agent": "ML-Agent/1.0"
        },
      },
      'users'
    )

    let fullUser = user
    if (fullUserResponse.ok) {
      try {
        const fullUserText = await fullUserResponse.text()
        fullUser = JSON.parse(fullUserText)
        logger.info("[OAuth Callback] Got full user data with thumbnail", {
          userId: fullUser.id,
          nickname: fullUser.nickname,
          hasThumbnail: !!fullUser.thumbnail,
          hasLogo: !!fullUser.logo
        })
      } catch (error) {
        logger.warn("[OAuth Callback] Failed to get full user data, using basic info", { error })
      }
    }

    // Extract thumbnail URL if thumbnail is an object
    let thumbnailUrl = null
    if (fullUser.thumbnail) {
      if (typeof fullUser.thumbnail === 'string') {
        thumbnailUrl = fullUser.thumbnail
      } else if (fullUser.thumbnail.picture_url) {
        thumbnailUrl = fullUser.thumbnail.picture_url
      }
    } else if (fullUser.logo) {
      thumbnailUrl = fullUser.logo
    }

    logger.info("[OAuth Callback] User authenticated successfully", {
      userId: fullUser.id,
      nickname: fullUser.nickname,
      siteId: fullUser.site_id,
      thumbnail: thumbnailUrl
    })

    // 11. Verificar se há uma organização pendente de conexão ML
    const cookieStore = await cookies()
    const pendingOrgId = cookieStore.get('pending-ml-connection')?.value
    const existingSessionToken = cookieStore.get('ml-agent-session')?.value

    if (pendingOrgId) {
      // Conectar ML account à organização que acabou de ser criada
      try {
        const mlAccountId = await addMLAccountToOrganization(
          pendingOrgId,
          fullUser.id.toString(),
          fullUser.nickname,
          fullUser.email,
          fullUser.site_id,
          {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in
          },
          thumbnailUrl,
          fullUser.permalink || null
        )

        // Atualizar a sessão existente com a conta ML
        if (existingSessionToken) {
          await prisma.session.update({
            where: { sessionToken: existingSessionToken },
            data: {
              activeMLAccountId: mlAccountId,
              updatedAt: new Date()
            }
          })
        } else {
          // Se não há sessão existente, criar uma nova
          const newSessionToken = crypto.randomUUID()
          const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

          await prisma.session.create({
            data: {
              sessionToken: newSessionToken,
              organizationId: pendingOrgId,
              activeMLAccountId: mlAccountId,
              expiresAt: sessionExpiry
            }
          })

          // Definir cookie de sessão com nome padronizado
          cookieStore.set('ml-agent-session', newSessionToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            expires: sessionExpiry
          })
        }

        // Limpar cookie temporário
        cookieStore.delete('pending-ml-connection')

        logger.info("[OAuth Callback] ML account connected to new organization", {
          organizationId: pendingOrgId,
          userId: fullUser.id,
          nickname: fullUser.nickname,
          sessionToken: existingSessionToken ? 'existing' : 'new session created'
        })

        return NextResponse.redirect(`${PRODUCTION_URL}/agente`)
      } catch (error) {
        logger.error("[OAuth Callback] Failed to connect ML account to organization", { error })
        return NextResponse.redirect(
          `${PRODUCTION_URL}/auth/error?error=MLConnection&message=${encodeURIComponent('Failed to connect ML account')}`
        )
      }
    }

    // 12. Criar sessão ou adicionar conta ML
    if (isPrimaryLogin || !organizationId) {
      // Login primário - criar nova sessão
      try {
        const session = await createSession(
          fullUser.id.toString(),
          fullUser.nickname,
          fullUser.email,
          fullUser.site_id,
          {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in
          },
          thumbnailUrl,
          fullUser.permalink || null
        )

        // Configurar cookie de sessão padronizado para produção
        cookieStore.set('ml-agent-session', session.sessionToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60, // 7 dias
          path: '/'
        })

        const duration = Date.now() - startTime
        logger.info("[OAuth Callback] Login successful", {
          duration,
          userId: fullUser.id,
          nickname: fullUser.nickname
        })

        // Redirecionar para dashboard
        return NextResponse.redirect(`${PRODUCTION_URL}/agente`)

      } catch (sessionError) {
        logger.error("[OAuth Callback] Failed to create session", { error: sessionError })
        return NextResponse.redirect(
          `${PRODUCTION_URL}/auth/error?error=SessionCreation&message=${encodeURIComponent('Failed to create session')}`
        )
      }

    } else {
      // Adicionar conta ML à organização existente
      try {
        await addMLAccountToOrganization(
          organizationId,
          fullUser.id.toString(),
          fullUser.nickname,
          fullUser.email,
          fullUser.site_id,
          {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in
          },
          thumbnailUrl,
          fullUser.permalink || null
        )

        logger.info("[OAuth Callback] ML account added to organization", {
          organizationId: organizationId,
          mlUserId: user.id,
          nickname: user.nickname
        })

        // Redirecionar para página de sucesso
        return NextResponse.redirect(
          `${PRODUCTION_URL}/auth/success/account-added?account=${encodeURIComponent(user.nickname)}`
        )

      } catch (addError: any) {
        logger.error("[OAuth Callback] Failed to add ML account", { error: addError })
        return NextResponse.redirect(
          `${PRODUCTION_URL}/auth/success/account-added?error=${encodeURIComponent(addError.message || 'Failed to add account')}`
        )
      }
    }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error("[OAuth Callback] Unexpected error", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      duration
    })

    // Limpar rate limits para permitir nova tentativa
    await oauthManager.clearRateLimits().catch(() => {})

    return NextResponse.redirect(
      `${PRODUCTION_URL}/auth/error?error=Unknown&message=${encodeURIComponent('An unexpected error occurred')}`
    )
  }
}
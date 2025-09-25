import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { oauthManager } from '@/lib/auth/oauth-manager'

const PRODUCTION_URL = 'https://gugaleo.axnexlabs.com.br'

export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    logger.info('[Logout] Starting logout process')

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("ml-agent-session")?.value

    // 1. APENAS marcar sessão como inativa, NÃO deletar tokens ML
    // Tokens continuam válidos no Mercado Livre por 6 horas
    if (sessionToken) {
      try {
        // Buscar sessão para log
        const session = await prisma.session.findUnique({
          where: { sessionToken },
          select: { organizationId: true }
        })

        // Deletar apenas a sessão local, mantendo MLAccounts intactos
        const deletedSession = await prisma.session.deleteMany({
          where: { sessionToken }
        })

        logger.info('[Logout] Session cleared, ML tokens preserved', {
          organizationId: session?.organizationId,
          deleted: deletedSession.count,
          note: 'ML tokens remain valid for reuse'
        })
      } catch (dbError) {
        logger.warn('[Logout] Failed to clear session', { error: dbError })
      }
    }

    // 2. Limpar TODOS os OAuth states relacionados
    try {
      const cleanupResult = await prisma.oAuthState.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } }, // Expirados
            { createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } } // Mais de 30 minutos
          ]
        }
      })

      logger.info('[Logout] OAuth states cleaned', {
        deleted: cleanupResult.count
      })
    } catch (cleanupError) {
      logger.warn('[Logout] Failed to cleanup OAuth states', { error: cleanupError })
    }

    // 3. Limpar cache de rate limiting e tokens do OAuth Manager
    try {
      await oauthManager.clearRateLimits()
      logger.info('[Logout] OAuth rate limits and cache cleared')
    } catch (cacheError) {
      logger.warn('[Logout] Failed to clear OAuth cache', { error: cacheError })
    }

    // 4. Criar resposta com redirecionamento
    // SEMPRE usar URL absoluta em produção para evitar problemas
    let redirectUrl: string

    if (process.env.NODE_ENV === 'production') {
      redirectUrl = `${PRODUCTION_URL}/login`
    } else {
      // Em desenvolvimento, usar URL relativa
      const url = new URL(request.url)
      redirectUrl = `${url.origin}/login`
    }

    const response = NextResponse.redirect(redirectUrl)

    // Definir cookie indicando logout explícito
    // Este cookie previne auto-login imediato
    response.cookies.set({
      name: 'ml-explicit-logout',
      value: 'true',
      maxAge: 60, // Expira em 1 minuto
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true
    })

    // 5. Limpar TODOS os cookies relacionados de forma mais robusta
    const cookiesToClear = [
      'ml-agent-session', // Cookie principal
      'ml-agent-csrf',
      'ml-agent-temp',
      'ml-explicit-logout',
      'session-token', // Limpar cookie antigo se existir
      'next-auth.csrf-token',
      'next-auth.session-token',
      '__Secure-next-auth.session-token'
    ]

    for (const cookieName of cookiesToClear) {
      // Limpar com maxAge 0
      response.cookies.set({
        name: cookieName,
        value: '',
        maxAge: 0,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true
      })

      // Também deletar explicitamente
      response.cookies.delete(cookieName)
    }

    // 6. Adicionar headers de cache control
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    const duration = Date.now() - startTime
    logger.info('[Logout] Logout completed successfully', {
      duration,
      redirectTo: redirectUrl
    })

    return response

  } catch (error) {
    logger.error('[Logout] Critical error during logout', {
      error,
      stack: error instanceof Error ? error.stack : undefined
    })

    // Em caso de erro crítico, ainda assim tentar limpar cookies e redirecionar
    try {
      let fallbackUrl = `${PRODUCTION_URL}/login`

      if (process.env.NODE_ENV !== 'production') {
        const url = new URL(request.url)
        fallbackUrl = `${url.origin}/login`
      }

      const response = NextResponse.redirect(fallbackUrl)

      // Limpar pelo menos o cookie principal
      response.cookies.set({
        name: 'ml-agent-session',
        value: '',
        maxAge: 0,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true
      })

      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')

      return response

    } catch (fallbackError) {
      logger.error('[Logout] Even fallback failed', { error: fallbackError })

      // Última tentativa - redirect simples
      return NextResponse.redirect(`${PRODUCTION_URL}/login`)
    }
  }
}

export async function POST(_request: Request) {
  // POST endpoint for API calls (returns JSON)
  logger.info('[Logout] POST request received')

  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("ml-agent-session")?.value

    // Deletar sessão se existir
    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { sessionToken }
      })
    }

    // Limpar rate limits
    await oauthManager.clearRateLimits().catch(() => {})

    // Criar response JSON
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    // Definir cookie de logout explícito
    response.cookies.set({
      name: 'ml-explicit-logout',
      value: 'true',
      maxAge: 60,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true
    })

    // Limpar cookies de sessão
    const cookiesToClear = [
      'ml-agent-session',
      'ml-agent-csrf',
      'ml-agent-temp',
      'session-token' // Limpar cookie antigo se existir
    ]

    for (const cookieName of cookiesToClear) {
      response.cookies.set({
        name: cookieName,
        value: '',
        maxAge: 0,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true
      })
    }

    logger.info('[Logout] POST logout completed successfully')
    return response

  } catch (error) {
    logger.error('[Logout] POST logout error', { error })
    return NextResponse.json({
      success: false,
      error: 'Logout failed'
    }, { status: 500 })
  }
}

// Endpoint adicional para verificar status de logout
export async function DELETE(_request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("ml-agent-session")?.value

    if (!sessionToken) {
      return NextResponse.json({
        success: true,
        message: 'No active session'
      })
    }

    // Forçar limpeza completa
    await prisma.session.deleteMany({
      where: { sessionToken }
    })

    await oauthManager.clearRateLimits()

    return NextResponse.json({
      success: true,
      message: 'Session terminated'
    })

  } catch (error) {
    logger.error('[Logout] DELETE endpoint error', { error })
    return NextResponse.json({
      success: false,
      error: 'Failed to terminate session'
    }, { status: 500 })
  }
}
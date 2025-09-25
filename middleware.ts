import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const response = NextResponse.next()
  
  // Security headers básicos
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  // Content Security Policy com suporte para Google Fonts, SSE e WebSocket
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self' https://api.mercadolibre.com https://mla-s1-p.mlstatic.com https://*.mlstatic.com; " +
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "img-src 'self' data: blob: https://*.mlstatic.com https://mla-s1-p.mlstatic.com; " +
    "connect-src 'self' https://api.mercadolibre.com https://gugaleo.axnexlabs.com.br wss://gugaleo.axnexlabs.com.br:3008 ws://gugaleo.axnexlabs.com.br:3008 ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*"
  )

  // Headers especiais para SSE - CRÍTICO para funcionamento correto
  if (pathname.startsWith('/api/agent/events')) {
    console.log('[Middleware] 🎯 SSE route detected, applying special headers:', pathname)

    // SSE com token query param não precisa de cookie check
    const searchParams = request.nextUrl.searchParams
    if (searchParams.has('token')) {
      console.log('[Middleware] SSE with token query param, bypassing cookie auth')
      // Não fazer nada com auth, deixar o endpoint validar o token
    }

    response.headers.set('X-Accel-Buffering', 'no')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Connection', 'keep-alive')
    response.headers.set('X-Content-Type-Options', 'nosniff')

    // Permitir CORS para SSE se necessário
    const origin = request.headers.get('origin')
    if (origin && origin.includes('gugaleo.axnexlabs.com.br')) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }
  }
  
  // Validação de webhook ML (sem dependências complexas)
  if (pathname.startsWith("/api/ml-webhook") || pathname.startsWith("/api/webhooks")) {
    // IMPORTANTE: SEMPRE usar X-Real-IP que vem do nginx corretamente
    const realIpHeader = request.headers.get('x-real-ip')
    const forwardedFor = request.headers.get('x-forwarded-for')
    
    // Pegar o IP correto - nginx seta X-Real-IP com o IP real do cliente
    let realIp = realIpHeader || 'unknown'
    
    // Se não tem X-Real-IP, pegar o primeiro IP de X-Forwarded-For
    if (!realIpHeader && forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim())
      realIp = ips[0] || 'unknown'
    }
    
    // IPs oficiais do Mercado Livre (atualizados 02/09/2025)
    const allowedIPs = [
      '54.88.218.97',
      '18.215.140.160',
      '18.210.79.49',
      '34.237.96.70',
      '52.4.152.221',
      '18.213.235.122',
      '34.199.3.143',
      '3.211.188.35',
      '18.206.34.84',    // IP ativo do ML
      '18.213.114.129'   // IP ativo do ML
    ]
    
    console.log(`[Webhook] Checking IP: ${realIp} from x-real-ip: ${realIpHeader}, x-forwarded-for: ${forwardedFor}`)
    
    if (!allowedIPs.includes(realIp) && !realIp.startsWith('127.') && !realIp.startsWith('::1')) {
      console.warn(`[Webhook] Blocked request from IP: ${realIp}`)
      return NextResponse.json(
        { error: "Forbidden - Invalid source IP" },
        { status: 403 }
      )
    }
    
    console.log(`[Webhook] Allowed IP: ${realIp}`)
  }
  
  // Rate limiting DESATIVADO - conforme solicitação do usuário
  // NAO DEVEMOS TER RATE LIMIT EM NOSSA PLATAFORMA
  // Mantemos o código comentado para referência futura se necessário
  /*
  if (pathname.startsWith("/api")) {
    const clientId = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const now = Date.now()
    const windowMs = 60000 // 1 minuto
    const maxRequests = 500  // 500 requisições por minuto - suporta múltiplas contas e SSE

    const rateLimit = rateLimitMap.get(clientId)

    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      })
    } else if (rateLimit.count >= maxRequests) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime - now) / 1000))
          }
        }
      )
    } else {
      rateLimit.count++
    }

    // Limpar entradas antigas do mapa (evitar memory leak)
    if (rateLimitMap.size > 1000) {
      const entries = Array.from(rateLimitMap.entries())
      const expired = entries.filter(([_, data]) => now > data.resetTime)
      expired.forEach(([key]) => rateLimitMap.delete(key))
    }
  }
  */
  
  // Public routes - permitir acesso sem autenticação
  const publicPaths = [
    '/login',
    '/auth',
    '/api/auth',
    '/api/public',
    '/api/ml-webhook',
    '/api/webhooks',
    '/api/n8n',  // IMPORTANTE: N8N precisa acessar sem auth
    '/api/health',
    '/api/agent/monitor-stuck-questions',
    '/api/agent/reprocess-question',  // Endpoint autônomo - usa dados da pergunta
    '/answer',  // Página de resposta com link único
    '/api/answer',  // APIs de resposta com link único
    '/approve',  // Página de aprovação
    '/api/secure/approve-with-token',  // Aprovação com token único
    '/_next',
    '/favicon.ico',
    '/mlagent-logo-3d.svg',
    '/ml-agent-icon.png',
    '/logo.png',
    '/.well-known',
    '/robots.txt',
    '/sitemap.xml'
  ]
  
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  
  // Verificar autenticação para rotas protegidas
  if (!isPublicPath) {
    // SSE com token não precisa de cookie
    if (pathname.startsWith('/api/agent/events') && request.nextUrl.searchParams.has('token')) {
      console.log('[Middleware] SSE endpoint with token, skipping cookie auth')
      // Não redirecionar, deixar passar para o endpoint validar o token
    } else {
      // Cookie padronizado para produção
      const sessionToken = request.cookies.get('ml-agent-session')?.value

      // Se não tem sessão, redirecionar para login
      if (!sessionToken && pathname !== '/') {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }
    }
  }
  
  // Redirect root to agente if authenticated, login if not
  if (pathname === "/") {
    // Cookie padronizado para produção
    const sessionToken = request.cookies.get('ml-agent-session')?.value

    if (sessionToken) {
      return NextResponse.redirect(new URL("/agente", request.url))
    } else {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$).*)",
    "/api/:path*"
  ]
}
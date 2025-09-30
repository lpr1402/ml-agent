/**
 * Redirecionamento Universal para o App PWA
 * Abre direto no app instalado ou no navegador
 * Mantém sessão persistente
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export async function GET(req: NextRequest) {
  const org = req.nextUrl.searchParams.get('org')
  const page = req.nextUrl.searchParams.get('page') || 'agente'
  const token = req.nextUrl.searchParams.get('token') // Token de sessão opcional

  const userAgent = req.headers.get('user-agent') || ''
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const isAndroid = /Android/i.test(userAgent)
  const isFromWhatsApp = /WhatsApp/i.test(userAgent)

  logger.info('[AppRedirect] Deep link accessed', {
    org,
    page,
    isIOS,
    isAndroid,
    isFromWhatsApp
  })

  // URL de destino
  const targetPage = `/${page}`
  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'
  const fullUrl = new URL(targetPage, baseUrl)

  // Se tiver token de sessão, criar cookie de sessão persistente
  if (token && org) {
    try {
      // Validar e decodificar token
      const secret = process.env['JWT_SECRET'] || process.env['NEXTAUTH_SECRET'] || 'default-secret'
      const decoded = jwt.verify(token, secret) as any

      if (decoded.organizationId === org) {
        // Criar cookie de sessão persistente (30 dias)
        const cookieStore = await cookies()

        // Cookie para manter sessão
        cookieStore.set('ml-agent-session', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60, // 30 dias
          path: '/'
        })

        // Cookie para identificar organização
        cookieStore.set('ml-agent-org', org, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60, // 30 dias
          path: '/'
        })

        logger.info('[AppRedirect] Session cookie set for organization', { org })
      }
    } catch (error) {
      logger.error('[AppRedirect] Invalid session token', { error })
    }
  }

  // SEMPRE mostrar página de loading profissional para mobile (iOS especialmente)
  if (isIOS || isAndroid) {
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
      <title>Redirecionando para ML Agent...</title>
      <link rel="apple-touch-icon" href="/apple-touch-icon.png">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #000000;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          flex-direction: column;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        /* Efeito de fundo sutil */
        .bg-effect {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(255, 230, 0, 0.1) 0%, transparent 70%);
          border-radius: 50%;
          animation: pulse 3s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
        }

        .container {
          position: relative;
          z-index: 10;
          text-align: center;
          max-width: 400px;
        }

        .logo {
          width: 120px;
          height: 120px;
          margin: 0 auto 30px;
          filter: drop-shadow(0 0 30px rgba(255, 230, 0, 0.4));
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid rgba(255, 230, 0, 0.1);
          border-top: 4px solid #FFE600;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 30px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #FFE600 0%, #FFC700 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: fadeInUp 0.6s ease;
        }

        .subtitle {
          color: #999;
          font-size: 16px;
          margin-bottom: 40px;
          animation: fadeInUp 0.8s ease;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .status-text {
          color: #FFE600;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
          animation: fadeInUp 1s ease;
        }

        .dots {
          display: inline-block;
          animation: dots 1.5s infinite;
        }

        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }

        .fallback-button {
          display: inline-block;
          margin-top: 40px;
          padding: 16px 36px;
          background: linear-gradient(135deg, #FFE600, #FFC700);
          color: #000;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          text-decoration: none;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(255, 230, 0, 0.3);
          opacity: 0;
          animation: fadeIn 0.5s ease forwards;
          animation-delay: 3s;
        }

        .fallback-button:active {
          transform: translateY(2px);
          box-shadow: 0 4px 12px rgba(255, 230, 0, 0.4);
        }

        @keyframes fadeIn {
          to { opacity: 1; }
        }

        .install-note {
          margin-top: 30px;
          padding: 16px;
          background: rgba(255, 230, 0, 0.05);
          border: 1px solid rgba(255, 230, 0, 0.2);
          border-radius: 12px;
          font-size: 13px;
          color: #999;
          line-height: 1.6;
          opacity: 0;
          animation: fadeIn 0.5s ease forwards;
          animation-delay: 5s;
          display: none;
        }

        .install-note.show {
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="bg-effect"></div>

      <div class="container">
        <img src="/mlagent-logo-3d.png" alt="ML Agent" class="logo">
        <div class="loading-spinner"></div>
        <h1>ML Agent</h1>
        <div class="subtitle">Redirecionando<span class="dots">...</span></div>
        <div class="status-text" id="statusText">Abrindo aplicativo</div>

        <a href="${fullUrl}" class="fallback-button" id="openBtn">
          Abrir no Navegador
        </a>

        <div class="install-note" id="installNote">
          💡 <strong>Dica:</strong> ${isIOS
            ? 'Adicione o ML Agent à tela inicial para acesso mais rápido. Toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela Inicial</strong>'
            : 'Instale o app ML Agent para acesso instantâneo. Toque nos <strong>3 pontos</strong> → <strong>Adicionar à tela inicial</strong>'}
        </div>
      </div>

      <script>
        const targetUrl = '${fullUrl}';
        const isIOS = ${isIOS};
        const isAndroid = ${isAndroid};
        const fromWhatsApp = ${isFromWhatsApp};
        let appOpened = false;
        let attemptCount = 0;

        console.log('[Deep Link] Starting redirect...', { isIOS, isAndroid, fromWhatsApp, targetUrl });

        // Detectar se já está no PWA standalone
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                            window.navigator.standalone === true;

        if (isStandalone) {
          console.log('[Deep Link] Already in standalone mode, direct redirect');
          window.location.replace(targetUrl);
        } else {
          // iOS: Tentar abrir com Universal Link + Custom URL Scheme
          if (isIOS) {
            console.log('[Deep Link] Attempting iOS deep link...');

            // Método 1: Universal Link (funciona se app instalado)
            const universalLink = 'https://gugaleo.axnexlabs.com.br/agente';

            // Método 2: Custom URL Scheme
            const customScheme = 'mlagent://agente';

            // Método 3: web+mlagent protocol
            const webProtocol = 'web+mlagent:agente';

            // Tentar Universal Link primeiro
            attemptDeepLink(universalLink, () => {
              console.log('[Deep Link] Universal link attempt...');
              attemptCount++;

              // Se falhou, tentar Custom Scheme
              setTimeout(() => {
                if (!appOpened && attemptCount === 1) {
                  attemptDeepLink(customScheme, () => {
                    console.log('[Deep Link] Custom scheme attempt...');
                    attemptCount++;

                    // Se falhou novamente, tentar web protocol
                    setTimeout(() => {
                      if (!appOpened && attemptCount === 2) {
                        attemptDeepLink(webProtocol, () => {
                          console.log('[Deep Link] Web protocol attempt...');
                          attemptCount++;

                          // Após todas tentativas, mostrar fallback
                          setTimeout(() => {
                            if (!appOpened) {
                              showFallback();
                            }
                          }, 1000);
                        });
                      }
                    }, 500);
                  });
                }
              }, 500);
            });
          }
          // Android: Deep link mais direto
          else if (isAndroid) {
            console.log('[Deep Link] Attempting Android deep link...');
            const androidIntent = 'intent://agente#Intent;scheme=mlagent;package=br.com.axnexlabs.mlagent;end';
            attemptDeepLink(androidIntent, () => {
              setTimeout(() => {
                if (!appOpened) {
                  showFallback();
                }
              }, 2000);
            });
          }
          // Desktop ou outros
          else {
            console.log('[Deep Link] Desktop detected, immediate redirect');
            setTimeout(() => window.location.replace(targetUrl), 500);
          }
        }

        function attemptDeepLink(url, onAttempt) {
          // Criar link invisível e clicar
          const link = document.createElement('a');
          link.href = url;
          link.style.display = 'none';
          document.body.appendChild(link);

          // Tentar abrir
          setTimeout(() => {
            link.click();
            if (onAttempt) onAttempt();

            // Limpar
            setTimeout(() => {
              document.body.removeChild(link);
            }, 100);
          }, 100);
        }

        function showFallback() {
          console.log('[Deep Link] Showing fallback options');
          document.getElementById('statusText').textContent = 'App não instalado ou não abriu';
          document.getElementById('installNote').classList.add('show');

          // Auto-redirect após 8 segundos
          setTimeout(() => {
            if (!appOpened) {
              console.log('[Deep Link] Auto-redirecting to web app');
              window.location.replace(targetUrl);
            }
          }, 8000);
        }

        // Detectar se app foi aberto (usuário saiu da página)
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            console.log('[Deep Link] App opened successfully!');
            appOpened = true;
          }
        });

        window.addEventListener('blur', () => {
          console.log('[Deep Link] Window blur - app may have opened');
          appOpened = true;
        });

        window.addEventListener('pagehide', () => {
          console.log('[Deep Link] Page hide - app opened');
          appOpened = true;
        });

        // Garantir que sempre redireciona em último caso
        setTimeout(() => {
          if (!appOpened && !document.hidden) {
            console.log('[Deep Link] Final fallback redirect');
            window.location.replace(targetUrl);
          }
        }, 10000);
      </script>
    </body>
    </html>
    `

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Robots-Tag': 'noindex, nofollow',
      }
    })
  }

  // Para desktop, redirecionar direto
  return NextResponse.redirect(fullUrl)
}
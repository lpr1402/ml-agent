/**
 * Redirecionamento Inteligente para Links de Aprovação
 * Detecta se o PWA está instalado e redireciona apropriadamente
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const userAgent = req.headers.get('user-agent') || ''
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const isAndroid = /Android/i.test(userAgent)
  const isFromWhatsApp = /WhatsApp/i.test(userAgent)

  logger.info('[Redirect] Answer link accessed', {
    token: token.substring(0, 8),
    isIOS,
    isAndroid,
    isFromWhatsApp
  })

  // URL de destino
  const targetUrl = `/answer/${token}`
  const fullUrl = new URL(targetUrl, req.url)

  // Se for iOS e vindo do WhatsApp, tentar abrir no PWA primeiro
  if (isIOS && isFromWhatsApp) {
    // Criar HTML com redirecionamento inteligente
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ML Agent - Abrindo...</title>
      <meta name="apple-mobile-web-app-capable" content="yes">
      <style>
        body {
          margin: 0;
          padding: 0;
          background: #000;
          color: #fff;
          font-family: -apple-system, system-ui, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          flex-direction: column;
        }
        .logo {
          width: 80px;
          height: 80px;
          margin-bottom: 20px;
        }
        .loading {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 230, 0, 0.1);
          border-top-color: #FFE600;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .text {
          margin-top: 20px;
          font-size: 14px;
          color: #888;
        }
        .button {
          margin-top: 30px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #FFE600, #FFC700);
          color: #000;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          text-decoration: none;
          display: none;
        }
      </style>
    </head>
    <body>
      <img src="/mlagent-logo-3d.svg" alt="ML Agent" class="logo">
      <div class="loading"></div>
      <div class="text">Abrindo ML Agent...</div>
      <a href="${fullUrl}" class="button" id="openBtn">Abrir no Navegador</a>

      <script>
        // Tentar abrir no PWA instalado
        const token = '${token}';
        const targetUrl = '${fullUrl}';

        // Método 1: URL Scheme customizado (se configurado)
        const customScheme = 'mlagent://answer/' + token;

        // Método 2: Web+protocol
        const webProtocol = 'web+mlagent:answer/' + token;

        // Método 3: Universal Link direto
        const universalLink = targetUrl;

        let redirected = false;

        // Tentar URL scheme primeiro (mais confiável no iOS)
        function tryCustomScheme() {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = customScheme;
          document.body.appendChild(iframe);

          setTimeout(() => {
            document.body.removeChild(iframe);
            if (!redirected) {
              tryWebProtocol();
            }
          }, 1000);
        }

        // Tentar web protocol
        function tryWebProtocol() {
          window.location.href = webProtocol;

          setTimeout(() => {
            if (!redirected) {
              // Fallback para o link direto
              window.location.href = universalLink;
            }
          }, 1500);
        }

        // Detectar se conseguiu abrir o app
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            redirected = true;
          }
        });

        // Mostrar botão após 3 segundos se não redirecionar
        setTimeout(() => {
          if (!redirected) {
            document.getElementById('openBtn').style.display = 'inline-block';
          }
        }, 3000);

        // Iniciar tentativas
        tryCustomScheme();

        // Se o usuário voltar, redirecionar para o link normal
        window.addEventListener('focus', () => {
          if (!redirected) {
            setTimeout(() => {
              window.location.href = universalLink;
            }, 100);
          }
        });
      </script>
    </body>
    </html>
    `

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      }
    })
  }

  // Para outros casos, redirecionar direto
  return NextResponse.redirect(fullUrl)
}
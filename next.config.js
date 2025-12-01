/** @type {import('next').NextConfig} */

/**
 * Next.js 16 Configuration - Production & Development Optimized
 * - Turbopack stable (default bundler in Next.js 16)
 * - React 19.2 with Activity, useEffectEvent, Performance Tracks
 * - Optimized for hot reload in development
 * - Production-ready security headers
 */

// Aumentar limite de listeners para evitar warnings em produção
// 50 listeners para suportar múltiplos workers PM2, WebSocket connections e build process
if (typeof process !== 'undefined' && process.setMaxListeners) {
  process.setMaxListeners(50)

  // Cleanup on exit to prevent memory leaks
  if (process.removeAllListeners && process.once) {
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
      try {
        process.removeAllListeners(signal)
        process.once(signal, () => {
          process.exit(0)
        })
      } catch (e) {
        // Ignore errors during cleanup
      }
    })
  }
}

const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  reactStrictMode: true,

  // 🚀 Next.js 16 - Turbopack é estável e padrão
  // Não precisa mais do experimental.turbo - é automático

  // Headers de segurança - Dinâmicos baseado no ambiente
  async headers() {
    // Headers permissivos para desenvolvimento (hot reload via Nginx)
    if (isDev) {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self' https://gugaleo.axnexlabs.com.br",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://gugaleo.axnexlabs.com.br",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https: http: *.mlstatic.com api.dicebear.com",
                "connect-src 'self' https://gugaleo.axnexlabs.com.br wss://gugaleo.axnexlabs.com.br https://api.mercadolibre.com https://api.mercadolivre.com.br",
                "worker-src 'self' blob:"
              ].join('; ')
            }
          ]
        }
      ]
    }

    // Headers de segurança - PRODUCTION READY (sem unsafe-eval)
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            // SECURE CSP - No unsafe-eval! Only unsafe-inline for styles (required by Tailwind/Framer Motion)
            value: [
              "default-src 'self' https://gugaleo.axnexlabs.com.br",
              "script-src 'self' 'unsafe-inline' https://gugaleo.axnexlabs.com.br",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: http2.mlstatic.com *.mlstatic.com api.dicebear.com",
              "font-src 'self' data:",
              "connect-src 'self' https://gugaleo.axnexlabs.com.br https://api.mercadolibre.com https://api.mercadolivre.com.br wss://gugaleo.axnexlabs.com.br",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests"
            ].join('; ')
          }
        ]
      }
    ]
  },
  
  // Configurações de produção - Image Optimization
  images: {
    // Modern remotePatterns (replaces domains)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.mlstatic.com'
      },
      {
        protocol: 'https',
        hostname: 'perfil.mercadolivre.com.br'
      },
      {
        protocol: 'https',
        hostname: 'api.mercadolibre.com'
      },
      {
        protocol: 'https',
        hostname: 'api.mercadolivre.com.br'
      },
      {
        protocol: 'https',
        hostname: 'gugaleo.axnexlabs.com.br'
      },
      {
        // DiceBear Avatars for gamification characters
        protocol: 'https',
        hostname: 'api.dicebear.com'
      }
    ],
    // Force HTTPS loader for all external images
    loader: 'default',
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Optimize image loading
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },
  
  // Variáveis de ambiente públicas - SEMPRE domínio de produção
  // Acesso via https://gugaleo.axnexlabs.com.br em dev e produção
  env: {
    NEXT_PUBLIC_APP_URL: 'https://gugaleo.axnexlabs.com.br',
    NEXT_PUBLIC_API_URL: 'https://gugaleo.axnexlabs.com.br/api',
    NEXT_PUBLIC_WS_URL: 'wss://gugaleo.axnexlabs.com.br:3008',
    NEXT_PUBLIC_DOMAIN: 'gugaleo.axnexlabs.com.br'
  },
  
  // Server Actions - Sempre domínio de produção
  experimental: {
    serverActions: {
      allowedOrigins: ['gugaleo.axnexlabs.com.br', 'https://gugaleo.axnexlabs.com.br'],
      bodySizeLimit: isDev ? '5mb' : '2mb' // Maior em dev para debugging
    }
    // 🚀 Next.js 16: cacheComponents conflita com route configs (dynamic, revalidate)
    // Desabilitado para manter compatibilidade com API routes existentes
  },

  // 🚀 Turbopack (stable in Next.js 16) - Configuração otimizada
  turbopack: {
    resolveAlias: {
      '@prisma/client$': require.resolve('@prisma/client'),
      'prisma$': require.resolve('@prisma/client')
    }
  },
  
  // Dev origins - Sempre domínio de produção
  allowedDevOrigins: ['https://gugaleo.axnexlabs.com.br'],

  // Otimizações - Dinâmicas por ambiente
  compress: !isDev, // Desabilitar compressão em dev para velocidade
  poweredByHeader: false,
  productionBrowserSourceMaps: isDev, // Source maps apenas em dev
  
  // Server-only packages (não bundlar)
  serverExternalPackages: ['bull', '@prisma/client', 'prisma'],

  // Webpack config - Otimizado para desenvolvimento e produção
  webpack: (config, { dev, isServer }) => {
    // Fallbacks para módulos Node.js no browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        zlib: false,
        http: false,
        https: false,
        os: false
      }
    }

    // Aliases para evitar duplicação do Prisma
    config.resolve.alias = {
      ...config.resolve.alias,
      '@prisma/client$': require.resolve('@prisma/client'),
      'prisma$': require.resolve('@prisma/client')
    }

    // 🔥 HOT RELOAD OTIMIZAÇÕES para desenvolvimento
    if (dev) {
      // Aumentar limite de arquivos observados
      config.watchOptions = {
        poll: false, // Usar eventos nativos (mais rápido que polling)
        aggregateTimeout: 300, // Debounce de 300ms (balance entre velocidade e CPU)
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/logs/**',
          '**/.next/**',
          '**/dist/**'
        ]
      }

      // Otimizar cache em desenvolvimento (Next.js 16)
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename]
        },
        // Cache mais agressivo em dev
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 dias
      }
    }

    return config
  },

  // 🚀 Fast Refresh - Otimizado para Next.js 16
  onDemandEntries: isDev ? {
    maxInactiveAge: 60 * 1000, // 1 minuto em cache
    pagesBufferLength: 5 // Máximo de 5 páginas simultâneas
  } : undefined
}

module.exports = nextConfig
/** @type {import('next').NextConfig} */

// PWA plugin REMOVIDO - usamos service worker manual em public/sw.js
// O plugin estava desabilitado (disable: true) e causando problemas de instalabilidade

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

const nextConfig = {
  reactStrictMode: true,
  
  // Headers de segurança
  async headers() {
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
            key: 'Content-Security-Policy',
            value: "default-src 'self' https://gugaleo.axnexlabs.com.br https://*.mercadolibre.com https://*.mercadolibre.com.br https://*.mercadolibre.com.ar; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ]
  },
  
  // Configurações de produção
  images: {
    domains: [
      'http2.mlstatic.com',
      'mlb-s2-p.mlstatic.com',
      'mlb-s1-p.mlstatic.com',
      'mlb-s3-p.mlstatic.com',
      'secure.mlstatic.com',
      'mla-s2-p.mlstatic.com',
      'mlm-s2-p.mlstatic.com',
      'perfil.mercadolivre.com.br',
      'api.mercadolibre.com',
      'api.mercadolivre.com.br',
      'gugaleo.axnexlabs.com.br'
    ]
  },
  
  // Variáveis de ambiente públicas
  env: {
    NEXT_PUBLIC_APP_URL: 'https://gugaleo.axnexlabs.com.br',
    NEXT_PUBLIC_API_URL: 'https://gugaleo.axnexlabs.com.br/api',
    NEXT_PUBLIC_DOMAIN: 'gugaleo.axnexlabs.com.br'
  },
  
  // Configurações experimentais
  experimental: {
    serverActions: {
      allowedOrigins: ['gugaleo.axnexlabs.com.br', 'https://gugaleo.axnexlabs.com.br'],
      bodySizeLimit: '2mb'
    }
  },
  
  // Turbopack configuration (now stable)
  turbopack: {
    resolveAlias: {
      '@prisma/client$': require.resolve('@prisma/client'),
      'prisma$': require.resolve('@prisma/client')
    }
  },
  
  // Dev origins for cross-origin requests
  allowedDevOrigins: ['https://gugaleo.axnexlabs.com.br', 'http://localhost:3007'],
  
  // Otimizações para produção - SINGLE TENANT
  // output: 'standalone', // REMOVIDO: Conflito com PM2 npm start
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  
  // Webpack config mínimo - apenas o essencial
  webpack: (config, { isServer }) => {
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
    
    return config
  }
}

module.exports = nextConfig
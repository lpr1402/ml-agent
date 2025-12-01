import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthWrapper } from "@/components/auth-wrapper";
import { PWAInitializer } from "@/components/pwa-initializer";
import { IOSPWAHandler } from "@/components/ios-pwa-handler";
import { ErrorBoundary } from "@/components/error-boundary";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

/**
 * iOS PWA 2025 - Viewport Configuration
 * - viewport-fit: cover = fullscreen no iOS (cobre safe areas)
 * - userScalable: false = previne zoom acidental
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
  colorScheme: 'dark',
};

/**
 * iOS PWA 2025 - Metadata Configuration
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://gugaleo.axnexlabs.com.br'),
  title: {
    default: 'ML Agent',
    template: '%s | ML Agent'
  },
  description: "Automação inteligente para vendedores do Mercado Livre",
  manifest: '/manifest.json',
  applicationName: 'ML Agent',

  // Favicons para browser (aba do navegador)
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    // Apple Touch Icons - para iOS home screen
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // iOS PWA Configuration
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ML Agent',
  },

  // Desabilitar detecção automática de telefone
  formatDetection: {
    telephone: false,
  },

  // Open Graph
  openGraph: {
    type: 'website',
    siteName: 'ML Agent',
    title: 'ML Agent',
    description: 'Automação inteligente para vendedores do Mercado Livre',
    images: ['/icons/icon-512x512.png'],
  },

  // Outras meta tags importantes
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'ML Agent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={plusJakarta.variable}>
      <head>
        {/* ========================================
            iOS PWA 2025 - CONFIGURAÇÃO COMPLETA
            ======================================== */}

        {/* 1. PWA Capability - CRÍTICO para iOS */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ML Agent" />

        {/* 2. Favicons do Browser (aba do navegador) */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />

        {/* 3. Apple Touch Icons - Ícone da Home Screen iOS */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/ios-icon-167.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/ios-icon-152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/ios-icon-120.png" />

        {/* 4. Script de Redirecionamento iOS PWA */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // Detectar iOS PWA standalone
            var isStandalone = window.navigator.standalone === true ||
                              window.matchMedia('(display-mode: standalone)').matches;
            var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
            var pathname = window.location.pathname;

            // iOS PWA: Redirecionar para /agente se estiver em standalone
            if (isIOS && isStandalone) {
              var allowedPaths = ['/agente', '/answer/', '/approve/', '/auth/'];
              var isAllowed = allowedPaths.some(function(p) {
                return pathname.startsWith(p);
              });
              var isAsset = pathname.startsWith('/api/') ||
                           pathname.startsWith('/_next/') ||
                           /\\.(js|css|png|jpg|svg|ico|json)$/.test(pathname);

              if (!isAllowed && !isAsset && pathname !== '/') {
                window.location.replace('/agente');
              } else if (pathname === '/' || pathname === '/login') {
                window.location.replace('/agente');
              }
            }
          })();
        `}} />
      </head>
      <body className={`${plusJakarta.className} antialiased font-sans bg-black`}>
        <ErrorBoundary>
          <AuthProvider>
            <AuthWrapper>
              <Providers>{children}</Providers>
              <PWAInitializer />
              <IOSPWAHandler />
            </AuthWrapper>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

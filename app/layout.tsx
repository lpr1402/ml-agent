import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthWrapper } from "@/components/auth-wrapper";
import { PWAInitializer } from "@/components/pwa-initializer";
import { IOSPWAHandler } from "@/components/ios-pwa-handler";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // iOS PWA: Prevenir zoom que pode quebrar fullscreen
  minimumScale: 1,
  userScalable: false, // iOS PWA: Desabilitar zoom para manter fullscreen
  themeColor: '#000000',
  viewportFit: 'cover',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://gugaleo.axnexlabs.com.br'),
  title: {
    default: 'ML Agent',
    template: '%s | ML Agent'
  },
  description: "Automação inteligente para vendedores do Mercado Livre com notificações push 24/7",
  manifest: '/manifest.json',
  applicationName: 'ML Agent',
  authors: [{ name: 'AxnexLabs' }],
  generator: 'Next.js',
  keywords: ['mercado livre', 'automação', 'vendas', 'ml agent', 'perguntas'],
  referrer: 'origin-when-cross-origin',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://gugaleo.axnexlabs.com.br/agente'
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
      { url: '/icons/ios-icon-152.png', sizes: '152x152' },
      { url: '/icons/ios-icon-120.png', sizes: '120x120' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ML Agent',
    startupImage: [
      // iPhone 14/15 Pro Max
      {
        url: '/splash/splash-1290x2796.png',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone 14/15 Pro
      {
        url: '/splash/splash-1179x2556.png',
        media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone 13/12 Pro Max
      {
        url: '/splash/splash-1284x2778.png',
        media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone 13/12/11 Pro, X, XS
      {
        url: '/splash/splash-1125x2436.png',
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone 11, XR
      {
        url: '/splash/splash-828x1792.png',
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
      },
      // iPad Pro 12.9"
      {
        url: '/splash/splash-2048x2732.png',
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
      },
      // iPad Pro 11"
      {
        url: '/splash/splash-1668x2388.png',
        media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
      },
      // iPad 10.5"
      {
        url: '/splash/splash-1668x2224.png',
        media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)',
      },
      // iPad Mini, Air
      {
        url: '/splash/splash-1536x2048.png',
        media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'ML Agent Pro',
    title: 'ML Agent',
    description: 'Plataforma premium de automação para vendedores do Mercado Livre com notificações 24/7',
    images: ['/icons/icon-512x512.png'],
  },
  twitter: {
    card: 'summary',
    title: 'ML Agent Pro',
    description: 'Plataforma para vendedores do Mercado Livre',
    images: ['/icons/icon-512x512.png'],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'ML Agent',
    'apple-mobile-web-app-orientations': 'portrait-any',
    'application-name': 'ML Agent',
    'msapplication-TileColor': '#000000',
    'msapplication-TileImage': '/icons/icon-144x144.png',
    'msapplication-config': 'none',
    'msapplication-tap-highlight': 'no',
    'msapplication-navbutton-color': '#000000',
    'msapplication-starturl': '/',
    'msapplication-tooltip': 'ML Agent - Automação para Mercado Livre',
    'msapplication-window': 'width=1024;height=768',
    'theme-color': '#000000',
    'format-detection': 'telephone=no',
    'color-scheme': 'dark',
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
        {/* PWA Meta Tags - Produção 2025 */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ML Agent" />

        {/* Canonical URL - força iOS a usar /agente como URL principal */}
        <link rel="canonical" href="https://gugaleo.axnexlabs.com.br/agente" />

        {/* Script CRÍTICO: Forçar /agente no iOS PWA + Limpar query params */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // Detectar se está rodando como PWA standalone
            var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                              window.matchMedia('(display-mode: fullscreen)').matches ||
                              window.navigator.standalone === true;

            var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
            var search = window.location.search;
            var pathname = window.location.pathname;
            var hash = window.location.hash;

            // 🎯 iOS PWA: SEMPRE redirecionar para /agente quando abrir em standalone
            // Isso garante que mesmo que o iOS tenha salvado /login, sempre abre no dashboard
            if (isIOS && isStandalone) {
              console.log('[iOS PWA] Standalone mode detected - pathname:', pathname);

              // Lista de páginas que PODEM ser acessadas em standalone
              var allowedPages = ['/agente', '/agente/', '/answer/', '/approve/'];
              var isAllowedPage = allowedPages.some(function(page) {
                return pathname.startsWith(page);
              });

              // Se não está em página permitida E não é API/assets, redirecionar para /agente
              var isApiOrAsset = pathname.startsWith('/api/') ||
                                 pathname.startsWith('/_next/') ||
                                 /\\.(js|css|png|jpg|svg|ico)$/.test(pathname);

              if (!isAllowedPage && !isApiOrAsset) {
                console.log('[iOS PWA] Redirecting from', pathname, 'to /agente');
                window.location.replace('/agente');
                return;
              }
            }

            // iOS PWA: Se tem query params OAuth stale, redirecionar para URL limpa
            if (search && (search.includes('code=') || search.includes('state='))) {
              console.log('[iOS PWA Protection] Detected OAuth params in URL, cleaning...');

              // Se está em standalone, fazer replace na mesma aba
              if (isStandalone) {
                console.log('[iOS PWA] Standalone mode detected, cleaning URL in place');
                window.history.replaceState({}, '', pathname + hash);
              } else {
                // Se não está em standalone mas tem params OAuth, fazer redirect hard
                console.log('[iOS PWA] Browser mode with OAuth params, redirecting to clean URL');
                window.location.replace(pathname + hash);
              }
            }
          })();
        `}} />

        {/* Ícone principal iOS - imagem especial para tela inicial */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png" />
        <link rel="icon" type="image/png" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/ios-icon-152.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/ios-icon-167.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/ios-icon-120.png" />

        {/* Windows Tile Images - Microsoft Edge */}
        <meta name="msapplication-square70x70logo" content="/icons/icon-72x72.png" />
        <meta name="msapplication-square150x150logo" content="/icons/icon-152x152.png" />
        <meta name="msapplication-wide310x150logo" content="/icons/icon-192x192.png" />
        <meta name="msapplication-square310x310logo" content="/icons/icon-384x384.png" />

        {/* iOS Splash Screens - Todas as resoluções */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1290x2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1179x2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1284x2778.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1125x2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-828x1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
      </head>
      <body className={`${plusJakarta.className} antialiased font-sans bg-black`}>
        <AuthProvider>
          <AuthWrapper>
            <Providers>{children}</Providers>
            <PWAInitializer />
            <IOSPWAHandler />
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}

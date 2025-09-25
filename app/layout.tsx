import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthWrapper } from "@/components/auth-wrapper";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "ML Agent Pro - Automação Inteligente",
  description: "Plataforma premium de automação para vendedores do Mercado Livre",
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ML Agent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={plusJakarta.variable}>
      <body className={`${plusJakarta.className} antialiased font-sans`}>
        <AuthProvider>
          <AuthWrapper>
            <Providers>{children}</Providers>
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}

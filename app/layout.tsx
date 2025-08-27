import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./styles/premium-dark.css";
import { Providers } from "./providers";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthWrapper } from "@/components/auth-wrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ML Agent - Dashboard Mercado Livre",
  description: "Gerencie sua conta do Mercado Livre com métricas em tempo real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} antialiased bg-premium-dark`} style={{backgroundColor: '#0A0A0A'}}>
        <AuthProvider>
          <AuthWrapper>
            <Providers>{children}</Providers>
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}

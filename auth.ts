import { logger } from '@/lib/logger'
import NextAuth from "next-auth"
import type { NextAuthConfig, DefaultSession } from "next-auth"
import type { JWT } from "next-auth/jwt"
import MercadoLibre from "./lib/mercadolibre-oauth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    error?: string
    user: {
      id: string
      nickname?: string
      site_id?: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    userId?: string
    nickname?: string
    error?: string
  }
}

// Função para renovar access token
async function refreshAccessToken(token: JWT) {
  try {
    const url = "https://api.mercadolibre.com/oauth/token"
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env['ML_CLIENT_ID']!,
        client_secret: process.env['ML_CLIENT_SECRET']!,
        refresh_token: token.refreshToken as string,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
    }
  } catch (error) {
    logger.error("Error refreshing access token:", { error })
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

export const config: NextAuthConfig = {
  providers: [
    MercadoLibre({
      clientId: process.env['AUTH_MERCADOLIBRE_ID']!,
      clientSecret: process.env['AUTH_MERCADOLIBRE_SECRET']!,
      authorization: {
        params: {
          scope: "offline_access read write",
        }
      }
    })
  ],
  
  trustHost: true,
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  
  callbacks: {
    async jwt({ token, account, profile }: any) {
      // Salvar tokens no login inicial
      if (account && profile) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          userId: profile.id,
          nickname: profile.nickname,
        }
      }

      // Retornar token se ainda válido
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Renovar token expirado
      return await refreshAccessToken(token)
    },
    
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.expiresAt = token.expiresAt as number
      if (token.error) {
        session.error = token.error as string
      }
      
      if (token.userId) {
        session.user.id = token.userId as string
        session.user.nickname = token.nickname as string
      }
      
      return session
    },
    
    async redirect({ url, baseUrl }) {
      // Redirecionar para dashboard após login
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/dashboard`
      }
      // Permitir callback URLs
      if (url.startsWith(baseUrl)) return url
      // Permitir URLs relativas
      if (url.startsWith("/")) return `${baseUrl}${url}`
      return baseUrl
    },
  },
  
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  
  debug: true, // Ativar debug para ver logs detalhados
}

export const { handlers, signIn, signOut, auth } = NextAuth(config)
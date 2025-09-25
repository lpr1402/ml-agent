import { logger } from '@/lib/logger'
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers"

export interface MercadoLibreProfile {
  id: number
  nickname: string
  registration_date: string
  first_name: string
  last_name: string
  country_id: string
  email: string
  identification: {
    number: string
    type: string
  }
  address: {
    address: string
    city: string
    state: string
    zip_code: string
  }
  phone: {
    area_code: string
    number: string
    extension: string
    verified: boolean
  }
  user_type: string
  tags: string[]
  logo: string | null
  points: number
  site_id: string
  permalink: string
  seller_reputation: any
  buyer_reputation: any
  status: {
    site_status: string
  }
  thumbnail?: {
    picture_id: string
    picture_url: string
  }
}

export default function MercadoLibre<P extends MercadoLibreProfile>(
  options: OAuthUserConfig<P>
): OAuthConfig<P> {
  return {
    id: "mercadolibre",
    name: "Mercado Livre",
    type: "oauth",
    
    authorization: {
      url: "https://auth.mercadolivre.com.br/authorization",
      params: {
        scope: "offline_access read write",
        response_type: "code",
      }
    },
    
    token: {
      url: "https://api.mercadolibre.com/oauth/token",
      async request({ params, checks, provider }: any) {
        logger.info("Custom token request called with:", {
          code: params.code,
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          callbackUrl: provider.callbackUrl
        })
        
        const bodyParams = {
          grant_type: "authorization_code",
          client_id: options.clientId!,
          client_secret: options.clientSecret!,
          code: params.code as string,
          redirect_uri: provider.callbackUrl,
          ...(checks?.codeVerifier && { code_verifier: checks.codeVerifier })
        }
        
        logger.info("Token exchange body:", { error: { error: bodyParams } })
        
        const response = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
          },
          body: new URLSearchParams(bodyParams),
        })

        const tokens = await response.json()
        logger.info("Token exchange response:", { status: response.status, tokens })
        
        if (!response.ok) {
          throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`)
        }

        return {
          tokens,
        }
      }
    },
    
    userinfo: "https://api.mercadolibre.com/users/me",
    
    client: {
      id_token_signed_response_alg: "HS256",
    },
    
    profile(profile) {
      return {
        id: profile.id.toString(),
        name: profile.nickname || `${profile.first_name} ${profile.last_name}`,
        email: profile.email,
        image: profile.thumbnail?.picture_url ?? null,
      }
    },
    
    style: {
      logo: "/mercadolibre.svg",
      bg: "#fff",
      text: "#000",
    },
    
    options,
  }
}
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
      async conform(response: Response) {
        const data = await response.json()
        logger.info("Token response:", { error: { error: data } })
        
        if (response.ok && data.access_token) {
          return {
            tokens: {
              access_token: data.access_token,
              token_type: data.token_type,
              expires_in: data.expires_in,
              scope: data.scope,
              user_id: data.user_id,
              refresh_token: data.refresh_token,
            }
          }
        }
        
        throw new Error(`Token exchange failed: ${JSON.stringify(data)}`)
      }
    },
    
    userinfo: {
      url: "https://api.mercadolibre.com/users/me",
      async request({ tokens }: any) {
        const response = await fetch("https://api.mercadolibre.com/users/me", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        })
        return await response.json()
      }
    },
    
    client: {
      token_endpoint_auth_method: "client_secret_post",
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
/**
 * Mercado Livre OAuth Provider - ENHANCED VERSION
 * Implementação 100% compliant com documentação oficial ML
 * Inclui PKCE S256, state parameter, dynamic country detection
 */

import { logger } from '@/lib/logger'
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers"
import { generatePKCEPair, pkceStore } from '@/lib/ml-oauth/pkce-generator'

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

/**
 * Mapeia site_id para domínio de autorização
 */
const SITE_TO_DOMAIN: Record<string, string> = {
  'MLA': 'auth.mercadolibre.com.ar',    // Argentina
  'MLB': 'auth.mercadolivre.com.br',    // Brasil
  'MLM': 'auth.mercadolibre.com.mx',    // México
  'MLC': 'auth.mercadolibre.cl',        // Chile
  'MLU': 'auth.mercadolibre.com.uy',    // Uruguai
  'MCO': 'auth.mercadolibre.com.co',    // Colômbia
  'MLV': 'auth.mercadolibre.com.ve',    // Venezuela
  'MPE': 'auth.mercadolibre.com.pe',    // Peru
  'MEC': 'auth.mercadolibre.com.ec',    // Equador
  'MPY': 'auth.mercadolibre.com.py',    // Paraguai
  'MBO': 'auth.mercadolibre.com.bo',    // Bolívia
  'MRD': 'auth.mercadolibre.com.do',    // República Dominicana
  'MPA': 'auth.mercadolibre.com.pa',    // Panamá
  'MCR': 'auth.mercadolibre.com.cr',    // Costa Rica
  'MHN': 'auth.mercadolibre.com.hn',    // Honduras
  'MGT': 'auth.mercadolibre.com.gt',    // Guatemala
  'MNI': 'auth.mercadolibre.com.ni',    // Nicarágua
  'MSV': 'auth.mercadolibre.com.sv',    // El Salvador
}

export default function MercadoLibreEnhanced<P extends MercadoLibreProfile>(
  options: OAuthUserConfig<P> & { siteId?: string }
): OAuthConfig<P> {
  // Detecta país dinamicamente ou usa padrão Brasil
  const siteId = options.siteId || process.env['ML_SITE_ID'] || 'MLB'
  const authDomain = SITE_TO_DOMAIN[siteId] || 'auth.mercadolivre.com.br'
  
  return {
    id: "mercadolibre",
    name: "Mercado Livre",
    type: "oauth",
    
    authorization: {
      url: `https://${authDomain}/authorization`,
      params: async (_params: any) => {
        // Gera PKCE pair para máxima segurança
        const pkcePair = generatePKCEPair()
        
        // Armazena para uso posterior no token exchange
        pkceStore.set(pkcePair.state, pkcePair)
        
        logger.info('[OAuth] Authorization params with PKCE', {
          siteId,
          authDomain,
          method: pkcePair.method,
          state: pkcePair.state
        })
        
        return {
          scope: "offline_access read write",
          response_type: "code",
          // PKCE Parameters (obrigatórios para segurança máxima)
          code_challenge: pkcePair.challenge,
          code_challenge_method: pkcePair.method,
          // State parameter para CSRF protection
          state: pkcePair.state,
          // API version para garantir compatibilidade
          api_version: "4"
        }
      }
    },
    
    token: {
      url: "https://api.mercadolibre.com/oauth/token",
      async request({ params, checks, provider }: any) {
        // Recupera PKCE pair usando state
        const state = params.state || checks?.state
        const pkcePair = state ? pkceStore.get(state) : null
        
        if (!pkcePair) {
          logger.error('[OAuth] PKCE pair not found for state', { state })
          throw new Error('Invalid state parameter - possible CSRF attack')
        }
        
        logger.info("[OAuth] Token exchange with PKCE", {
          hasVerifier: !!pkcePair.verifier,
          state: pkcePair.state,
          clientId: options.clientId
        })
        
        const bodyParams: Record<string, string> = {
          grant_type: "authorization_code",
          client_id: options.clientId!,
          client_secret: options.clientSecret!,
          code: params.code as string,
          redirect_uri: provider.callbackUrl,
          // PKCE verifier (obrigatório se challenge foi enviado)
          code_verifier: pkcePair.verifier
        }
        
        // Log seguro (sem secrets)
        logger.info("[OAuth] Token exchange parameters", {
          grant_type: bodyParams['grant_type'],
          client_id: bodyParams['client_id'],
          redirect_uri: bodyParams['redirect_uri'],
          has_verifier: !!bodyParams['code_verifier']
        })
        
        try {
          const response = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json",
              "User-Agent": "ML-Agent/1.0 (PKCE-Enhanced)"
            },
            body: new URLSearchParams(bodyParams),
          })

          const tokens = await response.json()
          
          if (!response.ok) {
            logger.error("[OAuth] Token exchange failed", {
              status: response.status,
              error: tokens.error,
              error_description: tokens.error_description
            })
            
            // Tratamento específico de erros ML
            if (tokens.error === 'invalid_grant') {
              throw new Error('Authorization code expired or already used')
            }
            if (tokens.error === 'invalid_client') {
              throw new Error('Invalid client credentials')
            }
            
            throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`)
          }
          
          // Limpa PKCE pair usado
          pkceStore.delete(pkcePair.state)
          
          logger.info("[OAuth] Token exchange successful", {
            user_id: tokens.user_id,
            scope: tokens.scope,
            expires_in: tokens.expires_in
          })
          
          return {
            tokens,
          }
        } catch (error) {
          logger.error('[OAuth] Token exchange error', { error })
          throw error
        }
      }
    },
    
    userinfo: {
      url: "https://api.mercadolibre.com/users/me",
      async request({ tokens }: any) {
        const response = await fetch("https://api.mercadolibre.com/users/me", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/json",
            "User-Agent": "ML-Agent/1.0"
          }
        })
        
        if (!response.ok) {
          logger.error('[OAuth] Failed to fetch user info', {
            status: response.status
          })
          throw new Error('Failed to fetch user profile')
        }
        
        return response.json()
      }
    },
    
    client: {
      id_token_signed_response_alg: "HS256",
      token_endpoint_auth_method: "client_secret_post"
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

// Export helper para gerar URL de autorização manual
export function generateAuthorizationURL(params: {
  clientId: string
  redirectUri: string
  siteId?: string
  state?: string
}): string {
  const siteId = params.siteId || 'MLB'
  const authDomain = SITE_TO_DOMAIN[siteId] || 'auth.mercadolivre.com.br'
  const pkcePair = generatePKCEPair(params.state)
  
  // Armazena PKCE pair
  pkceStore.set(pkcePair.state, pkcePair)
  
  const urlParams = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: pkcePair.challenge,
    code_challenge_method: pkcePair.method,
    state: pkcePair.state,
    scope: 'offline_access read write'
  })
  
  return `https://${authDomain}/authorization?${urlParams.toString()}`
}
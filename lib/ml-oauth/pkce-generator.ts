/**
 * PKCE (Proof Key for Code Exchange) Generator
 * Implementação completa seguindo RFC 7636 e documentação oficial ML
 * Garante segurança máxima no fluxo OAuth2
 */

import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * Gera code_verifier aleatório
 * RFC 7636: 43-128 caracteres de [A-Z] [a-z] [0-9] - . _ ~
 */
export function generateCodeVerifier(): string {
  // ML recomenda 128 caracteres para máxima segurança
  const length = 128
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  
  let verifier = ''
  const randomBytes = crypto.randomBytes(length)
  
  for (let i = 0; i < length; i++) {
    const byte = randomBytes[i]
    if (byte !== undefined) {
      verifier += possible[byte % possible.length]
    }
  }
  
  logger.info('[PKCE] Code verifier generated', { length })
  return verifier
}

/**
 * Gera code_challenge usando S256 (SHA256)
 * Conforme documentação ML: S256 é obrigatório para máxima segurança
 */
export function generateCodeChallenge(verifier: string): string {
  // S256: base64url(sha256(verifier))
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url') // base64url remove padding e substitui +/ por -_
  
  logger.info('[PKCE] Code challenge generated using S256')
  return challenge
}

/**
 * Interface para armazenar PKCE temporariamente
 */
export interface PKCEPair {
  verifier: string
  challenge: string
  method: 'S256' // ML suporta S256 e plain, mas S256 é obrigatório para segurança
  createdAt: Date
  state: string // Para validação CSRF
}

/**
 * Gera par completo PKCE para autorização
 */
export function generatePKCEPair(state?: string): PKCEPair {
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)
  
  const pair: PKCEPair = {
    verifier,
    challenge,
    method: 'S256',
    createdAt: new Date(),
    state: state || crypto.randomBytes(32).toString('base64url')
  }
  
  logger.info('[PKCE] Complete PKCE pair generated', {
    method: pair.method,
    state: pair.state,
    challengeLength: challenge.length
  })
  
  return pair
}

/**
 * Valida code_verifier contra code_challenge
 * Usado para debug e testes
 */
export function validatePKCE(verifier: string, challenge: string): boolean {
  const computedChallenge = generateCodeChallenge(verifier)
  const isValid = computedChallenge === challenge
  
  if (!isValid) {
    logger.error('[PKCE] Validation failed', {
      expected: challenge,
      computed: computedChallenge
    })
  }
  
  return isValid
}

/**
 * Armazenamento temporário em memória para PKCE
 * Em produção, usar Redis com TTL de 10 minutos
 */
class PKCEStore {
  private store = new Map<string, PKCEPair>()
  private readonly TTL = 10 * 60 * 1000 // 10 minutos
  
  set(state: string, pair: PKCEPair): void {
    this.store.set(state, pair)
    
    // Auto-cleanup após TTL
    setTimeout(() => {
      this.store.delete(state)
      logger.info('[PKCE] Pair expired and removed', { state })
    }, this.TTL)
  }
  
  get(state: string): PKCEPair | undefined {
    return this.store.get(state)
  }
  
  delete(state: string): void {
    this.store.delete(state)
  }
  
  // Limpa pares expirados
  cleanup(): void {
    const now = Date.now()
    for (const [state, pair] of this.store.entries()) {
      if (now - pair.createdAt.getTime() > this.TTL) {
        this.store.delete(state)
        logger.info('[PKCE] Expired pair cleaned', { state })
      }
    }
  }
}

export const pkceStore = new PKCEStore()

// Cleanup periódico
setInterval(() => {
  pkceStore.cleanup()
}, 60 * 1000) // A cada minuto

const pkceModule = {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  validatePKCE,
  pkceStore
}

export default pkceModule
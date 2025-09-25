/**
 * Webhook Security Validator
 * Implementa validação de IPs oficiais ML e HMAC signature
 * 100% compliance com documentação oficial
 */

import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * IPs oficiais do Mercado Livre para webhooks
 * Fonte: Documentação oficial ML
 */
const ML_WEBHOOK_IPS = [
  '54.88.218.97',
  '18.215.140.160',
  '18.210.69.172',
  '52.87.75.49',
  '3.94.235.161',
  '3.86.50.14',
  '34.194.71.130',
  '52.206.108.120'
]

/**
 * IPs para testes locais (desenvolvimento)
 */
const LOCAL_IPS = [
  '127.0.0.1',
  '::1',
  'localhost'
]

/**
 * Valida se o IP é autorizado pelo ML
 */
export function validateWebhookIP(ip: string | undefined): boolean {
  if (!ip) {
    logger.error('[WebhookSecurity] No IP provided')
    return false
  }
  
  // Remove prefixo IPv6 se presente
  const cleanIP = ip.replace(/^::ffff:/, '')
  
  // Em desenvolvimento, aceita IPs locais
  if (process.env.NODE_ENV === 'development') {
    if (LOCAL_IPS.includes(cleanIP)) {
      logger.info('[WebhookSecurity] Local IP accepted in development', { ip: cleanIP })
      return true
    }
  }
  
  // Valida contra IPs oficiais ML
  const isValid = ML_WEBHOOK_IPS.includes(cleanIP)
  
  if (!isValid) {
    logger.error('[WebhookSecurity] Invalid webhook IP', {
      ip: cleanIP,
      expected: ML_WEBHOOK_IPS
    })
  } else {
    logger.info('[WebhookSecurity] Valid ML webhook IP', { ip: cleanIP })
  }
  
  return isValid
}

/**
 * Interface para webhook payload
 */
interface WebhookPayload {
  topic: string
  resource: string
  user_id: string
  application_id?: string
  sent?: string
  attempts?: number
}

/**
 * Gera HMAC signature para validação
 * Algoritmo: HMAC-SHA256
 */
export function generateWebhookSignature(
  payload: WebhookPayload | string,
  secret: string
): string {
  const data = typeof payload === 'string' 
    ? payload 
    : JSON.stringify(payload)
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
  
  return signature
}

/**
 * Valida HMAC signature do webhook
 */
export function validateWebhookSignature(
  payload: WebhookPayload | string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    logger.error('[WebhookSecurity] No signature provided')
    return false
  }
  
  // Gera signature esperada
  const expectedSignature = generateWebhookSignature(payload, secret)
  
  // Comparação segura contra timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
  
  if (!isValid) {
    logger.error('[WebhookSecurity] Invalid webhook signature', {
      provided: signature.substring(0, 8) + '...',
      expected: expectedSignature.substring(0, 8) + '...'
    })
  } else {
    logger.info('[WebhookSecurity] Valid webhook signature')
  }
  
  return isValid
}

/**
 * Valida timestamp do webhook (previne replay attacks)
 * Webhooks devem ser processados em até 5 minutos
 */
export function validateWebhookTimestamp(timestamp: string | undefined): boolean {
  if (!timestamp) {
    logger.error('[WebhookSecurity] No timestamp provided')
    return false
  }
  
  const webhookTime = new Date(timestamp).getTime()
  const currentTime = Date.now()
  const difference = Math.abs(currentTime - webhookTime)
  
  // 5 minutos de tolerância
  const MAX_AGE = 5 * 60 * 1000
  
  if (difference > MAX_AGE) {
    logger.error('[WebhookSecurity] Webhook timestamp too old', {
      age: Math.floor(difference / 1000) + ' seconds',
      maxAge: '300 seconds'
    })
    return false
  }
  
  logger.info('[WebhookSecurity] Valid webhook timestamp', {
    age: Math.floor(difference / 1000) + ' seconds'
  })
  
  return true
}

/**
 * Validação completa de segurança do webhook
 */
export interface WebhookSecurityOptions {
  ip?: string
  signature?: string
  timestamp?: string
  payload: WebhookPayload | string
  secret: string
  skipIPValidation?: boolean // Para testes
  skipSignatureValidation?: boolean // Para webhooks sem signature
  skipTimestampValidation?: boolean // Para webhooks sem timestamp
}

export function validateWebhookSecurity(options: WebhookSecurityOptions): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // 1. Valida IP
  if (!options.skipIPValidation) {
    if (!validateWebhookIP(options.ip)) {
      errors.push('Invalid source IP')
    }
  }
  
  // 2. Valida Signature
  if (!options.skipSignatureValidation) {
    if (!validateWebhookSignature(options.payload, options.signature, options.secret)) {
      errors.push('Invalid webhook signature')
    }
  }
  
  // 3. Valida Timestamp
  if (!options.skipTimestampValidation && options.timestamp) {
    if (!validateWebhookTimestamp(options.timestamp)) {
      errors.push('Webhook timestamp expired')
    }
  }
  
  const isValid = errors.length === 0
  
  if (isValid) {
    logger.info('[WebhookSecurity] All security checks passed')
  } else {
    logger.error('[WebhookSecurity] Security validation failed', { errors })
  }
  
  return { isValid, errors }
}

/**
 * Extrai IP real considerando proxies
 */
export function extractRealIP(request: Request | any): string | undefined {
  // Headers em ordem de prioridade
  const headers = [
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ]
  
  for (const header of headers) {
    const value = request.headers?.get?.(header) || request.headers?.[header]
    if (value) {
      // X-Forwarded-For pode ter múltiplos IPs
      const ip = value.split(',')[0].trim()
      if (ip) return ip
    }
  }
  
  // Fallback para IP direto
  return request.ip || request.connection?.remoteAddress
}

/**
 * Rate limiting específico para webhooks
 * ML envia no máximo 10 tentativas por webhook
 */
export class WebhookRateLimiter {
  private attempts = new Map<string, number[]>()
  private readonly MAX_ATTEMPTS = 10
  private readonly WINDOW = 60 * 1000 // 1 minuto
  
  isAllowed(webhookId: string): boolean {
    const now = Date.now()
    const timestamps = this.attempts.get(webhookId) || []
    
    // Remove tentativas antigas
    const recentAttempts = timestamps.filter(t => now - t < this.WINDOW)
    
    if (recentAttempts.length >= this.MAX_ATTEMPTS) {
      logger.warn('[WebhookSecurity] Rate limit exceeded', {
        webhookId,
        attempts: recentAttempts.length
      })
      return false
    }
    
    // Adiciona nova tentativa
    recentAttempts.push(now)
    this.attempts.set(webhookId, recentAttempts)
    
    return true
  }
  
  // Limpa tentativas antigas periodicamente
  cleanup(): void {
    const now = Date.now()
    for (const [id, timestamps] of this.attempts.entries()) {
      const recent = timestamps.filter(t => now - t < this.WINDOW)
      if (recent.length === 0) {
        this.attempts.delete(id)
      } else {
        this.attempts.set(id, recent)
      }
    }
  }
}

export const webhookRateLimiter = new WebhookRateLimiter()

// Cleanup periódico
setInterval(() => {
  webhookRateLimiter.cleanup()
}, 60 * 1000)

const securityValidator = {
  validateWebhookIP,
  validateWebhookSignature,
  validateWebhookTimestamp,
  validateWebhookSecurity,
  extractRealIP,
  generateWebhookSignature,
  webhookRateLimiter,
  ML_WEBHOOK_IPS
}

export default securityValidator
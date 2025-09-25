/**
 * Validação de Webhooks do Mercado Livre
 * Segue 100% a documentação oficial do ML
 * IPs oficiais do ML para webhooks
 * Edge Runtime Compatible
 */

// IPs oficiais do Mercado Livre para webhooks (documentação oficial + IPs ativos 2025)
const ML_WEBHOOK_IPS = [
  '54.88.218.97',
  '18.215.140.160',
  '18.210.79.49',
  '34.237.96.70',
  '52.4.152.221',
  '18.213.235.122',
  '34.199.3.143',
  '3.211.188.35',
  '18.206.34.84',    // Adicionado 02/09/2025 - IP ativo do ML
  '18.213.114.129'   // Adicionado 02/09/2025 - IP ativo do ML
]

/**
 * Valida se o IP é um IP oficial do Mercado Livre
 */
export function isValidMLWebhookIP(ip: string | null): boolean {
  if (!ip) return false
  
  // Remove prefixo IPv6 se presente (::ffff:)
  const cleanIP = ip.replace(/^::ffff:/, '')
  
  // Em desenvolvimento, permitir localhost
  if (process.env.NODE_ENV === 'development') {
    if (cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP === 'localhost') {
      return true
    }
  }
  
  return ML_WEBHOOK_IPS.includes(cleanIP)
}

// Função de validação de assinatura movida para route handler
// onde Node.js crypto está disponível

/**
 * Extrai IP real considerando proxies
 */
export function getRealIP(_request: Request, headers: Headers): string | null {
  // Prioridade: x-forwarded-for > x-real-ip > cf-connecting-ip > ip direto
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]
    return firstIp ? firstIp.trim() : null
  }
  
  const realIP = headers.get('x-real-ip')
  if (realIP) return realIP
  
  const cfIP = headers.get('cf-connecting-ip')
  if (cfIP) return cfIP
  
  // Fallback para IP direto da conexão
  return null
}

/**
 * Valida webhook do Mercado Livre
 */
export interface MLWebhookValidation {
  isValid: boolean
  reason?: string
  ip?: string
}

export function validateMLWebhook(
  request: Request,
  headers: Headers
): MLWebhookValidation {
  const ip = getRealIP(request, headers)
  
  if (!ip) {
    return {
      isValid: false,
      reason: 'Could not determine request IP',
      ip: 'unknown'
    }
  }
  
  if (!isValidMLWebhookIP(ip)) {
    return {
      isValid: false,
      reason: `IP ${ip} is not in ML webhook whitelist`,
      ip
    }
  }
  
  return {
    isValid: true,
    ip
  }
}

/**
 * Rate limiting específico para webhooks
 */
const webhookAttempts = new Map<string, { count: number; resetAt: number }>()

export function checkWebhookRateLimit(
  identifier: string,
  maxAttempts: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const attempt = webhookAttempts.get(identifier)
  
  if (!attempt || attempt.resetAt < now) {
    webhookAttempts.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    })
    return true
  }
  
  if (attempt.count >= maxAttempts) {
    return false
  }
  
  attempt.count++
  return true
}

// Limpeza automática no próprio checkWebhookRateLimit
// para compatibilidade com Edge Runtime
/**
 * Mercado Livre Webhook Validator
 * Implementa validação completa de webhooks incluindo signature
 */

import { logger } from '@/lib/logger'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { auditSecurityEvent } from '@/lib/audit/audit-logger'

// IPs oficiais do Mercado Livre (atualizado 2025)
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

// Cache de IPs para performance
const ipCache = new Set(ML_WEBHOOK_IPS)

export class MLWebhookValidator {
  private static webhookSecret: string = process.env['ML_WEBHOOK_SECRET'] || ''

  /**
   * Valida completamente um webhook do Mercado Livre
   */
  static async validateWebhook(
    request: Request,
    payload: any
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      logger.info('[Webhook] Starting validation', { 
        topic: payload?.topic,
        resource: payload?.resource,
        userId: payload?.user_id
      })

      // 1. Validar IP de origem (skip em desenvolvimento)
      const sourceIp = this.getSourceIP(request)
      logger.info('[Webhook] Source IP detected', { sourceIp, env: process.env.NODE_ENV })

      // Em produção, validar IP rigorosamente
      // Em desenvolvimento, ser mais permissivo
      if (process.env.NODE_ENV === 'production' && !this.validateIP(sourceIp)) {
        logger.error('[Webhook] Blocked request from IP', {
          sourceIp,
          validIPs: Array.from(ipCache)
        })
        console.log('[Webhook] Blocked request from IP:', sourceIp)
        await auditSecurityEvent('webhook_invalid_ip', { sourceIp }, undefined)
        return {
          valid: false,
          reason: `Invalid source IP: ${sourceIp}`
        }
      } else if (process.env.NODE_ENV !== 'production') {
        // Em desenvolvimento, apenas avisar mas não bloquear
        if (!this.validateIP(sourceIp)) {
          logger.warn('[Webhook] IP not whitelisted but allowing in dev mode', { sourceIp })
        }
      }

      // 2. Validar estrutura do payload
      if (!this.validatePayloadStructure(payload)) {
        await auditSecurityEvent('webhook_invalid_structure', { payload }, undefined)
        return { 
          valid: false, 
          reason: 'Invalid payload structure' 
        }
      }

      // 3. Validar signature (se configurada)
      const signature = request.headers?.get('x-signature') || 
                       request.headers.get('x-ml-signature')
      
      if (signature && this.webhookSecret) {
        const payloadString = JSON.stringify(payload)
        if (!this.validateSignature(payloadString, signature, this.webhookSecret)) {
          await auditSecurityEvent('webhook_invalid_signature', { 
            signature,
            payload: payload.resource 
          }, undefined)
          return { 
            valid: false, 
            reason: 'Invalid webhook signature' 
          }
        }
      }

      // 4. Validar attempt_id para prevenir duplicatas
      const attemptId = payload._id || payload.attempt_id
      if (attemptId) {
        const isDuplicate = await this.checkDuplicate(attemptId)
        if (isDuplicate) {
          logger.warn('[Webhook] Duplicate webhook detected', { attemptId })
          return { 
            valid: false, 
            reason: 'Duplicate webhook (already processed)' 
          }
        }
      }

      // 5. Validar timestamp (não pode ser muito antigo)
      if (payload.sent) {
        const sentTime = new Date(payload.sent).getTime()
        const now = Date.now()
        const maxAge = 5 * 60 * 1000 // 5 minutos
        
        if (now - sentTime > maxAge) {
          logger.warn('[Webhook] Webhook too old', { 
            sent: payload.sent,
            age: (now - sentTime) / 1000 
          })
          return { 
            valid: false, 
            reason: 'Webhook timestamp too old' 
          }
        }
      }

      return { valid: true }

    } catch (error) {
      logger.error('[Webhook] Validation error', { error })
      return { 
        valid: false, 
        reason: `Validation error: ${String(error)}` 
      }
    }
  }

  /**
   * Valida IP de origem
   */
  private static validateIP(ip: string): boolean {
    // Em desenvolvimento ou teste local, aceita IPs locais
    if (process.env.NODE_ENV !== 'production') {
      // Aceita qualquer IP local
      if (ip === '127.0.0.1' ||
          ip === '::1' ||
          ip === 'localhost' ||
          ip === '::ffff:127.0.0.1' ||
          ip.startsWith('192.168.') ||
          ip.startsWith('10.') ||
          ip.startsWith('172.')) {
        logger.info('[Webhook] Accepting local IP in dev mode', { ip })
        return true
      }
    }

    // Log do IP e lista de IPs válidos
    const isValid = ipCache.has(ip)
    if (!isValid) {
      logger.warn('[Webhook] IP not in whitelist', {
        ip,
        validIps: Array.from(ipCache),
        ipCacheSize: ipCache.size,
        nodeEnv: process.env.NODE_ENV
      })

      // Log especial para IPs que bloqueamos mas são do ML
      if (ip === '18.206.34.84' || ip === '18.213.114.129' || ip === '54.88.218.97' || ip === '18.215.140.160') {
        logger.error('[Webhook] CRITICAL: Blocking valid ML IP!', {
          ip,
          message: 'This IP should be whitelisted but validation is failing'
        })
      }
    } else {
      logger.info('[Webhook] IP validated successfully', { ip })
    }

    // Verifica se IP está na lista oficial do ML
    return isValid
  }

  /**
   * Obtém IP de origem considerando proxies
   */
  private static getSourceIP(request: Request): string {
    try {
      // Para NextRequest, headers é um objeto Headers
      const headers = request.headers
      
      // PRIORIDADE 1: x-real-ip (nginx seta o IP real aqui)
      const realIp = headers.get('x-real-ip')
      if (realIp) {
        logger.info('[Webhook] Detected IP from x-real-ip', { realIp })
        return realIp
      }
      
      // PRIORIDADE 2: x-forwarded-for (pegar o PRIMEIRO IP - o real do cliente)
      const forwarded = headers.get('x-forwarded-for')
      if (forwarded) {
        // Com proxy: "IP_REAL, proxy1, proxy2"
        // Pega o PRIMEIRO IP da lista (IP real do cliente)
        const ips = forwarded.split(',').map(ip => ip.trim())
        const clientIp = ips[0] // Pega o primeiro IP
        if (clientIp && clientIp !== '0.0.0.0') {
          logger.info('[Webhook] Detected IP from x-forwarded-for', { 
            forwarded, 
            clientIp,
            allIps: ips 
          })
          return clientIp
        }
      }

      // Cloudflare
      const cfIp = headers.get('cf-connecting-ip')
      if (cfIp) {
        logger.info('[Webhook] Detected IP from cf-connecting-ip', { cfIp })
        return cfIp
      }

      logger.warn('[Webhook] Could not detect real IP from headers')
      return '0.0.0.0'
    } catch (error) {
      logger.error('[Webhook] Error getting source IP', { error })
      return '0.0.0.0'
    }
  }

  /**
   * Valida estrutura do payload
   */
  private static validatePayloadStructure(payload: any): boolean {
    // Campos obrigatórios segundo documentação ML
    const requiredFields = ['resource', 'user_id', 'topic', 'application_id', 'sent']
    
    for (const field of requiredFields) {
      if (!payload[field]) {
        logger.warn('[Webhook] Missing required field', { field, payload })
        return false
      }
    }

    // Valida topic conhecido
    const validTopics = [
      'questions', 
      'orders', 
      'items', 
      'messages',
      'claims',
      'payments'
    ]
    
    if (!validTopics.includes(payload.topic)) {
      logger.warn('[Webhook] Unknown topic', { topic: payload.topic })
      return false
    }

    return true
  }

  /**
   * Valida assinatura HMAC do webhook
   */
  private static validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // Remove prefixo se existir (sha256=)
      const cleanSignature = signature.replace(/^sha256=/, '')
      
      // Gera assinatura esperada
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')
      
      // Comparação segura contra timing attacks
      const signatureBuffer = Buffer.from(cleanSignature)
      const expectedBuffer = Buffer.from(expectedSignature)
      
      if (signatureBuffer.length !== expectedBuffer.length) {
        return false
      }
      
      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
      
    } catch (error) {
      logger.error('[Webhook] Signature validation error', { error })
      return false
    }
  }

  /**
   * Verifica se webhook é duplicata
   */
  private static async checkDuplicate(attemptId: string): Promise<boolean> {
    try {
      const existing = await prisma.webhookEvent.findFirst({
        where: { attemptId },
        select: { id: true }
      })
      
      return !!existing
      
    } catch (error) {
      // Em caso de erro, assume que não é duplicata para não bloquear
      logger.error('[Webhook] Duplicate check error', { error })
      return false
    }
  }

  /**
   * Atualiza lista de IPs do ML (para manutenção)
   */
  static async updateMLIPs(): Promise<void> {
    try {
      // Em produção, poderia buscar de uma API ou config
      // Por ora, usa lista hardcoded
      const newIPs = ML_WEBHOOK_IPS
      
      ipCache.clear()
      newIPs.forEach(ip => ipCache.add(ip))
      
      logger.info('[Webhook] ML IPs updated', { count: ipCache.size })
      
    } catch (error) {
      logger.error('[Webhook] Failed to update ML IPs', { error })
    }
  }

  /**
   * Processa resposta para webhook (< 500ms requirement)
   */
  static async processWebhookResponse(
    webhookId: string,
    success: boolean,
    processingTime: number
  ): Promise<void> {
    // Log performance
    if (processingTime > 400) {
      logger.warn('[Webhook] Slow processing detected', {
        webhookId,
        processingTime,
        success
      })
    }

    // Atualiza status no banco
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        processed: true,
        processedAt: new Date(),
        status: success ? 'COMPLETED' : 'FAILED'
      }
    })
  }

  /**
   * Configura secret do webhook
   */
  static setWebhookSecret(secret: string): void {
    this.webhookSecret = secret
    logger.info('[Webhook] Secret configured')
  }
}

// Auto-atualização de IPs a cada 24 horas
setInterval(() => {
  MLWebhookValidator.updateMLIPs()
}, 24 * 60 * 60 * 1000)

export default MLWebhookValidator
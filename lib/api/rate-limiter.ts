/**
 * Sistema de Rate Limiting para APIs do Mercado Livre
 * Implementa backoff exponencial e retry automático
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

interface RateLimitConfig {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  maxRetries: 2, // Apenas 2 retries para não acumular delays
  initialDelay: 1000, // 1 segundo inicial
  maxDelay: 3000, // 3 segundos máximo
  backoffMultiplier: 1.5 // Crescimento mais suave
}

/**
 * Aguarda um período antes de retry
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Verifica se uma conta está em rate limit
 */
export async function isRateLimited(mlAccountId: string): Promise<boolean> {
  const account = await prisma.mLAccount.findUnique({
    where: { id: mlAccountId },
    select: { rateLimitReset: true }
  })
  
  if (!account?.rateLimitReset) return false
  
  return account.rateLimitReset > new Date()
}

/**
 * Registra um rate limit para uma conta
 */
export async function setRateLimit(
  mlAccountId: string, 
  resetTime: Date
): Promise<void> {
  await prisma.mLAccount.update({
    where: { id: mlAccountId },
    data: {
      rateLimitReset: resetTime,
      rateLimitCount: { increment: 1 },
      connectionError: `Rate limited until ${resetTime.toISOString()}`
    }
  })
}

/**
 * Limpa o rate limit de uma conta
 */
export async function clearRateLimit(mlAccountId: string): Promise<void> {
  await prisma.mLAccount.update({
    where: { id: mlAccountId },
    data: {
      rateLimitReset: null,
      rateLimitCount: 0,
      connectionError: null
    }
  })
}

/**
 * Executa uma requisição com retry automático em caso de rate limit
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<Response>,
  config: RateLimitConfig = {}
): Promise<T> {
  const opts = { ...DEFAULT_CONFIG, ...config }
  let lastError: Error | null = null
  let delay = opts.initialDelay
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fn()
      
      // Log dos headers de rate limit para debug
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
      const rateLimitReset = response.headers.get('X-RateLimit-Reset')
      
      if (rateLimitRemaining) {
        logger.info(`[RateLimit] Remaining: ${rateLimitRemaining}`)
      }
      
      // Se não for rate limit, retorna o resultado
      if (response.status !== 429) {
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API error ${response.status}: ${errorText}`)
        }
        return await response.json()
      }
      
      // Se for rate limit, calcula o tempo de espera
      const retryAfter = response.headers.get('Retry-After')
      const xRetryAfter = response.headers.get('X-Retry-After')
      
      // Usa o header disponível ou backoff exponencial com jitter
      let waitTime: number
      if (retryAfter) {
        waitTime = parseInt(retryAfter) * 1000
      } else if (xRetryAfter) {
        waitTime = parseInt(xRetryAfter) * 1000
      } else if (rateLimitReset) {
        // Se tiver reset time, espera até esse momento
        const resetTime = new Date(parseInt(rateLimitReset) * 1000)
        waitTime = Math.max(0, resetTime.getTime() - Date.now()) + 1000 // +1s de margem
      } else {
        // Backoff exponencial com jitter
        waitTime = Math.min(delay + Math.random() * 1000, opts.maxDelay)
      }
      
      logger.info(`[RateLimit] Hit 429, waiting ${waitTime}ms before retry ${attempt + 1}/${opts.maxRetries}`)
      
      // Se não tiver mais retries, lança erro
      if (attempt === opts.maxRetries) {
        throw new Error(`Rate limited after ${opts.maxRetries} retries`)
      }
      
      // Aguarda antes do próximo retry
      await sleep(waitTime)
      
      // Aumenta o delay para o próximo retry (backoff exponencial)
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay)
      
    } catch (error) {
      lastError = error as Error
      
      // Se não for erro de rate limit ou API, lança imediatamente
      if (!lastError.message.includes('429') && 
          !lastError.message.includes('Rate limited') &&
          !lastError.message.includes('API error')) {
        throw error
      }
      
      // Se for o último retry, lança o erro
      if (attempt === opts.maxRetries) {
        throw lastError
      }
      
      // Aguarda com backoff antes do próximo retry
      const waitTime = Math.min(delay + Math.random() * 1000, opts.maxDelay)
      logger.info(`[RateLimit] Error on attempt ${attempt + 1}, waiting ${waitTime}ms`)
      await sleep(waitTime)
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay)
    }
  }
  
  throw lastError || new Error('Unknown error in rate limit retry')
}

/**
 * Cria um pool de requisições com controle de concorrência
 */
export class RequestPool {
  private queue: (() => Promise<any>)[] = []
  private running = 0
  private maxConcurrent: number
  
  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent
  }
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }
  
  private async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return
    }
    
    this.running++
    const fn = this.queue.shift()
    
    if (fn) {
      await fn()
      this.running--
      this.processQueue()
    }
  }
}

// Pool global para requisições ao ML
// Limita a 2 requisições simultâneas para respeitar rate limit ML (2000/hora)
export const mlRequestPool = new RequestPool(2) // Máximo 2 requisições paralelas
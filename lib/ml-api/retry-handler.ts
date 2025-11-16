/**
 * Retry Handler para API do Mercado Livre
 * Sistema de retry inteligente apenas para erros 429
 * Sem rate limiting interno - máxima performance
 */

import { logger } from '../logger'

interface RetryConfig {
  initialDelay: number      // Delay inicial em ms
  maxDelay: number          // Delay máximo em ms
  maxRetries: number        // Número máximo de tentativas
  backoffMultiplier: number // Multiplicador para backoff exponencial
}

class MLRetryHandler {
  private static instance: MLRetryHandler

  private config: RetryConfig = {
    initialDelay: 2000,       // 2 segundos inicial
    maxDelay: 60000,          // 🔴 1 minuto máximo (reduzido de 5min)
    maxRetries: 3,            // 🔴 3 tentativas (reduzido de 10)
    backoffMultiplier: 2      // Dobra o tempo a cada tentativa
  }

  private constructor() {
    logger.info('[MLRetryHandler] Sistema de retry inicializado SEM rate limiting interno')
  }

  static getInstance(): MLRetryHandler {
    if (!MLRetryHandler.instance) {
      MLRetryHandler.instance = new MLRetryHandler()
    }
    return MLRetryHandler.instance
  }

  /**
   * Executa operação com retry APENAS em caso de 429
   * Não limita requisições internamente
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    accountId?: string
  ): Promise<T> {
    let lastError: any
    let currentDelay = this.config.initialDelay

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Executa direto sem verificações de rate limit
        const result = await operation()

        if (attempt > 0) {
          logger.info(`[MLRetryHandler] ${operationName} sucesso após ${attempt + 1} tentativas`)
        }

        return result

      } catch (error: any) {
        lastError = error

        // APENAS faz retry em 429 (Too Many Requests)
        if (error.status === 429 || error.statusCode === 429 ||
            error.message?.includes('429') || error.message?.includes('Too Many Requests')) {

          // Verifica se há header Retry-After
          const retryAfter = error.headers?.['retry-after']
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.min(currentDelay, this.config.maxDelay)

          logger.warn(`[MLRetryHandler] 429 recebido do ML - aguardando ${waitTime}ms`, {
            operationName,
            accountId,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            retryAfter
          })

          await this.wait(waitTime)

          // Exponential backoff para próxima tentativa
          currentDelay = Math.min(
            currentDelay * this.config.backoffMultiplier,
            this.config.maxDelay
          )

          continue
        }

        // Para 401 (unauthorized) não faz retry
        if (error.status === 401 || error.statusCode === 401) {
          logger.error(`[MLRetryHandler] Token inválido/expirado: ${operationName}`, {
            accountId,
            error: error.message
          })
          throw error
        }

        // Para 403 (forbidden) não faz retry
        if (error.status === 403 || error.statusCode === 403) {
          logger.error(`[MLRetryHandler] Acesso negado: ${operationName}`, {
            accountId,
            error: error.message
          })
          throw error
        }

        // Para 404 (not found) não faz retry
        if (error.status === 404 || error.statusCode === 404) {
          logger.debug(`[MLRetryHandler] Recurso não encontrado: ${operationName}`)
          throw error
        }

        // Para erros 5xx (servidor), faz retry com delay menor
        if (error.status >= 500 || error.statusCode >= 500) {
          const waitTime = Math.min(this.config.initialDelay, 5000)

          if (attempt < this.config.maxRetries - 1) {
            logger.warn(`[MLRetryHandler] Erro servidor ML - retry em ${waitTime}ms`, {
              operationName,
              accountId,
              status: error.status || error.statusCode,
              attempt: attempt + 1
            })
            await this.wait(waitTime)
            continue
          }
        }

        // Para outros erros, lança direto
        logger.error(`[MLRetryHandler] Erro não recuperável: ${operationName}`, {
          accountId,
          status: error.status || error.statusCode,
          message: error.message
        })
        throw error
      }
    }

    logger.error(`[MLRetryHandler] ${operationName} falhou após ${this.config.maxRetries} tentativas`, {
      accountId,
      lastError: lastError?.message
    })
    throw lastError
  }

  /**
   * Espera o tempo especificado
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Atualiza configuração dinamicamente
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('[MLRetryHandler] Configuração atualizada', this.config)
  }

  /**
   * Retorna estatísticas (simplificado sem tracking de requisições)
   */
  getStats() {
    return {
      config: this.config,
      message: 'Sistema operando sem rate limiting interno - máxima performance'
    }
  }
}

// Singleton global
export const mlRetryHandler = MLRetryHandler.getInstance()

// Função helper para uso direto
export async function executeMLRequest<T>(
  operation: () => Promise<T>,
  operationName: string,
  accountId?: string
): Promise<T> {
  return mlRetryHandler.executeWithRetry(operation, operationName, accountId)
}
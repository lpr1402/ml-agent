/**
 * Gemini 3.0 Pro Client Wrapper
 * Gerencia comunicação com Google Gemini API
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { GoogleGenAI } from '@google/genai'
import { logger } from '@/lib/logger'
import type {
  AgentConfig,
  GeminiStreamChunk,
  TokenUsage,
  AgentError,
} from '../types/agent-types'

/**
 * Cliente para Gemini 3.0 Pro com retry e error handling
 */
export class GeminiClient {
  private client: GoogleGenAI
  private config: AgentConfig
  private model: string

  constructor(config: AgentConfig) {
    this.config = config
    this.model = config.model

    // Inicializar cliente Gemini com v1alpha (CRÍTICO para Gemini 3 Pro)
    this.client = new GoogleGenAI({
      apiKey: config.geminiApiKey,
      apiVersion: 'v1alpha' // ✅ Gemini 3 Pro requer v1alpha, não v1beta
    })

    logger.info('[GeminiClient] Initialized', {
      model: this.model,
      apiVersion: 'v1alpha',
      temperature: config.temperature,
      thinkingLevel: config.thinkingLevel,
    })
  }

  /**
   * Retry com backoff exponencial
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error

        // Verificar se é erro retryable (503, 429, timeout, etc.)
        const isRetryable = this.isRetryableError(error)

        if (!isRetryable || attempt === maxRetries) {
          logger.error(`[GeminiClient] ${operationName} failed after ${attempt} attempts`, {
            error: error.message,
            code: error.code || error.status,
            isRetryable
          })
          throw error
        }

        // Backoff exponencial: 2s, 4s, 8s
        const delayMs = Math.pow(2, attempt) * 1000

        logger.warn(`[GeminiClient] ${operationName} failed, retrying in ${delayMs}ms`, {
          attempt,
          maxRetries,
          error: error.message,
          code: error.code || error.status
        })

        await this.sleep(delayMs)
      }
    }

    throw lastError
  }

  /**
   * Verifica se o erro é retryable
   */
  private isRetryableError(error: any): boolean {
    // Erro 503 - Service Unavailable / Model Overloaded
    if (error.status === 503 || error.message?.includes('503') || error.message?.includes('overloaded')) {
      return true
    }

    // Erro 429 - Rate Limit
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('429')) {
      return true
    }

    // Timeout
    if (error.code === 'DEADLINE_EXCEEDED' || error.message?.includes('timeout')) {
      return true
    }

    // Erros de conexão
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      return true
    }

    // Service Unavailable genérico
    if (error.message?.includes('UNAVAILABLE') || error.message?.includes('Service Unavailable')) {
      return true
    }

    return false
  }

  /**
   * Helper sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Gera resposta completa (non-streaming) com retry automático
   */
  async generateContent(request: {
    prompt?: string
    systemPrompt?: string
    images?: Array<{ mimeType: string; data: string }>
    tools?: any[]
    conversationHistory?: any[] // ✅ Suporte para tool loop
  }): Promise<{
    content: string
    functionCalls?: any[]
    tokensUsed: TokenUsage
    finishReason: string
  }> {
    return this.withRetry(async () => {
      // Usar conversationHistory se fornecido (tool loop)
      let contents: any[]

      if (request.conversationHistory && request.conversationHistory.length > 0) {
        contents = request.conversationHistory
      } else {
        // Construir contents array (modo tradicional)
        contents = []

        // System prompt (se fornecido)
        if (request.systemPrompt) {
          contents.push({
            role: 'user',
            parts: [{ text: request.systemPrompt }],
          })
          contents.push({
            role: 'model',
            parts: [{ text: 'Entendido. Vou seguir essas instruções.' }],
          })
        }

        // User prompt com imagens (se houver)
        if (request.prompt) {
          const userParts: any[] = [{ text: request.prompt }]

          if (request.images && request.images.length > 0) {
            request.images.forEach((image) => {
              userParts.push({
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.data,
                },
              })
            })
          }

          contents.push({
            role: 'user',
            parts: userParts,
          })
        }
      }

      // Construir request params (SDK @google/genai v1.30.0)
      const requestParams: any = {
        model: this.model,
        contents,
        config: this.getGenerationConfig(), // ✅ 'config' não 'generationConfig'
      }

      if (request.tools && request.tools.length > 0) {
        requestParams.tools = request.tools
      }

      // Chamar API
      const result = await this.client.models.generateContent(requestParams)

      // Extrair informações (são propriedades, não métodos)
      const content = result.text || ''
      const functionCalls = result.functionCalls || undefined
      const usageMetadata = result.usageMetadata

      // Calcular custo
      const tokensUsed = this.calculateTokenUsage(usageMetadata)

      logger.info('[GeminiClient] Content generated', {
        contentLength: content.length,
        tokensUsed: tokensUsed.totalTokens,
        cost: tokensUsed.cost,
        hasFunctionCalls: !!functionCalls && functionCalls.length > 0,
      })

      return {
        content,
        functionCalls: functionCalls as any,
        tokensUsed,
        finishReason: (result as any).candidates?.[0]?.finishReason || 'STOP',
      }
    }, 'generateContent')
  }

  /**
   * Gera resposta com streaming token-by-token (com retry na inicialização)
   */
  async *streamContent(request: {
    prompt: string
    systemPrompt?: string
    images?: Array<{ mimeType: string; data: string }>
    tools?: any[]
  }): AsyncGenerator<GeminiStreamChunk, void, unknown> {
    // Construir contents (mesmo formato do generateContent)
    const contents: any[] = []

    if (request.systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: request.systemPrompt }],
      })
      contents.push({
        role: 'model',
        parts: [{ text: 'Entendido. Vou seguir essas instruções.' }],
      })
    }

    const userParts: any[] = [{ text: request.prompt }]

    if (request.images && request.images.length > 0) {
      request.images.forEach((image) => {
        userParts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        })
      })
    }

    contents.push({
      role: 'user',
      parts: userParts,
    })

    const requestParams: any = {
      model: this.model,
      contents,
      config: this.getGenerationConfig(),
    }

    if (request.tools && request.tools.length > 0) {
      requestParams.tools = request.tools
    }

    // Iniciar stream com retry automático
    const stream = await this.withRetry(
      () => this.client.models.generateContentStream(requestParams),
      'streamContent:init'
    )

    let totalTokens = 0

    try {
      // Iterar sobre stream (o próprio stream é o iterator)
      for await (const chunk of stream) {
        const text = chunk.text || undefined
        const functionCalls = chunk.functionCalls || undefined
        const usageMetadata = chunk.usageMetadata || undefined

        if (usageMetadata) {
          totalTokens = usageMetadata.totalTokenCount || 0
        }

        const streamChunk: GeminiStreamChunk = {
          text,
          functionCalls: functionCalls as any,
          finishReason: (chunk as any).candidates?.[0]?.finishReason as any,
          usageMetadata: usageMetadata as any,
        }

        yield streamChunk
      }

      logger.info('[GeminiClient] Streaming completed', { totalTokens })
    } catch (error: any) {
      // Se erro durante streaming, verificar se é retryable e logar
      const isRetryable = this.isRetryableError(error)
      logger.error('[GeminiClient] Error during streaming', {
        error: error.message,
        isRetryable,
        totalTokensBeforeError: totalTokens
      })
      throw this.handleError(error)
    }
  }

  /**
   * Retorna configuração de geração padrão (SDK @google/genai compliant)
   */
  private getGenerationConfig(useStructuredOutput = false): any {
    const config: any = {
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
    }

    // thinkingConfig apenas para Gemini 3.x (opcional)
    if (this.model.includes('gemini-3') && this.config.thinkingLevel !== 'default') {
      config.thinkingConfig = {
        thinkingLevel: this.config.thinkingLevel,
      }
    }

    // Structured output
    if (useStructuredOutput) {
      config.responseMimeType = 'application/json'
    }

    return config
  }

  /**
   * Gera resposta com structured output (JSON Schema) com retry automático
   */
  async generateStructuredContent(request: {
    prompt: string
    systemPrompt?: string
    responseSchema: any // JSON Schema
    images?: Array<{ mimeType: string; data: string }>
  }): Promise<{
    content: any // Parsed JSON
    rawText: string
    tokensUsed: TokenUsage
    finishReason: string
  }> {
    return this.withRetry(async () => {
      logger.info('[GeminiClient] Generating structured content', {
        hasSchema: !!request.responseSchema,
      })

      // Construir contents
      const contents: any[] = []

      if (request.systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: request.systemPrompt }],
        })
        contents.push({
          role: 'model',
          parts: [{ text: 'Entendido. Vou seguir essas instruções e retornar JSON válido.' }],
        })
      }

      const userParts: any[] = [{ text: request.prompt }]

      if (request.images && request.images.length > 0) {
        request.images.forEach((image) => {
          userParts.push({
            inlineData: {
              mimeType: image.mimeType,
              data: image.data,
            },
          })
        })
      }

      contents.push({
        role: 'user',
        parts: userParts,
      })

      // Request com structured output (SDK compliant)
      const requestParams: any = {
        model: this.model,
        contents,
        config: {
          ...this.getGenerationConfig(true),
          responseJsonSchema: request.responseSchema, // ✅ responseJsonSchema para SDK JS
        },
      }

      // Chamar API
      const result = await this.client.models.generateContent(requestParams)

      const rawText = result.text || ''
      let parsedContent: any

      try {
        parsedContent = JSON.parse(rawText)
      } catch (parseError) {
        logger.error('[GeminiClient] Failed to parse JSON response', {
          rawText: rawText.substring(0, 200),
        })
        throw new Error('Invalid JSON response from Gemini')
      }

      const tokensUsed = this.calculateTokenUsage(result.usageMetadata)

      logger.info('[GeminiClient] Structured content generated', {
        tokensUsed: tokensUsed.totalTokens,
        cost: tokensUsed.cost,
      })

      return {
        content: parsedContent,
        rawText,
        tokensUsed,
        finishReason: (result as any).candidates?.[0]?.finishReason || 'STOP',
      }
    }, 'generateStructuredContent')
  }

  /**
   * Calcula uso de tokens e custo
   */
  private calculateTokenUsage(usageMetadata: any): TokenUsage {
    const inputTokens = usageMetadata?.promptTokenCount || 0
    const outputTokens = usageMetadata?.candidatesTokenCount || 0
    const totalTokens = usageMetadata?.totalTokenCount || inputTokens + outputTokens

    // Pricing Gemini 3.0 Pro (até 200k context)
    // Input: $2.00 / 1M tokens
    // Output: $12.00 / 1M tokens
    const inputCost = (inputTokens / 1_000_000) * 2.0
    const outputCost = (outputTokens / 1_000_000) * 12.0
    const totalCost = inputCost + outputCost

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      cost: totalCost,
    }
  }

  /**
   * Trata erros da API Gemini
   */
  private handleError(error: any): AgentError {
    let errorType: AgentError['type'] = 'model_error'
    let retryable = false

    // Classificar erro
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('429')) {
      errorType = 'rate_limit_error'
      retryable = true
    } else if (error.status === 503 || error.message?.includes('503') || error.message?.includes('overloaded') || error.message?.includes('UNAVAILABLE')) {
      // 🔴 FIX: Erro 503 (Model Overloaded) é retryable
      errorType = 'model_error'
      retryable = true
    } else if (error.code === 'DEADLINE_EXCEEDED' || error.message?.includes('timeout')) {
      errorType = 'timeout_error'
      retryable = true
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      // Erros de conexão são retryable
      errorType = 'timeout_error'
      retryable = true
    } else if (error.status === 400) {
      errorType = 'validation_error'
      retryable = false
    }

    return {
      code: error.code || error.status?.toString() || 'UNKNOWN',
      message: error.message || 'Unknown Gemini API error',
      type: errorType,
      retryable,
      timestamp: Date.now(),
      stack: error.stack,
    }
  }

  /**
   * Valida se o cliente está configurado corretamente
   */
  async validateConnection(): Promise<boolean> {
    try {
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello' }],
          },
        ],
        config: {
          maxOutputTokens: 10,
        },
      })

      const text = result.text || ''

      logger.info('[GeminiClient] Connection validated', {
        responseLength: text.length,
      })

      return true
    } catch (error: any) {
      logger.error('[GeminiClient] Connection validation failed', {
        error: error.message,
      })

      return false
    }
  }
}

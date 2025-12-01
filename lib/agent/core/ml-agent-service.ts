/**
 * ML Agent Service - Serviço principal do agente de IA
 * Orquestra Gemini 3.0 Pro + LangGraph + Tools + Memory
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import { GeminiClient } from './gemini-client'
import { ToolRegistry, toolRegistry } from '../tools/tool-registry'
import { createAgentWorkflow, invokeAgentWorkflow } from './langgraph-workflow'
import { ContextManager } from '../memory/context-manager'
import { LearningSystem } from '../memory/learning-system'
import { processWithStructuredOutput } from '../streaming/stream-processor'
import { getAllMercadoLibreTools } from '../tools/mercadolibre-tools'
import { getAllMemoryTools } from '../tools/memory-tools'
import {
  getOptimizedAttendancePrompt,
  getOptimizedRevisionPrompt,
  formatOptimizedAttendanceMessage,
  formatOptimizedRevisionMessage,
} from './optimized-prompts'
import {
  executeToolLoop,
  DEFAULT_TOOL_EXECUTION_CONFIG,
  type ToolExecutionConfig,
} from './tool-execution-loop'
import type {
  AgentConfig,
  AgentResponse,
  QuestionInput,
  QuestionContext,
  ToolContext,
} from '../types/agent-types'

/**
 * Serviço principal do agente de atendimento
 */
export class MLAgentService {
  private geminiClient: GeminiClient
  private workflow: ReturnType<typeof createAgentWorkflow>
  private toolRegistry: ToolRegistry
  private contextManager: ContextManager
  private learningSystem: LearningSystem
  private config: AgentConfig

  constructor(config: AgentConfig) {
    this.config = config

    logger.info('[MLAgentService] Initializing', {
      model: config.model,
      autoApprove: config.autoApprove,
      enableStreaming: config.enableStreaming,
      enableLearning: config.enableLearning,
    })

    // Inicializar componentes
    this.geminiClient = new GeminiClient(config)
    this.toolRegistry = toolRegistry
    this.contextManager = new ContextManager()
    this.learningSystem = new LearningSystem()

    // Registrar todas as tools
    const allTools = [...getAllMercadoLibreTools(), ...getAllMemoryTools()]
    this.toolRegistry.registerMany(allTools)

    logger.info('[MLAgentService] Tools registered', {
      count: allTools.length,
      tools: allTools.map((t) => t.name),
    })

    // Criar workflow LangGraph
    this.workflow = createAgentWorkflow(this.geminiClient, this.toolRegistry)

    logger.info('[MLAgentService] Service initialized successfully')
  }

  /**
   * Processa pergunta no modo ATENDIMENTO
   */
  async processQuestion(params: {
    questionInput: QuestionInput
    context: QuestionContext
  }): Promise<AgentResponse> {
    try {
      logger.info('[MLAgentService] Processing question', {
        questionId: params.questionInput.mlQuestionId,
        mode: 'attendance',
      })

      // Preparar dados para o workflow
      const workflowInput = {
        mode: 'attendance' as const,
        questionText: params.questionInput.text,
        productInfo: this.contextManager.buildContext({
          productInfo: params.context.productDescription || '',
        }),
        buyerHistory: this.formatBuyerHistory(params.context.buyerHistory),
        sellerNickname: params.context.sellerNickname,
      }

      // Executar workflow
      const response = await invokeAgentWorkflow(this.workflow, workflowInput)

      logger.info('[MLAgentService] Question processed', {
        questionId: params.questionInput.mlQuestionId,
        confidence: response.confidence,
        tokensUsed: response.tokensUsed.totalTokens,
      })

      return response
    } catch (error: any) {
      logger.error('[MLAgentService] Error processing question', {
        questionId: params.questionInput.mlQuestionId,
        error: error.message,
      })

      throw error
    }
  }

  /**
   * Processa revisão com STRUCTURED OUTPUT + WebSocket Events
   * Usa structured output do Gemini para parsing automático do JSON
   * Emite eventos WebSocket para feedback visual no frontend
   * Injeta padrões aprendidos no system prompt
   */
  async reviseResponseWithStreaming(params: {
    questionId: string
    questionInput: QuestionInput
    context: QuestionContext
    organizationId: string
    originalResponse: string
    revisionFeedback: string
  }): Promise<AgentResponse> {
    try {
      logger.info('[MLAgentService] Revising with structured output + events', {
        questionId: params.questionId,
        feedbackLength: params.revisionFeedback.length,
        organizationId: params.organizationId,
      })

      // ✅ BUSCAR PADRÕES APRENDIDOS
      const learnedPatterns = await this.learningSystem.getRelevantPatterns(
        params.organizationId,
        params.questionInput.text
      )

      logger.info('[MLAgentService] Learned patterns for revision', {
        count: learnedPatterns.length,
        organizationId: params.organizationId,
      })

      // Formatar padrões para o prompt
      const patternsSection = learnedPatterns.length > 0
        ? `\n\n<learned_patterns>\n` +
          `Padrões aprendidos desta organização:\n` +
          learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n') +
          `\n</learned_patterns>\n`
        : ''

      // Construir prompts OTIMIZADOS COM PADRÕES
      const systemPromptBase = getOptimizedRevisionPrompt(params.context.sellerNickname)
        .replace('{product_info}', params.context.productDescription || '')
        .replace('{buyer_questions_history}', this.formatBuyerHistory(params.context.buyerHistory))

      const systemPrompt = systemPromptBase + patternsSection

      const userMessage = formatOptimizedRevisionMessage(
        params.questionInput.text,
        params.originalResponse,
        params.revisionFeedback,
        params.questionInput.dateCreated
      )

      // ✅ Usar STREAMING REAL token-by-token
      const { processWithStreaming } = await import('../streaming/stream-processor')

      const response = await processWithStreaming({
        geminiClient: this.geminiClient,
        questionId: params.questionId,
        organizationId: params.organizationId,
        systemPrompt,
        userMessage,
        sellerNickname: params.context.sellerNickname,
      })

      logger.info('[MLAgentService] Streaming revision completed', {
        questionId: params.questionId,
        confidence: response.confidence,
        answerLength: response.content.length,
        tokensUsed: response.tokensUsed.totalTokens,
      })

      return response
    } catch (error: any) {
      logger.error('[MLAgentService] Revision error', {
        questionId: params.questionId,
        error: error.message,
      })

      throw error
    }
  }

  /**
   * Processa pergunta com STRUCTURED OUTPUT (recomendado para produção)
   */
  async processQuestionWithStructuredOutput(params: {
    questionId: string
    questionInput: QuestionInput
    context: QuestionContext
    organizationId: string
  }): Promise<AgentResponse> {
    try {
      logger.info('[MLAgentService] Processing with structured output', {
        questionId: params.questionId,
        mlQuestionId: params.questionInput.mlQuestionId,
      })

      // Construir prompts OTIMIZADOS
      const systemPrompt = getOptimizedAttendancePrompt(params.context.sellerNickname)
        .replace('{product_info}', params.context.productDescription || '')
        .replace('{buyer_questions_history}', this.formatBuyerHistory(params.context.buyerHistory))

      const userMessage = formatOptimizedAttendanceMessage(
        params.questionInput.text,
        params.questionInput.dateCreated
      )

      // Processar com structured output (validação automática)
      const response = await processWithStructuredOutput({
        geminiClient: this.geminiClient,
        questionId: params.questionId,
        organizationId: params.organizationId,
        systemPrompt,
        userMessage,
        sellerNickname: params.context.sellerNickname,
      })

      logger.info('[MLAgentService] Structured output completed', {
        questionId: params.questionId,
        confidence: response.confidence,
        responseLength: response.content.length,
        tokensUsed: response.tokensUsed.totalTokens,
      })

      return response
    } catch (error: any) {
      logger.error('[MLAgentService] Structured output error', {
        questionId: params.questionId,
        error: error.message,
      })

      throw error
    }
  }

  /**
   * Processa pergunta com STRUCTURED OUTPUT + WebSocket Events
   * Usa structured output do Gemini para parsing automático do JSON
   * Emite eventos WebSocket para feedback visual no frontend
   */
  async processQuestionWithStreaming(params: {
    questionId: string
    questionInput: QuestionInput
    context: QuestionContext
    organizationId: string
  }): Promise<AgentResponse> {
    try {
      logger.info('[MLAgentService] Processing with structured output + events', {
        questionId: params.questionId,
        mlQuestionId: params.questionInput.mlQuestionId,
      })

      // Construir prompts OTIMIZADOS
      const systemPrompt = getOptimizedAttendancePrompt(params.context.sellerNickname)
        .replace('{product_info}', params.context.productDescription || '')
        .replace('{buyer_questions_history}', this.formatBuyerHistory(params.context.buyerHistory))

      const userMessage = formatOptimizedAttendanceMessage(
        params.questionInput.text,
        params.questionInput.dateCreated
      )

      // ✅ Usar STREAMING REAL token-by-token
      const { processWithStreaming } = await import('../streaming/stream-processor')

      const response = await processWithStreaming({
        geminiClient: this.geminiClient,
        questionId: params.questionId,
        organizationId: params.organizationId,
        systemPrompt,
        userMessage,
        sellerNickname: params.context.sellerNickname,
      })

      logger.info('[MLAgentService] Streaming completed', {
        questionId: params.questionId,
        confidence: response.confidence,
        answerLength: response.content.length,
        tokensUsed: response.tokensUsed.totalTokens,
      })

      return response
    } catch (error: any) {
      logger.error('[MLAgentService] Processing error', {
        questionId: params.questionId,
        error: error.message,
      })

      throw error
    }
  }

  /**
   * Processa pergunta COM TOOLS (executeToolLoop)
   * Usa tool execution loop para suportar function calling do Gemini 3 Pro
   * Injeta padrões aprendidos no system prompt
   */
  async processQuestionWithTools(params: {
    questionId: string
    questionInput: QuestionInput
    context: QuestionContext
    organizationId: string
    mlAccountId: string
  }): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      logger.info('[MLAgentService] Processing with tools', {
        questionId: params.questionId,
        mlQuestionId: params.questionInput.mlQuestionId,
        organizationId: params.organizationId,
      })

      // Emitir evento de início (inline para evitar recursão)
      try {
        const websocketEvents = require('@/lib/websocket/emit-events.js')
        await websocketEvents.emitAgentStep(
          params.questionId,
          params.organizationId,
          'enriching_context',
          { status: 'Carregando contexto e padrões aprendidos...' }
        )
      } catch (wsError) {
        logger.warn('[MLAgentService] WebSocket emit failed (non-fatal)', { error: wsError })
      }

      // ✅ BUSCAR PADRÕES APRENDIDOS DA ORGANIZAÇÃO
      const learnedPatterns = await this.learningSystem.getRelevantPatterns(
        params.organizationId,
        params.questionInput.text
      )

      logger.info('[MLAgentService] Learned patterns loaded', {
        count: learnedPatterns.length,
        organizationId: params.organizationId,
      })

      // Formatar padrões para o prompt
      const patternsSection = learnedPatterns.length > 0
        ? `\n\n<learned_patterns>\n` +
          `Com base em feedbacks anteriores desta organização:\n` +
          learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n') +
          `\n</learned_patterns>\n`
        : ''

      // Construir prompts otimizados COM PADRÕES APRENDIDOS
      const systemPromptBase = getOptimizedAttendancePrompt(params.context.sellerNickname)
        .replace('{product_info}', params.context.productDescription || '')
        .replace('{buyer_questions_history}', this.formatBuyerHistory(params.context.buyerHistory))

      const systemPrompt = systemPromptBase + patternsSection

      const userMessage = formatOptimizedAttendanceMessage(
        params.questionInput.text,
        params.questionInput.dateCreated
      )

      // Preparar tool context
      const { getValidMLToken } = await import('@/lib/ml-api/token-manager')
      const accessToken = await getValidMLToken(params.mlAccountId)

      if (!accessToken) {
        throw new Error('No valid access token for ML account')
      }

      const toolContext: ToolContext = {
        mlAccountId: params.mlAccountId,
        organizationId: params.organizationId,
        accessToken,
        sessionId: params.questionId,
      }

      try {
        const websocketEvents = require('@/lib/websocket/emit-events.js')
        await websocketEvents.emitAgentStep(
          params.questionId,
          params.organizationId,
          'calling_tools',
          { status: 'Executando tools e gerando resposta com Gemini 3.0 Pro...' }
        )
      } catch (wsError) {
        logger.warn('[MLAgentService] WebSocket emit failed (non-fatal)', { error: wsError })
      }

      // ✅ STREAMING: Configurar callback para emitir tokens via WebSocket
      const onTokenCallback = async (token: string, seq: number) => {
        try {
          console.log(`🔥🔥🔥 [MLAgentService] EMITTING TOKEN #${seq}`, {
            questionId: params.questionId,
            organizationId: params.organizationId,
            tokenPreview: token.substring(0, 30),
            tokenLength: token.length
          })

          const websocketEvents = require('@/lib/websocket/emit-events.js')
          await websocketEvents.emitAgentToken(
            params.questionId,
            params.organizationId,
            token,
            seq
          )

          console.log(`✅ [MLAgentService] Token #${seq} emitted successfully`)

          logger.debug('[MLAgentService] Token emitted via WebSocket', {
            questionId: params.questionId,
            sequence: seq,
            tokenLength: token.length
          })
        } catch (emitError) {
          console.error(`❌ [MLAgentService] Token emission FAILED:`, emitError)
          logger.warn('[MLAgentService] Token emission failed (non-fatal)', { error: emitError })
        }
      }

      // Executar tool loop COM STREAMING HABILITADO
      const toolConfig: ToolExecutionConfig = {
        ...DEFAULT_TOOL_EXECUTION_CONFIG,
        maxIterations: 10, // Escape hatch
        enableStreaming: true, // ✅ Habilitar streaming token-by-token
        onToken: onTokenCallback, // ✅ Callback para emitir tokens
      }

      const toolLoopResult = await executeToolLoop(
        this.geminiClient,
        this.toolRegistry,
        toolContext,
        systemPrompt,
        userMessage,
        toolConfig
      )

      if (!toolLoopResult.success) {
        throw new Error(toolLoopResult.error || 'Tool loop failed')
      }

      const processingTime = Date.now() - startTime

      // Validar resposta
      const { processWithStreaming } = await import('../streaming/stream-processor')
      const validation = (processWithStreaming as any).validateResponse
        ? (processWithStreaming as any).validateResponse(toolLoopResult.finalResponse)
        : { confidence: 0.75, isComplete: true, isRelevant: true, isAccurate: true, reasoning: 'Tool loop completed' }

      // Construir AgentResponse
      const response: AgentResponse = {
        content: toolLoopResult.finalResponse,
        confidence: validation.confidence,
        isComplete: validation.isComplete,
        isRelevant: validation.isRelevant,
        isAccurate: validation.isAccurate,
        reasoning: `Tool loop: ${toolLoopResult.iterations} iterations, ${toolLoopResult.toolsExecuted.length} tools used`,
        toolsUsed: toolLoopResult.toolsExecuted.map((tc) => tc.name),
        generatedAt: new Date(),
        tokensUsed: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: toolLoopResult.totalTokensUsed,
          cost: (toolLoopResult.totalTokensUsed / 1_000_000) * 12.0,
        },
        processingTime,
        structuredData: null,
      }

      // Emitir conclusão (inline para evitar recursão)
      try {
        const websocketEvents = require('@/lib/websocket/emit-events.js')

        await websocketEvents.emitAgentConfidence(
          params.questionId,
          params.organizationId,
          validation.confidence
        )

        await websocketEvents.emitAgentDone(
          params.questionId,
          params.organizationId,
          toolLoopResult.finalResponse,
          validation.confidence,
          processingTime,
          toolLoopResult.totalTokensUsed
        )

        // Sincronizar UI
        await websocketEvents.emitQuestionUpdate(
          params.questionInput.mlQuestionId,
          'AWAITING_APPROVAL',
          {
            organizationId: params.organizationId,
            mlQuestionId: params.questionInput.mlQuestionId,
            questionId: params.questionId,
            aiSuggestion: toolLoopResult.finalResponse,
            aiConfidence: validation.confidence,
            data: {
              aiSuggestion: toolLoopResult.finalResponse,
              aiConfidence: validation.confidence,
              aiProcessedAt: new Date().toISOString(),
              status: 'AWAITING_APPROVAL',
              tokensUsed: toolLoopResult.totalTokensUsed,
              processingTime,
              toolsUsed: toolLoopResult.toolsExecuted.length,
            },
          }
        )
      } catch (wsError) {
        logger.warn('[MLAgentService] WebSocket emit failed (non-fatal)', { error: wsError })
      }

      logger.info('[MLAgentService] Tools processing completed', {
        questionId: params.questionId,
        iterations: toolLoopResult.iterations,
        toolsUsed: toolLoopResult.toolsExecuted.length,
        confidence: validation.confidence,
        tokensUsed: toolLoopResult.totalTokensUsed,
        processingTime,
      })

      return response
    } catch (error: any) {
      logger.error('[MLAgentService] Tools processing error', {
        questionId: params.questionId,
        error: error.message,
      })

      throw error
    }
  }

  /**
   * Salva feedback de edição manual para aprendizado
   */
  async saveFeedback(params: {
    questionId: string
    originalResponse: string
    finalResponse: string
    organizationId: string
    mlAccountId: string
    userId: string
  }): Promise<void> {
    try {
      logger.info('[MLAgentService] Saving feedback for learning', {
        questionId: params.questionId,
      })

      await this.learningSystem.processFeedback({
        questionId: params.questionId,
        originalResponse: params.originalResponse,
        finalResponse: params.finalResponse,
        feedbackType: 'edit',
        organizationId: params.organizationId,
        mlAccountId: params.mlAccountId,
        createdBy: params.userId,
      })

      logger.info('[MLAgentService] Feedback saved successfully', {
        questionId: params.questionId,
      })
    } catch (error: any) {
      logger.error('[MLAgentService] Error saving feedback', {
        questionId: params.questionId,
        error: error.message,
      })
    }
  }

  /**
   * Valida conexão com Gemini API
   */
  async validateConnection(): Promise<boolean> {
    try {
      return await this.geminiClient.validateConnection()
    } catch (error: any) {
      logger.error('[MLAgentService] Connection validation failed', {
        error: error.message,
      })

      return false
    }
  }

  /**
   * Formata histórico do comprador
   */
  private formatBuyerHistory(history: any[]): string {
    if (!history || history.length === 0) {
      return 'HISTÓRICO DO COMPRADOR: Primeira interação deste cliente com nossa loja.'
    }

    const lines: string[] = []
    lines.push('HISTÓRICO DE PERGUNTAS ANTERIORES DO COMPRADOR')
    lines.push('-'.repeat(50))
    lines.push('')

    history.forEach((q, index) => {
      const date = new Date(q.dateCreated)
      const dateStr = date.toLocaleString('pt-BR')

      lines.push(`Pergunta ${index + 1} (${dateStr}):`)
      lines.push(`Cliente: "${q.text}"`)

      if (q.answer) {
        lines.push(`Resposta: "${q.answer}"`)
      } else {
        lines.push(`Resposta: Ainda não respondida`)
      }

      lines.push('')
    })

    return lines.join('\n')
  }

  /**
   * Retorna estatísticas do agente
   */
  getStatistics() {
    return {
      tools: this.toolRegistry.getAllStats(),
      config: {
        model: this.config.model,
        autoApprove: this.config.autoApprove,
        enableStreaming: this.config.enableStreaming,
        enableLearning: this.config.enableLearning,
      },
    }
  }
}

/**
 * Factory function para criar instância do serviço
 * @param customConfig - Configuração customizada (opcional)
 */
export function createMLAgentService(customConfig?: Partial<AgentConfig>): MLAgentService {
  const baseConfig: AgentConfig = {
    geminiApiKey: process.env['GEMINI_API_KEY'] || '',
    model: process.env['GEMINI_MODEL'] || 'gemini-3-pro-preview-11-2025',
    temperature: 1.0, // ⚠️ CRÍTICO: Gemini 3 requer 1.0 (não mudar!)
    maxOutputTokens: parseInt(process.env['GEMINI_MAX_OUTPUT_TOKENS'] || '8192'),
    thinkingLevel: 'high', // ✅ High para reasoning complexo
    mediaResolution: 'media_resolution_high',

    autoApprove: process.env['AGENT_AUTO_APPROVE'] === 'true',
    confidenceThresholdAuto: parseFloat(process.env['AGENT_CONFIDENCE_THRESHOLD_AUTO'] || '0.95'),
    confidenceThresholdReview: parseFloat(
      process.env['AGENT_CONFIDENCE_THRESHOLD_REVIEW'] || '0.60'
    ),
    maxRetries: parseInt(process.env['AGENT_MAX_RETRIES'] || '3'),

    enableStreaming: true, // ✅ Sempre ativo
    enableLearning: true, // ✅ Sempre ativo

    langsmithApiKey: process.env['LANGSMITH_API_KEY'] || '',
    langsmithProject: process.env['LANGSMITH_PROJECT'] || 'ml-agent-production',
  }

  // Merge com config customizado
  const config: AgentConfig = customConfig ? { ...baseConfig, ...customConfig } : baseConfig

  return new MLAgentService(config)
}

// Export singleton instance (DEPRECATED - usar MLAgentServiceManager)
// @deprecated Use getMLAgentServiceForOrganization() do ml-agent-service-manager.ts
export const mlAgentService = createMLAgentService()

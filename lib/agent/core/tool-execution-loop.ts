/**
 * Tool Execution Loop - Gemini 3 Pro Compliant
 * Implementa loop de execução de tools com Thought Signatures
 *
 * FEATURES:
 * - Thought Signatures: Captura e retorna signatures conforme Gemini 3 Pro
 * - Parallel Execution: Executa múltiplas tools simultaneamente
 * - Escape Hatch: Max iterations para evitar loops infinitos
 *
 * @see https://ai.google.dev/gemini-api/docs/function-calling
 * @author ML Agent Team
 * @date 2025-11-21
 */

import { logger } from '@/lib/logger'
import { GeminiClient } from './gemini-client'
import { ToolRegistry } from '../tools/tool-registry'
import type {
  ToolCall,
  ToolResult,
  ToolContext,
  GeminiContent,
  GeminiPart,
} from '../types/agent-types'

/**
 * Configuração do loop
 */
export interface ToolExecutionConfig {
  maxIterations: number
  parallelExecution: boolean
  enableStreaming?: boolean // ✅ Habilita streaming token-by-token
  onToken?: (token: string, sequenceNumber: number) => Promise<void> // ✅ Callback para tokens
}

/**
 * Resultado do loop
 */
export interface ToolExecutionResult {
  success: boolean
  finalResponse: string
  iterations: number
  toolsExecuted: ToolCall[]
  toolResults: ToolResult[]
  totalTokensUsed: number
  error?: string
}

/**
 * Thought signature storage (Gemini 3 Pro requirement)
 */
interface ThoughtSignature {
  signature: string
  callIndex: number
  timestamp: number
}

/**
 * Executa loop de tools até conclusão ou max iterations
 */
export async function executeToolLoop(
  geminiClient: GeminiClient,
  toolRegistry: ToolRegistry,
  toolContext: ToolContext,
  systemPrompt: string,
  initialUserMessage: string,
  config: ToolExecutionConfig
): Promise<ToolExecutionResult> {
  let iteration = 0
  let totalTokensUsed = 0
  const allToolCalls: ToolCall[] = []
  const allToolResults: ToolResult[] = []
  const thoughtSignatures: ThoughtSignature[] = []

  // Histórico de conversação (mantém contexto)
  const conversationHistory: GeminiContent[] = []

  // System prompt inicial
  conversationHistory.push({
    role: 'user',
    parts: [{ text: systemPrompt }],
  })
  conversationHistory.push({
    role: 'model',
    parts: [{ text: 'Entendido. Vou seguir essas instruções e usar as tools disponíveis quando necessário.' }],
  })

  // User message inicial
  conversationHistory.push({
    role: 'user',
    parts: [{ text: initialUserMessage }],
  })

  logger.info('[ToolLoop] Starting', {
    maxIterations: config.maxIterations,
    availableTools: toolRegistry.getAllTools().length,
    organizationId: toolContext.organizationId,
  })

  // LOOP PRINCIPAL
  while (iteration < config.maxIterations) {
    iteration++

    logger.info('[ToolLoop] Iteration', {
      iteration,
      maxIterations: config.maxIterations,
      historyLength: conversationHistory.length,
    })

    try {
      // 1️⃣ CHAMAR GEMINI COM CONVERSATION HISTORY
      // 🔄 STREAMING: Se habilitado e sem tools pendentes, usar streaming
      const shouldStream = config.enableStreaming && iteration === 1 // Apenas primeira iteração

      let geminiResponse: any
      let streamedContent = ''
      let sequenceNumber = 0

      if (shouldStream) {
        logger.info('[ToolLoop] Using STREAMING mode', { iteration })

        // Criar stream request
        const lastUserMessage = conversationHistory[conversationHistory.length - 1]
        if (!lastUserMessage || lastUserMessage.role !== 'user') {
          throw new Error('Last message must be from user for streaming')
        }

        const userPart = lastUserMessage.parts.find((p: GeminiPart) => 'text' in p) as { text: string } | undefined
        const userText = userPart?.text || ''

        // Extrair system prompt (primeira mensagem user)
        const systemMsg = conversationHistory.find((m: any) => m.role === 'user')
        const systemPart = systemMsg?.parts.find((p: GeminiPart) => 'text' in p) as { text: string } | undefined
        const systemText = systemPart?.text || ''

        // Stream content
        const stream = geminiClient.streamContent({
          systemPrompt: systemText,
          prompt: userText,
          tools: toolRegistry.getGeminiFunctionDeclarations(),
        })

        let hasToolCalls = false
        let usageMetadata: any = null

        for await (const chunk of stream) {
          // Se houver function calls, parar streaming e processar normalmente
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            hasToolCalls = true
            logger.info('[ToolLoop] Function calls detected during streaming, switching to tool execution mode')
            break
          }

          // Processar texto
          if (chunk.text) {
            streamedContent += chunk.text
            sequenceNumber++

            console.log(`🎯 [ToolLoop] CHUNK RECEIVED #${sequenceNumber}`, {
              chunkLength: chunk.text.length,
              chunkPreview: chunk.text.substring(0, 50),
              hasOnTokenCallback: !!config.onToken
            })

            // Emitir token via callback
            if (config.onToken) {
              try {
                console.log(`🔥 [ToolLoop] Calling onToken callback for #${sequenceNumber}`)
                await config.onToken(chunk.text, sequenceNumber)
                console.log(`✅ [ToolLoop] onToken callback completed for #${sequenceNumber}`)
              } catch (tokenError) {
                console.error(`❌ [ToolLoop] Token emission FAILED:`, tokenError)
                logger.warn('[ToolLoop] Token emission failed (non-fatal)', { error: tokenError })
              }
            } else {
              console.warn(`⚠️ [ToolLoop] NO onToken callback configured - tokens NOT being emitted!`)
            }
          }

          // Atualizar usage
          if (chunk.usageMetadata) {
            usageMetadata = chunk.usageMetadata
          }

          // Finish reason
          if (chunk.finishReason === 'STOP') {
            logger.info('[ToolLoop] Streaming completed with STOP', {
              contentLength: streamedContent.length,
              tokensStreamed: sequenceNumber
            })
          }
        }

        // Se houve tool calls durante streaming, fazer request normal
        if (hasToolCalls) {
          logger.info('[ToolLoop] Re-requesting with generateContent due to tool calls')
          geminiResponse = await geminiClient.generateContent({
            conversationHistory,
            tools: toolRegistry.getGeminiFunctionDeclarations(),
          })
        } else {
          // Construir response manualmente do stream
          geminiResponse = {
            content: streamedContent,
            functionCalls: undefined,
            tokensUsed: {
              inputTokens: usageMetadata?.promptTokenCount || 0,
              outputTokens: usageMetadata?.candidatesTokenCount || 0,
              totalTokens: usageMetadata?.totalTokenCount || 0,
              cost: 0,
            },
            finishReason: 'STOP',
          }
        }
      } else {
        // Modo normal (sem streaming)
        geminiResponse = await geminiClient.generateContent({
          conversationHistory, // ✅ Passar todo o histórico
          tools: toolRegistry.getGeminiFunctionDeclarations(),
        })
      }

      totalTokensUsed += geminiResponse.tokensUsed.totalTokens

      const modelParts: GeminiPart[] = []

      // Adicionar texto (se houver)
      if (geminiResponse.content && geminiResponse.content.length > 0) {
        modelParts.push({ text: geminiResponse.content })
      }

      // 2️⃣ PROCESSAR FUNCTION CALLS
      if (geminiResponse.functionCalls && geminiResponse.functionCalls.length > 0) {
        logger.info('[ToolLoop] Function calls received', {
          count: geminiResponse.functionCalls.length,
          tools: geminiResponse.functionCalls.map((fc: any) => fc.name),
        })

        // Processar cada function call
        geminiResponse.functionCalls.forEach((fc: any, index: number) => {
          // Adicionar ao history
          modelParts.push({
            functionCall: {
              name: fc.name,
              args: fc.args,
            },
          })

          // ⚠️ THOUGHT SIGNATURE: Capturar se existir
          // Gemini 3 Pro retorna signature apenas no PRIMEIRO function call
          if (index === 0 && (fc as any).thoughtSignature) {
            thoughtSignatures.push({
              signature: (fc as any).thoughtSignature,
              callIndex: allToolCalls.length,
              timestamp: Date.now(),
            })

            logger.debug('[ToolLoop] Thought signature captured', {
              iteration,
              signatureIndex: thoughtSignatures.length - 1,
            })
          }

          // Criar ToolCall
          allToolCalls.push({
            id: `call_${Date.now()}_${index}`,
            name: fc.name,
            parameters: fc.args,
            timestamp: Date.now(),
          })
        })

        // Adicionar model parts ao history
        conversationHistory.push({
          role: 'model',
          parts: modelParts,
        })

        // 3️⃣ EXECUTAR TOOLS
        const toolCalls = allToolCalls.slice(-geminiResponse.functionCalls.length)

        let toolResults: ToolResult[]

        if (config.parallelExecution) {
          // Parallel execution (mais rápido)
          toolResults = await Promise.all(
            toolCalls.map((tc) => toolRegistry.executeTool(tc, toolContext))
          )
        } else {
          // Sequential execution
          toolResults = []
          for (const tc of toolCalls) {
            const result = await toolRegistry.executeTool(tc, toolContext)
            toolResults.push(result)
          }
        }

        allToolResults.push(...toolResults)

        logger.info('[ToolLoop] Tools executed', {
          count: toolResults.length,
          successful: toolResults.filter((r) => r.status === 'success').length,
          failed: toolResults.filter((r) => r.status === 'error').length,
        })

        // 4️⃣ RETORNAR RESULTS AO GEMINI
        const functionResponseParts: GeminiPart[] = []

        // ⚠️ CRITICAL: Retornar thought signature se houver
        if (thoughtSignatures.length > 0) {
          const latestSignature = thoughtSignatures[thoughtSignatures.length - 1]!

          functionResponseParts.push({
            functionResponse: {
              name: '__thought_signature__',
              response: {
                signature: latestSignature.signature,
              },
            },
          })

          logger.debug('[ToolLoop] Returning thought signature', {
            signatureIndex: thoughtSignatures.length - 1,
            iteration,
          })
        }

        // Adicionar results das tools (manter ORDEM EXATA)
        toolResults.forEach((result) => {
          functionResponseParts.push({
            functionResponse: {
              name: result.toolName,
              response: result.status === 'success' ? result.result : {
                error: result.error,
                status: 'error',
              },
            },
          })
        })

        // Adicionar function responses ao history
        conversationHistory.push({
          role: 'function',
          parts: functionResponseParts,
        })

        // ♻️ CONTINUAR LOOP (Gemini vai processar results)
        continue
      }

      // 5️⃣ SEM FUNCTION CALLS = RESPOSTA FINAL
      if (geminiResponse.finishReason === 'STOP') {
        logger.info('[ToolLoop] Completed', {
          iteration,
          responseLength: geminiResponse.content.length,
          totalToolsUsed: allToolCalls.length,
        })

        return {
          success: true,
          finalResponse: geminiResponse.content,
          iterations: iteration,
          toolsExecuted: allToolCalls,
          toolResults: allToolResults,
          totalTokensUsed,
        }
      }

      // 6️⃣ FINISH REASON INESPERADO
      logger.warn('[ToolLoop] Unexpected finish reason', {
        finishReason: geminiResponse.finishReason,
        iteration,
      })

      return {
        success: false,
        finalResponse: geminiResponse.content || '',
        iterations: iteration,
        toolsExecuted: allToolCalls,
        toolResults: allToolResults,
        totalTokensUsed,
        error: `Unexpected finish reason: ${geminiResponse.finishReason}`,
      }
    } catch (error: any) {
      logger.error('[ToolLoop] Error in iteration', {
        iteration,
        error: error.message,
      })

      return {
        success: false,
        finalResponse: '',
        iterations: iteration,
        toolsExecuted: allToolCalls,
        toolResults: allToolResults,
        totalTokensUsed,
        error: error.message,
      }
    }
  }

  // 7️⃣ MAX ITERATIONS REACHED (ESCAPE HATCH)
  logger.warn('[ToolLoop] Max iterations reached', {
    maxIterations: config.maxIterations,
    toolsExecuted: allToolCalls.length,
  })

  return {
    success: false,
    finalResponse: '',
    iterations: config.maxIterations,
    toolsExecuted: allToolCalls,
    toolResults: allToolResults,
    totalTokensUsed,
    error: `Max iterations (${config.maxIterations}) reached`,
  }
}

/**
 * Default config
 */
export const DEFAULT_TOOL_EXECUTION_CONFIG: ToolExecutionConfig = {
  maxIterations: 10,
  parallelExecution: true,
  enableStreaming: false, // ✅ Desabilitado por padrão (opt-in)
}

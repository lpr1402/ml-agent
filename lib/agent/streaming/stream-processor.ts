/**
 * Stream Processor - Processa streaming do Gemini e emite via WebSocket
 * Com structured output nativo para garantir qualidade
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import { GeminiClient } from '../core/gemini-client'
import {
  emitAgentToken,
  emitAgentStep,
  emitAgentDone,
  emitAgentError,
  emitAgentConfidence,
  emitQuestionUpdate, // 🔴 FIX CRÍTICO: Importar para sincronização com UI
} from '@/lib/websocket/emit-events'
import { AgentResponseJSONSchema, AgentResponseSchema } from '../types/response-schema'
import type { AgentResponse } from '../types/agent-types'

/**
 * Processa com structured output (sem streaming - mais confiável)
 */
export async function processWithStructuredOutput(params: {
  geminiClient: GeminiClient
  questionId: string
  organizationId: string
  systemPrompt: string
  userMessage: string
  sellerNickname: string
}): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    logger.info('[StreamProcessor] Using structured output mode', {
      questionId: params.questionId,
    })

    // Emitir início
    await emitAgentStep(params.questionId, params.organizationId, 'generating', {
      status: 'Gerando resposta estruturada com Gemini 3.0 Pro...',
    })

    // Gerar com structured output
    const result = await params.geminiClient.generateStructuredContent({
      systemPrompt: params.systemPrompt,
      prompt: params.userMessage,
      responseSchema: AgentResponseJSONSchema,
    })

    // Validar com Zod
    const validated = AgentResponseSchema.parse(result.content)

    const processingTime = Date.now() - startTime

    // Emitir confiança
    await emitAgentConfidence(params.questionId, params.organizationId, validated.confidence)

    // Construir resposta
    const response: AgentResponse = {
      content: validated.answer,
      confidence: validated.confidence,
      isComplete: true,
      isRelevant: true,
      isAccurate: validated.confidence >= 0.6,
      reasoning: `Structured output response with confidence ${validated.confidence.toFixed(2)}`,
      toolsUsed: [],
      generatedAt: new Date(),
      tokensUsed: result.tokensUsed,
      processingTime,
      structuredData: null, // Não usado mais
    }

    // Emitir conclusão
    await emitAgentDone(
      params.questionId,
      params.organizationId,
      validated.answer,
      validated.confidence,
      processingTime,
      result.tokensUsed.totalTokens
    )

    // 🔴 FIX CRÍTICO: Emitir question:updated IMEDIATAMENTE após agent:done
    // para sincronização perfeita entre streaming e UI
    await emitQuestionUpdate(
      params.questionId, // mlQuestionId
      'AWAITING_APPROVAL',
      {
        organizationId: params.organizationId,
        mlQuestionId: params.questionId,
        questionId: params.questionId,
        aiSuggestion: validated.answer,
        aiConfidence: validated.confidence,
        data: {
          aiSuggestion: validated.answer,
          aiConfidence: validated.confidence,
          aiProcessedAt: new Date().toISOString(),
          status: 'AWAITING_APPROVAL',
          tokensUsed: result.tokensUsed.totalTokens,
          processingTime
        }
      }
    )

    logger.info('[StreamProcessor] Structured output completed + UI synced', {
      questionId: params.questionId,
      confidence: validated.confidence,
      responseLength: validated.answer.length,
      tokensUsed: result.tokensUsed.totalTokens,
    })

    return response
  } catch (error: any) {
    logger.error('[StreamProcessor] Structured output error', {
      questionId: params.questionId,
      error: error.message,
    })

    await emitAgentError(params.questionId, params.organizationId, error.message, error.code)

    throw error
  }
}

/**
 * Processa streaming do Gemini com emissão de tokens via WebSocket
 * Versão original mantida para compatibilidade
 */
export async function processWithStreaming(params: {
  geminiClient: GeminiClient
  questionId: string
  organizationId: string
  systemPrompt: string
  userMessage: string
  sellerNickname: string
  tools?: any[]
}): Promise<AgentResponse> {
  const startTime = Date.now()
  let fullResponse = ''
  let sequenceNumber = 0
  let totalTokens = 0

  try {
    logger.info('[StreamProcessor] Starting streaming', {
      questionId: params.questionId,
      organizationId: params.organizationId,
    })

    // Emitir início do processamento
    await emitAgentStep(params.questionId, params.organizationId, 'generating', {
      status: 'Gerando resposta com Gemini 3.0 Pro...',
    })

    // Stream do Gemini
    const stream = params.geminiClient.streamContent({
      systemPrompt: params.systemPrompt,
      prompt: params.userMessage,
      tools: params.tools || [],
    })

    for await (const chunk of stream) {
      // Processar texto
      if (chunk.text) {
        fullResponse += chunk.text
        sequenceNumber++

        // ✅ LOG CRÍTICO: Emitindo token
        logger.info('🔥 [StreamProcessor] EMITTING TOKEN', {
          questionId: params.questionId,
          organizationId: params.organizationId,
          sequence: sequenceNumber,
          tokenLength: chunk.text.length,
          token: chunk.text.substring(0, 20) + '...',
        })

        // Emitir token via WebSocket
        await emitAgentToken(
          params.questionId,
          params.organizationId,
          chunk.text,
          sequenceNumber
        )

        logger.info('✅ [StreamProcessor] Token emitted successfully', {
          sequence: sequenceNumber,
        })
      }

      // Atualizar contagem de tokens
      if (chunk.usageMetadata) {
        totalTokens = chunk.usageMetadata.totalTokenCount
      }

      // Se chegou ao fim
      if (chunk.finishReason === 'STOP') {
        logger.info('[StreamProcessor] Stream completed', {
          finishReason: chunk.finishReason,
        })
      }
    }

    const processingTime = Date.now() - startTime

    // Validar resposta
    const validation = validateResponse(fullResponse)

    // Emitir confiança
    await emitAgentConfidence(params.questionId, params.organizationId, validation.confidence)

    // Construir resposta completa
    const response: AgentResponse = {
      content: fullResponse,
      confidence: validation.confidence,
      isComplete: validation.isComplete,
      isRelevant: validation.isRelevant,
      isAccurate: validation.isAccurate,
      reasoning: validation.reasoning,
      toolsUsed: [],
      generatedAt: new Date(),
      tokensUsed: {
        inputTokens: 0,
        outputTokens: totalTokens,
        totalTokens,
        cost: (totalTokens / 1_000_000) * 12.0, // $12/1M tokens output
      },
      processingTime,
      structuredData: null,
    }

    // Emitir conclusão
    await emitAgentDone(
      params.questionId,
      params.organizationId,
      fullResponse,
      validation.confidence,
      processingTime,
      totalTokens
    )

    // 🔴 FIX CRÍTICO: Emitir question:updated IMEDIATAMENTE após agent:done
    // para sincronização perfeita entre streaming e UI
    await emitQuestionUpdate(
      params.questionId, // mlQuestionId
      'AWAITING_APPROVAL',
      {
        organizationId: params.organizationId,
        mlQuestionId: params.questionId,
        questionId: params.questionId,
        aiSuggestion: fullResponse,
        aiConfidence: validation.confidence,
        data: {
          aiSuggestion: fullResponse,
          aiConfidence: validation.confidence,
          aiProcessedAt: new Date().toISOString(),
          status: 'AWAITING_APPROVAL',
          tokensUsed: totalTokens,
          processingTime
        }
      }
    )

    logger.info('[StreamProcessor] Streaming completed successfully + UI synced', {
      questionId: params.questionId,
      responseLength: fullResponse.length,
      tokensUsed: totalTokens,
      processingTime,
      confidence: validation.confidence,
    })

    return response
  } catch (error: any) {
    logger.error('[StreamProcessor] Streaming error', {
      questionId: params.questionId,
      error: error.message,
    })

    // Emitir erro via WebSocket
    await emitAgentError(params.questionId, params.organizationId, error.message, error.code)

    throw error
  }
}

/**
 * Valida qualidade da resposta (versão otimizada para novos prompts)
 */
function validateResponse(response: string): {
  confidence: number
  isComplete: boolean
  isRelevant: boolean
  isAccurate: boolean
  reasoning: string
} {
  let confidence = 0.65 // Base
  const validationIssues: string[] = []

  // Verificação 1: Tamanho adequado (200-2000 chars)
  const hasMinimumLength = response.length >= 200
  const notTooLong = response.length <= 2000
  if (hasMinimumLength && notTooLong) {
    confidence += 0.15
  } else if (!hasMinimumLength) {
    validationIssues.push('resposta muito curta')
  } else if (!notTooLong) {
    validationIssues.push('resposta muito longa')
  }

  // Verificação 2: Assinatura profissional obrigatória
  const hasSignature =
    response.includes('Atenciosamente') &&
    (response.includes('Equipe') || response.includes('Team'))
  if (hasSignature) {
    confidence += 0.10
  } else {
    validationIssues.push('falta assinatura')
    confidence -= 0.05
  }

  // Verificação 3: ZERO quebras de linha (exceto antes assinatura) ⚠️ CRÍTICO
  const lines = response.split('\n').filter(line => line.trim().length > 0)
  const hasMultipleParagraphs = lines.length > 2 // Permitir apenas 1 parágrafo + assinatura
  if (!hasMultipleParagraphs) {
    confidence += 0.10
  } else {
    validationIssues.push('múltiplos parágrafos detectados')
    confidence -= 0.10 // Penalidade forte
  }

  // Verificação 4: Sem formatação markdown/HTML
  const noFormatting =
    !response.includes('**') &&
    !response.includes('##') &&
    !response.includes('```') &&
    !response.includes('<') &&
    !response.match(/\*\s+/) && // Lista com asterisco
    !response.match(/\d+\.\s+/) // Lista numerada
  if (noFormatting) {
    confidence += 0.05
  } else {
    validationIssues.push('formatação detectada')
    confidence -= 0.05
  }

  // Verificação 5: Presença de contrações brasileiras (humanização)
  const hasContractions =
    response.includes('pra ') ||
    response.includes('tá ') ||
    response.includes('cê ') ||
    response.includes('né')
  if (hasContractions) {
    confidence += 0.05
  }

  // Verificação 6: Usa transition words (flow)
  const hasTransitions =
    response.includes('além disso') ||
    response.includes('então') ||
    response.includes('por isso') ||
    response.includes('assim') ||
    response.includes('portanto') ||
    response.includes('no entanto')
  if (hasTransitions) {
    confidence += 0.05
  }

  // Verificação 7: Sem padrões AI-sounding problemáticos
  const noAIPatterns =
    !response.toLowerCase().includes('como assistente') &&
    !response.toLowerCase().includes('como ia') &&
    !response.toLowerCase().includes('posso ajudar')
  if (noAIPatterns) {
    confidence += 0.05
  } else {
    validationIssues.push('padrão AI detectado')
    confidence -= 0.10
  }

  const isComplete = hasMinimumLength && hasSignature
  const isRelevant = true
  const isAccurate = confidence >= 0.6

  const reasoning = validationIssues.length > 0
    ? `Validated: length=${response.length}, issues=[${validationIssues.join(', ')}], confidence=${confidence.toFixed(2)}`
    : `Validated: length=${response.length}, no issues, confidence=${confidence.toFixed(2)}`

  return {
    confidence: Math.min(Math.max(confidence, 0.3), 1.0), // Clamp entre 0.3 e 1.0
    isComplete,
    isRelevant,
    isAccurate,
    reasoning,
  }
}

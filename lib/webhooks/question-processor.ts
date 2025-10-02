/**
 * Processador de webhooks de perguntas do Mercado Livre
 * Implementação simples e robusta seguindo a documentação oficial
 * Busca dados completos em uma única chamada usando multi-get
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getValidMLToken } from '@/lib/ml-api/token-manager'
import { generateSequentialId } from '@/lib/utils/sequential-id'
import { MLCache } from '@/lib/cache/ml-cache'

interface WebhookData {
  topic: string
  resource: string
  user_id: string
  application_id?: string
}

interface MLAccount {
  id: string
  mlUserId: string
  organizationId: string
}

/**
 * Processa webhook de pergunta com extração completa de dados
 */
export async function processQuestionWebhook(data: WebhookData, mlAccount: MLAccount) {
  // SALVAMENTO GARANTIDO - Primeiro nível de try-catch
  const questionId = data.resource.split('/').pop()

  if (!questionId) {
    logger.error('[QuestionProcessor] Invalid resource format:', { data: data.resource })
    return
  }

  // Log inicial com timestamp para rastreabilidade completa
  logger.info(`[QuestionProcessor] 🔄 WEBHOOK RECEIVED - Question ${questionId}`, {
    questionId,
    accountId: mlAccount.id,
    userId: mlAccount.mlUserId,
    organizationId: mlAccount.organizationId,
    timestamp: new Date().toISOString(),
    resource: data.resource
  })

  try {
    // 🔒 FIX: Usar UPSERT atômico para evitar race condition P2002
    // Se webhook duplicado chegar simultaneamente, apenas um cria e outro atualiza vazio
    const existingQuestion = await prisma.question.upsert({
      where: { mlQuestionId: questionId },
      update: {}, // Não fazer nada se já existir
      create: {
        mlQuestionId: questionId,
        mlAccountId: mlAccount.id,
        sellerId: mlAccount.mlUserId,
        itemId: '',
        text: 'Processando pergunta recebida do Mercado Livre',
        status: 'RECEIVED',
        receivedAt: new Date(),
        dateCreated: new Date()
      }
    })

    // Se já existia, retornar sem processar novamente
    if (existingQuestion.status !== 'RECEIVED' || existingQuestion.text !== 'Processando pergunta recebida do Mercado Livre') {
      logger.info(`[QuestionProcessor] ✓ Question ${questionId} already processed, skipping duplicate webhook`)
      return
    }

    logger.info(`[QuestionProcessor] ✅ Question ${questionId} SAVED with RECEIVED status`)

    // Agora tentar processar completamente
    try {

      // Obter token válido para a conta
      const accessToken = await getValidMLToken(mlAccount.id)

      if (!accessToken) {
        logger.error(`[QuestionProcessor] Failed to get valid token for account ${mlAccount.id}`)
        // Atualizar pergunta com status FAILED se não tiver token
        await prisma.question.update({
          where: { mlQuestionId: questionId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: 'Token inválido - faça login novamente na conta'
          }
        })
        logger.info(`[QuestionProcessor] Question ${questionId} marked as FAILED - no token`)
        return
      }

    // Buscar detalhes da pergunta ANTES de criar no banco
    let questionDetails: any = null
    let itemDetails: any = null

    try {
      // Buscar direto da API - SEM DELAYS ARTIFICIAIS
      // O retry handler cuidará de 429 automaticamente

      // Buscar dados da pergunta com APENAS 1 RETRY
      let retries = 0
      while (!questionDetails && retries <= 1) { // MÁXIMO 1 RETRY
        try {
          questionDetails = await fetchQuestionDetails(questionId, accessToken)
          if (questionDetails) {
            // NÃO ARMAZENAR EM CACHE - cada pergunta é única
            break
          }
          retries++
          const retryDelay = 30000 // FIXO 30 segundos para retry
          logger.info(`[QuestionProcessor] Retry ${retries}/3 in ${retryDelay/1000}s for question ${questionId}`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        } catch (fetchErr: any) {
          if (fetchErr.message?.includes('429') && retries < 1) {
            const backoffDelay = 60000 // FIXO 60 segundos em caso de rate limit
            logger.warn(`[QuestionProcessor] Rate limited, backing off for ${backoffDelay/1000}s...`)
            await new Promise(resolve => setTimeout(resolve, backoffDelay))
            retries++
          } else {
            throw fetchErr
          }
        }
      }

      if (!questionDetails) {
        logger.error(`[QuestionProcessor] Could not fetch question details for ${questionId} after ${retries} retries`)
        // Atualizar pergunta com status FAILED
        await prisma.question.update({
          where: { mlQuestionId: questionId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: 'Não foi possível buscar detalhes da pergunta na API do Mercado Livre'
          }
        })
        logger.info(`[QuestionProcessor] Question ${questionId} marked as FAILED - no details from ML API`)
        return
      }

      // OTIMIZAÇÃO: Verificar cache do item primeiro
      if (questionDetails?.item_id) {
        // Tentar buscar do cache
        itemDetails = await MLCache.get('ITEM', questionDetails.item_id, mlAccount.mlUserId)

        if (!itemDetails) {
          logger.debug(`[QuestionProcessor] Fetching item ${questionDetails.item_id}`)
        } else {
          logger.info(`[QuestionProcessor] ✨ Cache hit for item ${questionDetails.item_id}`)
        }

        let itemRetries = 0
        while (itemRetries <= 1 && !itemDetails) { // MÁXIMO 1 RETRY
          try {
            itemDetails = await fetchItemDetails(questionDetails.item_id, accessToken)
            if (itemDetails) {
              // Armazenar no cache para próximas requisições
              await MLCache.set('ITEM', questionDetails.item_id, itemDetails, mlAccount.mlUserId)
              break
            }
            itemRetries++
            const retryDelay = 20000 // FIXO 20 segundos para retry de item
            logger.info(`[QuestionProcessor] Item retry ${itemRetries}/3 in ${retryDelay/1000}s`)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          } catch (itemErr: any) {
            if (itemErr.message?.includes('429') && itemRetries < 1) {
              const backoffDelay = 45000 // FIXO 45 segundos em caso de rate limit
              logger.warn(`[QuestionProcessor] Rate limited on item, backing off for ${backoffDelay/1000}s...`)
              await new Promise(resolve => setTimeout(resolve, backoffDelay))
              itemRetries++
            } else {
              logger.error(`[QuestionProcessor] Error fetching item ${questionDetails.item_id}:`, itemErr)
              break
            }
          }
        }

        if (!itemDetails) {
          logger.warn(`[QuestionProcessor] Could not fetch item details for ${questionDetails.item_id}, using fallback`)
          // Usar dados básicos do questionDetails como fallback
          itemDetails = {
            title: `Produto ${questionDetails.item_id}`,
            price: 0,
            permalink: `https://produto.mercadolivre.com.br/MLB-${questionDetails.item_id}`
          }
        }

        logger.info(`[QuestionProcessor] Item details ready`, {
          itemId: questionDetails.item_id,
          title: itemDetails?.title,
          price: itemDetails?.price
        })
      }
    } catch (err) {
      logger.error(`[QuestionProcessor] Error fetching data for ${questionId}`, { error: err })
      // Atualizar pergunta com status FAILED
      await prisma.question.update({
        where: { mlQuestionId: questionId },
        data: {
          itemId: questionDetails?.item_id || '',
          text: questionDetails?.text || 'Erro ao processar pergunta',
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'Erro ao buscar dados completos da pergunta'
        }
      })
      logger.info(`[QuestionProcessor] Question ${questionId} marked as FAILED after fetch error`)
      return
    }

    // ATUALIZAR PERGUNTA COM DADOS COMPLETOS
    // Gerar ID sequencial ÚNICO para rastreio permanente
    const sequentialId = generateSequentialId(questionId)

    // Buscar pergunta existente para verificar seu status atual
    const existingQuestion = await prisma.question.findUnique({
      where: { mlQuestionId: questionId },
      select: {
        status: true,
        aiSuggestion: true,
        answer: true
      }
    })

    // Determinar o status correto baseado no estado atual
    let newStatus = 'PROCESSING'

    if (existingQuestion) {
      // Se já tem resposta da IA, deve ser AWAITING_APPROVAL
      if (existingQuestion.aiSuggestion && existingQuestion.status !== 'REVISING') {
        newStatus = 'AWAITING_APPROVAL'
      }
      // Se está revisando, manter REVISING
      else if (existingQuestion.status === 'REVISING') {
        newStatus = 'REVISING'
      }
      // Se já foi respondida, manter o status
      else if (['RESPONDED', 'COMPLETED', 'SENT_TO_ML'].includes(existingQuestion.status)) {
        newStatus = existingQuestion.status
      }
      // Se falhou ou tem erro, manter para permitir retry
      else if (['FAILED', 'ERROR', 'TOKEN_ERROR'].includes(existingQuestion.status)) {
        newStatus = existingQuestion.status
      }
    }

    const savedQuestion = await prisma.question.update({
      where: { mlQuestionId: questionId },
      data: {
        sellerId: questionDetails?.seller_id?.toString() || mlAccount.mlUserId,
        itemId: questionDetails?.item_id || '',
        itemTitle: itemDetails?.title || questionDetails?.item_id || 'Produto',
        itemPrice: itemDetails?.price || 0,
        itemPermalink: itemDetails?.permalink || null,
        customerId: questionDetails?.from?.id?.toString() || null,
        text: questionDetails?.text || 'Pergunta sem texto',
        status: newStatus,
        dateCreated: questionDetails?.date_created ? new Date(questionDetails.date_created) : new Date(),
        sequentialId: sequentialId // ID ÚNICO que não muda
      }
    })

    logger.info(`[QuestionProcessor] Question created with complete data`, {
      id: savedQuestion.id,
      mlQuestionId: questionId,
      itemTitle: savedQuestion.itemTitle,
      itemPrice: savedQuestion.itemPrice,
      text: savedQuestion.text.substring(0, 50)
    })

    // EMITIR EVENTO WEBSOCKET IMEDIATAMENTE para atualização em tempo real
    try {
      logger.info(`[QuestionProcessor] Preparing to emit WebSocket event for question ${savedQuestion.mlQuestionId}`)

      const { emitNewQuestion, emitQuestionProcessing } = require('@/lib/websocket/emit-events.js')

      const account = await prisma.mLAccount.findUnique({
        where: { id: mlAccount.id },
        select: { nickname: true, thumbnail: true, siteId: true }
      })

      // Preparar dados completos da pergunta
      const questionWithAccount = {
        ...savedQuestion,
        organizationId: mlAccount.organizationId,
        mlAccount: {
          id: mlAccount.id,
          mlUserId: mlAccount.mlUserId,
          nickname: account?.nickname || 'Conta',
          thumbnail: account?.thumbnail,
          siteId: account?.siteId
        }
      }

      // Emitir evento de nova pergunta
      emitNewQuestion(questionWithAccount)

      // Se já estiver processando, emitir status de processing
      if (savedQuestion.status === 'PROCESSING') {
        emitQuestionProcessing(savedQuestion.mlQuestionId, mlAccount.organizationId)
      }

      logger.info(`[QuestionProcessor] ✅ WebSocket event SUCCESSFULLY emitted`, {
        type: 'question:new',
        questionId: savedQuestion.mlQuestionId,
        organizationId: mlAccount.organizationId,
        accountId: mlAccount.id,
        accountNickname: account?.nickname,
        itemTitle: savedQuestion.itemTitle,
        text: savedQuestion.text.substring(0, 50)
      })

      // ENVIAR PUSH NOTIFICATION para dispositivos PWA
      try {
        logger.info(`[QuestionProcessor] Sending push notification for question ${savedQuestion.mlQuestionId}`)

        // Preparar payload da notificação
        const pushPayload = {
          type: 'new_question' as const,
          questionId: savedQuestion.mlQuestionId,
          sequentialId: savedQuestion.sequentialId,
          questionText: savedQuestion.text,
          productTitle: savedQuestion.itemTitle || 'Produto',
          productImage: itemDetails?.thumbnail || null,
          sellerName: account?.nickname || 'ML Agent',
          accountId: mlAccount.id,
          url: `/agente?questionId=${savedQuestion.mlQuestionId}`
        }

        // Enviar push para todos os dispositivos da organização
        const pushResponse = await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: pushPayload,
            organizationId: mlAccount.organizationId,
            broadcast: true
          })
        })

        if (pushResponse.ok) {
          const result = await pushResponse.json()
          logger.info(`[QuestionProcessor] ✅ Push notifications sent`, {
            questionId: savedQuestion.mlQuestionId,
            sent: result.sent,
            failed: result.failed
          })
        } else {
          logger.warn(`[QuestionProcessor] Push notification request failed`, {
            status: pushResponse.status
          })
        }

      } catch (pushError) {
        // Log mas não falhar se push notification tiver problema
        logger.error(`[QuestionProcessor] Push notification error (non-fatal):`, { data: pushError })
      }

      console.log('[QuestionProcessor] 🚀 Real-time event emitted:', {
        questionId: savedQuestion.mlQuestionId,
        org: mlAccount.organizationId,
        status: savedQuestion.status
      })
    } catch (sseError) {
      logger.error(`[QuestionProcessor] SSE emission failed`, { error: sseError })
    }

    logger.info(`[QuestionProcessor] Created question ${questionId} with initial data`, {
      hasQuestionDetails: !!questionDetails,
      hasItemDetails: !!itemDetails,
      itemId: questionDetails?.item_id,
      text: questionDetails?.text?.substring(0, 50)
    })

    // VALIDAÇÃO DE SEGURANÇA: Verificar se a pergunta pertence ao vendedor
    if (questionDetails.seller_id && questionDetails.seller_id.toString() !== mlAccount.mlUserId) {
      logger.error(`[QuestionProcessor] Security mismatch`, {
        questionId,
        expectedSeller: mlAccount.mlUserId,
        actualSeller: questionDetails.seller_id
      })

      await prisma.auditLog.create({
        data: {
          action: 'question.ownership_mismatch',
          entityType: 'question',
          entityId: questionId,
          organizationId: mlAccount.organizationId,
          mlAccountId: mlAccount.id,
          metadata: {
            expectedSeller: mlAccount.mlUserId,
            actualSeller: questionDetails.seller_id?.toString(),
            questionId
          }
        }
      })
      return
    }

    // OTIMIZADO: Buscar descrição do item (dados do vendedor já em cache do login)
    const [itemDescription, sellerData] = await Promise.all([
      // Buscar descrição do item (importante para contexto da IA)
      questionDetails.item_id ?
        MLCache.getOrFetch('ITEM_DESC', questionDetails.item_id,
          () => fetchItemDescription(questionDetails.item_id, accessToken),
          mlAccount.mlUserId, 1800) : null, // Cache 30min
      // Dados do vendedor já em cache (3h) desde o login - ECONOMIA DE 1 CHAMADA API
      questionDetails.seller_id ?
        MLCache.get('USER', questionDetails.seller_id.toString()) : null
    ])

    const buyerData = null // Não essencial - removido
    
    // Se a pergunta já tem resposta no ML, atualizar
    if (questionDetails.answer) {
      await prisma.question.update({
        where: { id: savedQuestion.id },
        data: {
          status: 'COMPLETED',
          answer: questionDetails.answer.text,
          answeredAt: new Date(questionDetails.answer.date_created),
          answeredBy: 'EXTERNAL'
        }
      })
      logger.info(`[QuestionProcessor] Question already answered on ML`)
      return
    }
    
    // Enviar para N8N processar a resposta
    if (questionDetails.status === 'UNANSWERED') {
      await sendToN8NProcessingOptimized(
        savedQuestion,
        {
          itemDetails: itemDetails,
          itemDescription,
          sellerData,
          buyerData
        }
      )
    }
    
    // Registrar no audit log
    await prisma.auditLog.create({
      data: {
        action: 'question.received',
        entityType: 'question',
        entityId: savedQuestion.id,
        organizationId: mlAccount.organizationId,
        mlAccountId: mlAccount.id,
        metadata: {
          mlQuestionId: questionId,
          itemId: questionDetails.item_id,
          status: questionDetails.status
        }
      }
    })
    
    } catch (innerError) {
      // Se falhar o processamento interno, garantir que a pergunta está salva como FAILED
      logger.error(`[QuestionProcessor] Error during processing for ${questionId}:`, { error: innerError })

      try {
        await prisma.question.update({
          where: { mlQuestionId: questionId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: 'Erro durante processamento - será reprocessado'
          }
        })
      } catch (updateErr) {
        logger.error(`[QuestionProcessor] Failed to update question status:`, { error: updateErr })
      }
    }

  } catch (outerError) {
    // ÚLTIMA GARANTIA: Se tudo falhar, ainda assim salvar a pergunta
    logger.error(`[QuestionProcessor] CRITICAL ERROR for question ${questionId}:`, { error: outerError })

    try {
      // Verificar se conseguimos pelo menos salvar
      const exists = await prisma.question.findUnique({
        where: { mlQuestionId: questionId }
      })

      if (!exists) {
        // Última tentativa de salvar
        await prisma.question.create({
          data: {
            mlQuestionId: questionId,
            mlAccountId: mlAccount.id,
            sellerId: mlAccount.mlUserId,
            itemId: '',
            text: 'Erro crítico - pergunta salva para processamento posterior',
            status: 'FAILED',
            receivedAt: new Date(),
            dateCreated: new Date(),
            failedAt: new Date(),
            failureReason: 'Erro crítico no processamento'
          }
        })
        logger.info(`[QuestionProcessor] ⚠️ Question ${questionId} SAVED in emergency mode`)
      }
    } catch (emergencyError) {
      logger.error(`[QuestionProcessor] EMERGENCY SAVE FAILED:`, { error: emergencyError })
      // Aqui poderíamos enviar para uma fila de dead letter ou notificar admin
    }
  }
}

/**
 * Busca detalhes da pergunta na API do ML
 */
async function fetchQuestionDetails(questionId: string, accessToken: string) {
  try {
    logger.info(`[QuestionProcessor] 🔍 Starting API call for question ${questionId}`, {
      timestamp: new Date().toISOString(),
      tokenLength: accessToken?.length || 0,
      tokenPrefix: accessToken?.substring(0, 10)
    })

    const response = await fetch(`https://api.mercadolibre.com/questions/${questionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    // Log detalhado da resposta
    logger.info(`[QuestionProcessor] 📡 API Response for question ${questionId}`, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'x-rate-limit-limit': response.headers.get('x-rate-limit-limit'),
        'x-rate-limit-remaining': response.headers.get('x-rate-limit-remaining'),
        'x-rate-limit-reset': response.headers.get('x-rate-limit-reset'),
        'retry-after': response.headers.get('retry-after')
      }
    })

    if (response.status === 404) {
      logger.debug(`[QuestionProcessor] Question ${questionId} not found (404) - likely a test webhook`)
      return null
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      const errorBody = await response.text()

      logger.error(`[QuestionProcessor] 🚫 RATE LIMIT 429 for question ${questionId}`, {
        retryAfter,
        errorBody,
        headers: Object.fromEntries(response.headers.entries())
      })

      // Usar retry-after do header ou delay fixo de 60s
      const rateLimitDelay = retryAfter ? parseInt(retryAfter) * 1000 : 60000
      logger.info(`[QuestionProcessor] ⏳ Waiting ${Math.round(rateLimitDelay/1000)}s due to rate limit`)
      await new Promise(resolve => setTimeout(resolve, rateLimitDelay))
      const retryResponse = await fetch(`https://api.mercadolibre.com/questions/${questionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })

      if (!retryResponse.ok) {
        throw new Error(`API error ${retryResponse.status}: ${await retryResponse.text()}`)
      }
      const data = await retryResponse.json()
      logger.info(`[QuestionProcessor] Data fetched after retry`, data)
      return data
    }

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    logger.info(`[QuestionProcessor] Data fetched successfully`, data)
    return data
  } catch (_error: any) {
    logger.error(`[QuestionProcessor] Failed to fetch question ${questionId}:`, {
      error: _error?.message || _error,
      stack: _error?.stack
    })
    throw _error
  }
}

/**
 * Busca detalhes COMPLETOS do item na API do ML com retry inteligente
 */
async function fetchItemDetails(itemId: string, accessToken: string) {
  try {
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (response.status === 404) {
      logger.debug(`[QuestionProcessor] Item ${itemId} not found (404) - may be deleted or test`)
      return null
    }

    if (response.status === 429) {
      logger.warn(`[QuestionProcessor] Rate limited when fetching item ${itemId}, will retry`)
      // OTIMIZAÇÃO: Aguardar mais tempo para items (10-15 segundos)
      const rateLimitDelay = Math.random() * 5000 + 10000 // 10-15 segundos
      logger.info(`[QuestionProcessor] Waiting ${Math.round(rateLimitDelay/1000)}s due to item rate limit`)
      await new Promise(resolve => setTimeout(resolve, rateLimitDelay))

      const retryResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })

      if (retryResponse.ok) {
        logger.info(`[QuestionProcessor] Successfully fetched item ${itemId} on retry`)
        const data = await retryResponse.json()
      logger.info(`[QuestionProcessor] Data fetched after retry`, data)
      return data
      }

      logger.error(`[QuestionProcessor] Failed to fetch item ${itemId} after retry: ${retryResponse.status}`)
      return null
    }

    if (!response.ok) {
      logger.error(`[QuestionProcessor] Error fetching item ${itemId}: ${response.status}`)
      return null
    }

    const data = await response.json()

    // Validar que temos dados mínimos necessários
    if (!data.title || data.title === '') {
      logger.warn(`[QuestionProcessor] Item ${itemId} has no title`)
      return null
    }

    return data
  } catch (_error: any) {
    logger.error(`[QuestionProcessor] Failed to fetch item ${itemId}:`, {
      error: _error?.message || _error
    })
    return null
  }
}

/**
 * Busca descrição do item para enriquecer contexto da IA
 */
async function fetchItemDescription(itemId: string, accessToken: string) {
  try {
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      // Descrição é opcional, alguns itens não têm
      return null
    }

    const data = await response.json()
    logger.debug(`[QuestionProcessor] Item description fetched for ${itemId}`)
    return data
  } catch (_error) {
    // Descrição é opcional, continuar sem ela
    logger.debug(`[QuestionProcessor] No description available for item ${itemId}`)
    return null
  }
}

// REMOVIDO: fetchUserDetails - não é mais necessário
// Agora usamos cache do login (3 horas) para economizar chamadas API
// Economia: 1 chamada API por pergunta processada

/**
 * Mapeia status do ML para nosso sistema
 */
// function _mapMLStatus(mlStatus: string): string {
//   const statusMap: Record<string, string> = {
//     'UNANSWERED': 'RECEIVED',
//     'ANSWERED': 'ANSWERED',
//     'DELETED': 'DELETED',
//     'BANNED': 'DELETED',
//     'CLOSED_UNANSWERED': 'DELETED',
//     'UNDER_REVIEW': 'PROCESSING'
//   }
//
//   return statusMap[mlStatus] || 'RECEIVED'
// }

/**
 * Envia pergunta para processamento no N8N usando FORMATO UNIFICADO
 */
async function sendToN8NProcessingOptimized(
  question: any,
  enrichedData: {
    itemDetails: any
    itemDescription: any
    sellerData: any
    buyerData: any
  }
) {
  try {
    const n8nWebhookUrl = process.env['N8N_WEBHOOK_URL']

    if (!n8nWebhookUrl) {
      logger.info('[QuestionProcessor] N8N webhook not configured')
      return
    }

    const { itemDetails, itemDescription } = enrichedData

    // Buscar conta ML com organização
    const fullMlAccount = await prisma.mLAccount.findUnique({
      where: { id: question.mlAccountId },
      include: {
        organization: true
      }
    })

    if (!fullMlAccount) {
      logger.error('[QuestionProcessor] ML Account not found for question processing')
      await prisma.question.update({
        where: { id: question.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'ML Account not found'
        }
      })
      return
    }

    // IMPORTAR FUNÇÕES DO PAYLOAD BUILDER
    const { buildN8NPayload, fetchBuyerQuestionsHistory } = await import('@/lib/webhooks/n8n-payload-builder')
    const { decryptToken } = await import('@/lib/security/encryption')

    // Buscar histórico de perguntas do COMPRADOR ESPECÍFICO
    const buyerQuestions = await fetchBuyerQuestionsHistory(
      question.customerId || '',
      fullMlAccount.organizationId,
      question.mlQuestionId,
      prisma,
      decryptToken
    )

    // CONSTRUIR PAYLOAD UNIFICADO - Formato padrão para processamento
    const n8nPayload = await buildN8NPayload(
      {
        mlQuestionId: question.mlQuestionId,
        id: question.mlQuestionId,
        text: question.text,
        item_id: question.itemId,
        sellerNickname: fullMlAccount.nickname || 'Vendedor'
      },
      itemDetails,
      itemDescription,
      buyerQuestions,
      {
        sellerNickname: fullMlAccount.nickname
        // SEM original_response e revision_feedback - apenas para revisão
      }
    )
    
    // Enviar para N8N
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutos
      
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(n8nPayload),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        logger.info(`[QuestionProcessor] Sent question ${question.id} to N8N with COMPLETE enriched data`, {
          questionId: question.mlQuestionId,
          itemId: question.itemId,
          hasDescription: !!itemDescription?.plain_text,
          descriptionLength: itemDescription?.plain_text?.length || 0
        })
        
        await prisma.question.update({
          where: { id: question.id },
          data: { 
            status: 'PROCESSING',
            processedAt: new Date()
          }
        })
      } else {
        const errorText = await response.text()
        logger.error('[QuestionProcessor] N8N webhook returned error', {
          status: response.status,
          error: errorText
        })

        await prisma.question.update({
          where: { id: question.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: errorText.includes('Error in workflow')
              ? 'Error in workflow'
              : `N8N error: ${response.status}`
          }
        })

        // Emitir evento de erro em tempo real
        try {
          const { emitQuestionFailed } = require('@/lib/websocket/emit-events.js')
          emitQuestionFailed(
            question.mlQuestionId,
            errorText.includes('Error in workflow') ? 'Erro no processamento da IA' : `Erro no serviço: ${response.status}`,
            true, // retryable
            fullMlAccount.organizationId,
            {
              type: 'N8N_ERROR',
              code: response.status.toString(),
              hasResponse: false
            }
          )
        } catch (wsError) {
          logger.warn('[QuestionProcessor] Failed to emit error event', { error: wsError })
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.error('[QuestionProcessor] N8N request timeout')

        await prisma.question.update({
          where: { id: question.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: 'N8N processing timeout'
          }
        })

        // Emitir evento de timeout
        try {
          const { emitQuestionFailed } = require('@/lib/websocket/emit-events.js')
          emitQuestionFailed(
            question.mlQuestionId,
            'Tempo limite de processamento excedido',
            true, // retryable
            fullMlAccount.organizationId,
            {
              type: 'TIMEOUT',
              code: 'TIMEOUT',
              hasResponse: false
            }
          )
        } catch (wsError) {
          logger.warn('[QuestionProcessor] Failed to emit timeout event', { error: wsError })
        }
      } else {
        logger.error('[QuestionProcessor] Error sending to N8N:', { error })

        await prisma.question.update({
          where: { id: question.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: `Failed to send to N8N: ${error.message}`
          }
        })

        // Emitir evento de erro genérico
        try {
          const { emitQuestionFailed } = require('@/lib/websocket/emit-events.js')
          emitQuestionFailed(
            question.mlQuestionId,
            `Erro ao processar: ${error.message}`,
            true, // retryable
            fullMlAccount.organizationId,
            {
              type: 'CONNECTION_ERROR',
              code: 'NETWORK_ERROR',
              hasResponse: false
            }
          )
        } catch (wsError) {
          logger.warn('[QuestionProcessor] Failed to emit error event', { error: wsError })
        }
      }
    }
    
  } catch (error: any) {
    logger.error('[QuestionProcessor] Critical error in N8N processing:', { error })
    
    try {
      await prisma.question.update({
        where: { id: question.id },
        data: { 
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: `Critical error: ${error.message}`
        }
      })
    } catch (updateError) {
      logger.error('[QuestionProcessor] Failed to update question status:', { updateError })
    }
  }
}

// REMOVIDO: Funções antigas de formatação - usando buildN8NPayload agora

// REMOVIDO: Funções antigas de formatação - todas substituídas por buildN8NPayload

const questionProcessor = {
  processQuestionWebhook
}

export default questionProcessor
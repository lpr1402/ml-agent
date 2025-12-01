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
  siteId: string // ✅ FIX: Adicionar siteId para permalink correto
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

  // ✅ FIX CRÍTICO: Usar singleton Redis (evita memory leak)
  const { getRedisClient } = await import('@/lib/redis')
  const redis = getRedisClient()

  const lockKey = `webhook:lock:question:${questionId}`
  const lockValue = `${Date.now()}_${Math.random().toString(36).substring(7)}`
  const lockTTL = 30000 // 30 segundos

  // Tentar adquirir lock (NX = only if not exists)
  const lockAcquired = await redis.set(lockKey, lockValue, 'PX', lockTTL, 'NX')

  if (!lockAcquired) {
    logger.info(`[QuestionProcessor] ✓ Question ${questionId} already being processed, skipping`)
    // ✅ FIX: NÃO fechar redis - singleton é gerenciado centralmente
    return
  }

  try {
    // 🔒 UPSERT atômico para garantir criação única
    const initialQuestion = await prisma.question.upsert({
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
    if (initialQuestion.status !== 'RECEIVED' || initialQuestion.text !== 'Processando pergunta recebida do Mercado Livre') {
      logger.info(`[QuestionProcessor] ✓ Question ${questionId} already processed, skipping duplicate webhook`)
      return
    }

    logger.info(`[QuestionProcessor] ✅ Question ${questionId} SAVED with RECEIVED status`)

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

      // 🔴 CRÍTICO: Buscar dados da pergunta com RETRY de 4 MINUTOS em caso de 429
      let retries = 0
      while (!questionDetails && retries <= 1) { // MÁXIMO 1 RETRY
        try {
          questionDetails = await fetchQuestionDetails(questionId, accessToken)
          if (questionDetails) {
            // NÃO ARMAZENAR EM CACHE - cada pergunta é única
            break
          }
          retries++
          const retryDelay = 240000 // 🔴 FIX: 4 MINUTOS (240 segundos) conforme requisito
          logger.info(`[QuestionProcessor] Retry ${retries}/1 in ${retryDelay/1000}s for question ${questionId}`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        } catch (fetchErr: any) {
          if (fetchErr.message?.includes('429') && retries < 1) {
            const backoffDelay = 240000 // 🔴 FIX: 4 MINUTOS para rate limit 429
            logger.warn(`[QuestionProcessor] ⚠️ RATE LIMIT 429 - Aguardando ${backoffDelay/1000}s antes de retry...`)
            await new Promise(resolve => setTimeout(resolve, backoffDelay))
            retries++
          } else {
            throw fetchErr
          }
        }
      }

      if (!questionDetails) {
        logger.error(`[QuestionProcessor] Could not fetch question details for ${questionId} after ${retries} retries`)

        // 🎯 CRÍTICO: Extrair ID do item do resource path como fallback
        // Resource format: /questions/QUESTION_ID ou pode ter item info
        const fallbackItemId = data.resource.includes('/items/')
          ? data.resource.split('/items/')[1]?.split('/')[0]
          : ''

        // Atualizar pergunta com dados mínimos mas VISÍVEIS na UI
        await prisma.question.update({
          where: { mlQuestionId: questionId },
          data: {
            itemId: fallbackItemId || 'UNKNOWN',
            itemTitle: fallbackItemId ? `Produto ${fallbackItemId}` : 'Pergunta recebida - dados pendentes',
            text: 'Não foi possível carregar o texto da pergunta. Clique em "Reprocessar" para tentar novamente.',
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: 'Rate limit ou timeout ao buscar dados do ML. Você pode reprocessar manualmente.'
          }
        })

        logger.info(`[QuestionProcessor] Question ${questionId} marked as FAILED with fallback data for UI visibility`)

        // EMITIR EVENTO WEBSOCKET para mostrar na UI imediatamente
        try {
          const { emitNewQuestion } = require('@/lib/websocket/emit-events.js')
          const account = await prisma.mLAccount.findUnique({
            where: { id: mlAccount.id },
            select: { nickname: true, thumbnail: true, siteId: true }
          })

          const questionForUI = await prisma.question.findUnique({
            where: { mlQuestionId: questionId }
          })

          if (questionForUI) {
            emitNewQuestion({
              ...questionForUI,
              organizationId: mlAccount.organizationId,
              mlAccount: {
                id: mlAccount.id,
                mlUserId: mlAccount.mlUserId,
                nickname: account?.nickname || 'Conta',
                thumbnail: account?.thumbnail,
                siteId: account?.siteId,
                organizationId: mlAccount.organizationId // ✅ FIX CRÍTICO: Necessário para streaming funcionar
              }
            })
          }
        } catch (wsError) {
          logger.error('[QuestionProcessor] Failed to emit WebSocket event for failed question', { error: wsError })
        }

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
            const retryDelay = 240000 // 🔴 FIX: 4 MINUTOS para retry de item
            logger.info(`[QuestionProcessor] Item retry ${itemRetries}/1 in ${retryDelay/1000}s`)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          } catch (itemErr: any) {
            if (itemErr.message?.includes('429') && itemRetries < 1) {
              const backoffDelay = 240000 // 🔴 FIX: 4 MINUTOS para rate limit 429
              logger.warn(`[QuestionProcessor] ⚠️ RATE LIMIT 429 on item - Aguardando ${backoffDelay/1000}s...`)
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
          // ✅ FIX: Usar mlAccount.siteId ao invés de mlUserId (que não tem prefixo)
          // mlUserId = "1377558007" (número)
          // siteId = "MLB" (correto)
          const siteId = mlAccount.siteId || 'MLB'
          const itemIdClean = questionDetails.item_id.replace(`${siteId}-`, '')

          itemDetails = {
            title: `Produto ${questionDetails.item_id}`,
            price: 0,
            permalink: `https://produto.mercadolivre.com.br/${siteId}-${itemIdClean}`
          }

          logger.debug(`[QuestionProcessor] Fallback permalink created`, {
            siteId,
            itemId: questionDetails.item_id,
            permalink: itemDetails.permalink
          })
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
    // Gerar ID sequencial ÚNICO baseado em quantas perguntas a organização recebeu HOJE
    const receivedAt = questionDetails?.date_created ? new Date(questionDetails.date_created) : new Date()
    const sequentialId = await generateSequentialId(mlAccount.organizationId, receivedAt)

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
      // 🔴 FIX CRÍTICO: Se já tem resposta da IA (não vazia e não placeholder), FORÇAR AWAITING_APPROVAL
      const hasValidAISuggestion = existingQuestion.aiSuggestion &&
        existingQuestion.aiSuggestion !== 'Processando pergunta recebida do Mercado Livre' &&
        existingQuestion.aiSuggestion !== 'Pergunta sem texto' &&
        existingQuestion.aiSuggestion !== 'Erro ao processar pergunta'

      if (hasValidAISuggestion && existingQuestion.status !== 'REVISING') {
        newStatus = 'AWAITING_APPROVAL'
        logger.info(`[QuestionProcessor] ✅ Question ${questionId} has AI response, forcing AWAITING_APPROVAL status`)
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
        itemThumbnail: itemDetails?.thumbnail || null, // ✅ FIX: Salvar thumbnail do produto
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
          siteId: account?.siteId,
          organizationId: mlAccount.organizationId // ✅ FIX CRÍTICO: Necessário para streaming funcionar
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

      // 🔴 CRÍTICO: VALIDAR DADOS ANTES DE ENVIAR PUSH/WHATSAPP
      // NUNCA enviar notificações com dados mockados, incompletos ou zerados
      const hasValidDataForNotification = (
        savedQuestion.text &&
        savedQuestion.text !== 'Processando pergunta recebida do Mercado Livre' &&
        savedQuestion.text !== 'Pergunta sem texto' &&
        savedQuestion.text !== 'Erro ao processar pergunta' &&
        !savedQuestion.text.includes('Não foi possível carregar o texto') &&
        !savedQuestion.text.includes('dados pendentes') &&
        savedQuestion.itemId &&
        savedQuestion.itemId !== '' &&
        savedQuestion.itemId !== 'UNKNOWN'
      )

      if (hasValidDataForNotification) {
        // ✅ DADOS VÁLIDOS - Enviar notificações PWA/WhatsApp
        try {
          logger.info(`[QuestionProcessor] ✅ Enviando push notification com dados válidos`, {
            questionId: savedQuestion.mlQuestionId,
            text: savedQuestion.text.substring(0, 50)
          })

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
      } else {
        // ❌ DADOS INCOMPLETOS - Enviar notificação de AVISO
        logger.warn(`[QuestionProcessor] ⚠️ Dados incompletos - enviando notificação de aviso`, {
          questionId: savedQuestion.mlQuestionId,
          text: savedQuestion.text
        })

        try {
          const warningPayload = {
            type: 'error' as const,
            questionId: savedQuestion.mlQuestionId,
            message: `⚠️ Pergunta recebida no Mercado Livre mas o processamento falhou. Tentando novamente em 4 minutos...`,
            sellerName: account?.nickname || 'ML Agent',
            url: `/agente?questionId=${savedQuestion.mlQuestionId}`
          }

          await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload: warningPayload,
              organizationId: mlAccount.organizationId,
              broadcast: true
            })
          })
        } catch (warningError) {
          logger.error(`[QuestionProcessor] Failed to send warning notification`, { error: warningError })
        }
      }

      // ✅ FIX: Usar logger consistentemente ao invés de console.log
      logger.info('[QuestionProcessor] Real-time event emitted', {
        questionId: savedQuestion.mlQuestionId,
        organizationId: mlAccount.organizationId,
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
    
    // 🔴 CRÍTICO: VALIDAR DADOS ANTES DE ENVIAR AO N8N
    // NUNCA enviar perguntas com dados mockados, incompletos ou zerados
    const hasValidData = (
      questionDetails.status === 'UNANSWERED' &&
      savedQuestion.text &&
      savedQuestion.text !== 'Processando pergunta recebida do Mercado Livre' &&
      savedQuestion.text !== 'Pergunta sem texto' &&
      savedQuestion.text !== 'Erro ao processar pergunta' &&
      !savedQuestion.text.includes('Não foi possível carregar o texto') &&
      savedQuestion.itemId &&
      savedQuestion.itemId !== '' &&
      savedQuestion.itemId !== 'UNKNOWN' &&
      savedQuestion.itemTitle &&
      savedQuestion.itemTitle !== 'Produto' &&
      !savedQuestion.itemTitle.includes('dados pendentes')
    )

    if (hasValidData) {
      // ✅ Dados válidos - enviar para processamento com AGENTE IA
      logger.info(`[QuestionProcessor] ✅ Dados válidos - processando com Gemini 3.0 Pro Agent`, {
        questionId,
        text: savedQuestion.text.substring(0, 50),
        itemId: savedQuestion.itemId,
        itemTitle: savedQuestion.itemTitle
      })

      // NOVO: Processar com agente IA ao invés de N8N
      const { processQuestionWithAgent } = await import('@/lib/agent/core/agent-integration')

      await processQuestionWithAgent(
        savedQuestion,
        {
          itemDetails: itemDetails,
          itemDescription,
          sellerData,
          buyerData
        }
      )

      logger.info(`[QuestionProcessor] ✅ Agente IA processando em background com streaming`, {
        questionId,
      })
    } else {
      // ❌ Dados incompletos - NÃO ENVIAR
      logger.warn(`[QuestionProcessor] ❌ DADOS INCOMPLETOS - NÃO enviando ao N8N`, {
        questionId,
        text: savedQuestion.text,
        itemId: savedQuestion.itemId,
        itemTitle: savedQuestion.itemTitle,
        status: questionDetails.status
      })

      // Marcar pergunta como FAILED para permitir reprocessamento
      await prisma.question.update({
        where: { id: savedQuestion.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'Dados incompletos - não foi possível processar. Clique em Reprocessar para tentar novamente.'
        }
      })
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

  } catch (error) {
    // ✅ FIX: Catch único para todos os erros do processamento principal
    logger.error(`[QuestionProcessor] Error processing question ${questionId}:`, { error })

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
    }
  } finally {
    // ✅ SEMPRE liberar o lock Redis (mesmo em caso de erro)
    try {
      const currentLockValue = await redis.get(lockKey)
      if (currentLockValue === lockValue) {
        await redis.del(lockKey)
        logger.debug(`[QuestionProcessor] Lock released for question ${questionId}`)
      }
      // ✅ FIX: NÃO fechar redis.quit() - singleton é gerenciado centralmente
    } catch (lockErr) {
      logger.warn('[QuestionProcessor] Failed to release lock', { error: lockErr })
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

      // 🔴 FIX: Usar retry-after do header ou delay fixo de 4 MINUTOS
      const rateLimitDelay = retryAfter ? parseInt(retryAfter) * 1000 : 240000
      logger.info(`[QuestionProcessor] ⏳ AGUARDANDO ${Math.round(rateLimitDelay/1000)}s (${Math.round(rateLimitDelay/60000)} minutos) devido a rate limit 429`)
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
      // ✅ FIX: Rate limit 429 - retornar null para permitir retry externo
      logger.warn(`[QuestionProcessor] Rate limited when fetching item ${itemId}`)
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

// NOTA: Código N8N removido - Sistema migrado para Gemini 3.0 Pro (processQuestionWithAgent)

const questionProcessor = {
  processQuestionWebhook
}

export default questionProcessor
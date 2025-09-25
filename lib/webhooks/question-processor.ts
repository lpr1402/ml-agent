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
  try {
    // Extrair ID da pergunta do resource (formato: /questions/ID)
    const questionId = data.resource.split('/').pop()

    if (!questionId) {
      logger.error('[QuestionProcessor] Invalid resource format:', { data: data.resource })
      return
    }

    logger.info(`[QuestionProcessor] 🔄 Processing question ${questionId} for account ${mlAccount.mlUserId}`, {
      questionId,
      accountId: mlAccount.id,
      userId: mlAccount.mlUserId,
      organizationId: mlAccount.organizationId,
      timestamp: new Date().toISOString()
    })

    // Verificar se já temos essa pergunta
    const existingQuestion = await prisma.question.findUnique({
      where: { mlQuestionId: questionId }
    })

    if (existingQuestion) {
      logger.info(`[QuestionProcessor] Question ${questionId} already exists`)
      return
    }

    // Obter token válido para a conta ANTES de criar a pergunta
    const accessToken = await getValidMLToken(mlAccount.id)

    if (!accessToken) {
      logger.error(`[QuestionProcessor] Failed to get valid token for account ${mlAccount.id}`)
      // Criar pergunta com status FAILED se não tiver token
      await prisma.question.create({
        data: {
          mlQuestionId: questionId,
          mlAccountId: mlAccount.id,
          sellerId: mlAccount.mlUserId,
          itemId: '',
          text: 'Erro ao obter token de autenticação',
          status: 'FAILED',
          receivedAt: new Date(),
          dateCreated: new Date(),
          failedAt: new Date(),
          failureReason: 'Token inválido'
        }
      })
      return
    }

    // Buscar detalhes da pergunta ANTES de criar no banco
    let questionDetails: any = null
    let itemDetails: any = null

    try {
      // PERGUNTAS SÃO ÚNICAS - Buscar direto da API sem cache
      // DELAY MAIOR para evitar rate limit (processamento sequencial)
      const initialDelay = Math.random() * 2000 + 3000 // 3-5 segundos SEMPRE
      await new Promise(resolve => setTimeout(resolve, initialDelay))
      logger.info(`[QuestionProcessor] ⏳ Waiting ${Math.round(initialDelay/1000)}s before fetching question ${questionId}`)

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
        // NÃO criar pergunta sem dados - aguardar próxima tentativa
        return
      }

      // OTIMIZAÇÃO: Verificar cache do item primeiro
      if (questionDetails?.item_id) {
        // Tentar buscar do cache
        itemDetails = await MLCache.get('ITEM', questionDetails.item_id, mlAccount.mlUserId)

        if (!itemDetails) {
          // Se não tem cache, delay MAIOR
          const itemDelay = Math.random() * 1000 + 2000 // 2-3 segundos
          await new Promise(resolve => setTimeout(resolve, itemDelay))
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
      return
    }

    // CRIAR PERGUNTA COM DADOS COMPLETOS DO ITEM
    // Gerar ID sequencial ÚNICO para rastreio permanente
    const sequentialId = generateSequentialId(questionId)

    const savedQuestion = await prisma.question.create({
      data: {
        mlQuestionId: questionId,
        mlAccountId: mlAccount.id,
        sellerId: questionDetails?.seller_id?.toString() || mlAccount.mlUserId,
        itemId: questionDetails?.item_id || '',
        itemTitle: itemDetails?.title || questionDetails?.item_id || 'Produto',
        itemPrice: itemDetails?.price || 0,
        itemPermalink: itemDetails?.permalink || null,
        customerId: questionDetails?.from?.id?.toString() || null,
        text: questionDetails?.text || 'Pergunta sem texto',
        status: 'PROCESSING',
        dateCreated: questionDetails?.date_created ? new Date(questionDetails.date_created) : new Date(),
        receivedAt: new Date(),
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

    // OTIMIZADO: Buscar descrição do item e dados do vendedor (com cache)
    const [itemDescription, sellerData] = await Promise.all([
      // Buscar descrição do item (importante para contexto da IA)
      questionDetails.item_id ?
        MLCache.getOrFetch('ITEM_DESC', questionDetails.item_id,
          () => fetchItemDescription(questionDetails.item_id, accessToken),
          mlAccount.mlUserId, 1800) : null, // Cache 30min
      // Buscar dados do vendedor
      questionDetails.seller_id ?
        MLCache.getOrFetch('USER', questionDetails.seller_id.toString(),
          () => fetchUserDetails(questionDetails.seller_id.toString(), accessToken),
          mlAccount.mlUserId, 3600) : null // Cache 1h
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
    
  } catch (_error) {
    logger.error('[QuestionProcessor] Error processing webhook:', { error: _error })
    throw _error
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

/**
 * Busca detalhes de um usuário (vendedor ou comprador)
 */
async function fetchUserDetails(userId: string, accessToken: string) {
  try {
    const response = await fetch(`https://api.mercadolibre.com/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      logger.warn(`[QuestionProcessor] Failed to fetch user ${userId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    logger.info(`[QuestionProcessor] Data fetched successfully`, data)
    return data
  } catch (_error: any) {
    logger.warn(`[QuestionProcessor] Failed to fetch user ${userId}:`, {
      error: _error?.message || _error
    })
    return null
  }
}

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
 * Envia pergunta para processamento no N8N com dados COMPLETOS e OTIMIZADOS
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
    
    const { itemDetails, itemDescription, sellerData, buyerData } = enrichedData
    
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
    
    // Buscar histórico de perguntas do comprador
    const [previousQuestionsAllItems, previousQuestionsThisItem] = await Promise.all([
      // Perguntas em OUTROS itens do vendedor
      question.customerId ? prisma.question.findMany({
        where: {
          customerId: question.customerId,
          sellerId: question.sellerId,
          itemId: { not: question.itemId }, // OUTROS itens
          id: { not: question.id },
          answer: { not: null }
        },
        select: {
          text: true,
          answer: true,
          itemTitle: true,
          answeredAt: true
        },
        orderBy: { answeredAt: 'desc' },
        take: 3
      }) : [],
      
      // Perguntas no MESMO item
      question.customerId ? prisma.question.findMany({
        where: {
          customerId: question.customerId,
          itemId: question.itemId, // MESMO item
          id: { not: question.id },
          answer: { not: null }
        },
        select: {
          text: true,
          answer: true,
          answeredAt: true
        },
        orderBy: { answeredAt: 'desc' },
        take: 5
      }) : []
    ])
    
    // Formatar contexto COMPLETO do produto
    const productContext = formatProductContext(itemDetails, itemDescription)
    
    // Formatar contexto do vendedor
    const sellerContext = formatSellerContext(sellerData || fullMlAccount)
    
    // Formatar contexto do comprador
    const buyerContext = formatBuyerContext(buyerData)
    
    // Formatar histórico de perguntas
    const questionsHistory = formatQuestionsHistory(previousQuestionsThisItem, previousQuestionsAllItems, question.itemTitle)
    
    // Preparar payload ULTRA-COMPLETO para N8N
    const n8nPayload = {
      // 1. IDENTIFICAÇÃO
      'question-id': question.mlQuestionId,
      'item-id': question.itemId, // ID do anúncio adicionado!
      'ml_item_id': question.itemId, // Duplicar para compatibilidade com formato unificado

      // 2. PERGUNTA
      question: question.text,

      // 3. CONTEXTO COMPLETO DO PRODUTO
      product_context: productContext,

      // 4. CONTEXTO DO VENDEDOR
      seller_context: sellerContext,

      // 5. CONTEXTO DO COMPRADOR
      buyer_context: buyerContext,

      // 6. HISTÓRICO DE PERGUNTAS
      buyer_questions_history: questionsHistory,

      // 7. INSTRUÇÕES PARA IA
      instructions: 'Responda em português brasileiro, máximo 500 caracteres, seja direto, cordial e profissional. Use os dados fornecidos para personalizar a resposta.'
    }
    
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
            failureReason: `N8N error: ${response.status}`
          }
        })
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

/**
 * Formata contexto completo do produto com descrição
 */
function formatProductContext(itemDetails: any, itemDescription: any): string {
  if (!itemDetails) return 'Produto não encontrado'

  const parts = [
    itemDetails.title,
    `Preço: R$ ${itemDetails.price}`,
    itemDetails.original_price ? `Preço original: R$ ${itemDetails.original_price} (${Math.round((1 - itemDetails.price/itemDetails.original_price) * 100)}% OFF)` : null,
    itemDetails.sold_quantity > 0 ? `${itemDetails.sold_quantity} vendas realizadas` : 'Produto novo no catálogo',
    itemDetails.condition === 'new' ? 'Produto novo' : 'Produto usado',
    `${itemDetails.available_quantity} unidades disponíveis`,
    itemDetails.shipping?.free_shipping ? 'FRETE GRÁTIS' : 'Frete a calcular',
    itemDetails.shipping?.mode === 'me2' ? 'Mercado Envios FULL' : null,
    itemDetails.warranty || 'Garantia do fabricante',
    // Atributos principais
    ...extractMainAttributes(itemDetails.attributes),
    // Descrição COMPLETA do anúncio para contexto da IA - SEM CORTES
    itemDescription?.plain_text ? `\nDESCRIÇÃO COMPLETA:\n${itemDescription.plain_text}` : null
  ]

  return parts.filter(Boolean).join('\n')
}

/**
 * Extrai atributos principais do produto
 */
function extractMainAttributes(attributes: any[]): string[] {
  if (!attributes) return []
  
  const importantAttributes = ['BRAND', 'MODEL', 'COLOR', 'SIZE', 'MATERIAL', 'CAPACITY', 'WEIGHT']
  const result: string[] = []
  
  for (const attr of attributes) {
    if (importantAttributes.includes(attr.id) && attr.value_name) {
      const label = attr.name || attr.id
      result.push(`${label}: ${attr.value_name}`)
    }
  }
  
  return result
}

/**
 * Formata contexto do vendedor
 */
function formatSellerContext(sellerData: any): string {
  if (!sellerData) return 'Vendedor do Mercado Livre'

  // Retornar apenas o nome do vendedor conforme solicitado
  return sellerData.nickname || 'Vendedor'
}

/**
 * Traduz nível de reputação
 */
// function _translateReputation(level: string): string {
//   const levels: Record<string, string> = {
//     '5_green': 'Excelente (Verde)',
//     '4_light_green': 'Muito Boa (Verde Claro)',
//     '3_yellow': 'Boa (Amarelo)',
//     '2_orange': 'Regular (Laranja)',
//     '1_red': 'Ruim (Vermelho)',
//     'newbie': 'Iniciante'
//   }
//
//   return levels[level] || level
// }

/**
 * Formata contexto do comprador
 */
function formatBuyerContext(buyerData: any): string {
  if (!buyerData) return 'Comprador do Mercado Livre'
  
  const parts = [
    buyerData.nickname || 'Comprador',
    buyerData.registration_date ? `Cliente desde ${new Date(buyerData.registration_date).getFullYear()}` : null,
    buyerData.seller_reputation?.transactions?.completed > 0 ? `${buyerData.seller_reputation.transactions.completed} compras realizadas` : null,
    buyerData.buyer_reputation?.tags?.includes('good_buyer') ? 'Bom comprador' : null,
    buyerData.buyer_reputation?.canceled_transactions > 0 ? `${buyerData.buyer_reputation.canceled_transactions} compras canceladas` : null
  ]
  
  return parts.filter(Boolean).join('\n')
}

/**
 * Formata histórico de perguntas do comprador
 */
function formatQuestionsHistory(thisItemQuestions: any[], otherItemsQuestions: any[], currentItemTitle: string): string {
  const parts: string[] = []
  
  // Perguntas no MESMO item
  if (thisItemQuestions.length > 0) {
    parts.push(`=== PERGUNTAS ANTERIORES NESTE PRODUTO (${currentItemTitle}) ===`)
    thisItemQuestions.forEach((q, i) => {
      parts.push(`[Pergunta ${i+1}]`)
      parts.push(`P: ${q.text}`)
      parts.push(`R: ${q.answer}`)
      parts.push('')
    })
  }
  
  // Perguntas em OUTROS itens
  if (otherItemsQuestions.length > 0) {
    parts.push(`=== PERGUNTAS EM OUTROS PRODUTOS DO VENDEDOR ===`)
    otherItemsQuestions.forEach((q) => {
      parts.push(`[Pergunta sobre: ${q.itemTitle}]`)
      parts.push(`P: ${q.text}`)
      parts.push(`R: ${q.answer}`)
      parts.push('')
    })
  }
  
  if (parts.length === 0) {
    return 'Primeira interação deste comprador com o vendedor'
  }
  
  return parts.join('\n')
}

const questionProcessor = {
  processQuestionWebhook
}

export default questionProcessor
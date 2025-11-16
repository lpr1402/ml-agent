/**
 * Processador de webhooks de orders do Mercado Livre
 * 🎯 SISTEMA DE ROI - Tracking de vendas geradas pelo ML Agent
 *
 * Fluxo:
 * 1. Webhook orders_v2 recebe notificação de nova venda
 * 2. Busca dados completos da order na API ML
 * 3. Verifica se o comprador (buyer_id) fez perguntas antes
 * 4. Se sim, vincula a venda às perguntas (conversão!)
 * 5. Atualiza métricas de ROI em tempo real
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getValidMLToken } from '@/lib/ml-api/token-manager'

interface WebhookData {
  topic: string
  resource: string
  user_id: string
  application_id?: string
  sent?: string
}

interface MLAccountData {
  id: string
  mlUserId: string
  organizationId: string
  siteId: string
  accessToken?: string
  accessTokenIV?: string
  accessTokenTag?: string
}

interface MLOrderData {
  id: number
  date_created: string
  date_closed?: string
  last_updated: string
  status: string
  status_detail?: string
  buyer: {
    id: number
    nickname?: string
  }
  seller: {
    id: number
    nickname?: string
  }
  order_items: Array<{
    item: {
      id: string
      title: string
    }
    quantity: number
    unit_price: number
    full_unit_price: number
    sale_fee?: number
  }>
  payments?: Array<{
    payment_method_id: string
    status: string
    total_paid_amount: number
  }>
  shipping?: {
    id: number
    shipping_cost?: number
  }
  total_amount: number
  paid_amount: number
  currency_id: string
  tags?: string[]
}

/**
 * Processa webhook de order com tracking de conversão inteligente
 */
export async function processOrderWebhook(data: WebhookData, mlAccount: MLAccountData) {
  const orderId = data.resource.split('/').pop()

  if (!orderId) {
    logger.error('[OrderProcessor] Invalid resource format:', { resource: data.resource })
    return
  }

  logger.info(`[OrderProcessor] 💰 ORDER WEBHOOK RECEIVED`, {
    orderId,
    accountId: mlAccount.id,
    userId: mlAccount.mlUserId,
    organizationId: mlAccount.organizationId,
    timestamp: new Date().toISOString()
  })

  try {
    // 1️⃣ BUSCAR DADOS COMPLETOS DA ORDER NA API ML
    const accessToken = await getValidMLToken(mlAccount.id)

    if (!accessToken) {
      logger.error(`[OrderProcessor] Failed to get valid token for account ${mlAccount.id}`)
      return
    }

    const orderDetails = await fetchOrderFromML(orderId, accessToken)

    if (!orderDetails) {
      logger.error(`[OrderProcessor] Could not fetch order details for ${orderId}`)
      return
    }

    logger.info(`[OrderProcessor] Order details fetched`, {
      orderId,
      buyerId: orderDetails.buyer.id,
      sellerId: orderDetails.seller.id,
      status: orderDetails.status,
      totalAmount: orderDetails.total_amount
    })

    // 2️⃣ SALVAR/ATUALIZAR ORDER NO BANCO
    const order = await prisma.order.upsert({
      where: { mlOrderId: orderId },
      update: {
        status: orderDetails.status,
        statusDetail: orderDetails.status_detail || null,
        paidAmount: orderDetails.paid_amount,
        dateClosed: orderDetails.date_closed ? new Date(orderDetails.date_closed) : null,
        lastUpdated: new Date(orderDetails.last_updated),
        paymentMethod: orderDetails.payments?.[0]?.payment_method_id || null,
        paymentStatus: orderDetails.payments?.[0]?.status || null,
        mlPayload: orderDetails as any
      },
      create: {
        mlOrderId: orderId,
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        sellerId: orderDetails.seller.id.toString(),
        buyerId: orderDetails.buyer.id.toString(),
        totalAmount: orderDetails.total_amount,
        paidAmount: orderDetails.paid_amount,
        currencyId: orderDetails.currency_id,
        status: orderDetails.status,
        statusDetail: orderDetails.status_detail || null,
        orderItems: orderDetails.order_items as any,
        paymentMethod: orderDetails.payments?.[0]?.payment_method_id || null,
        paymentStatus: orderDetails.payments?.[0]?.status || null,
        shippingId: orderDetails.shipping?.id?.toString() || null,
        shippingCost: orderDetails.shipping?.shipping_cost || 0,
        dateCreated: new Date(orderDetails.date_created),
        dateClosed: orderDetails.date_closed ? new Date(orderDetails.date_closed) : null,
        mlPayload: orderDetails as any
      }
    })

    logger.info(`[OrderProcessor] Order saved to database`, {
      orderId: order.mlOrderId,
      status: order.status,
      id: order.id
    })

    // 3️⃣ 🎯 TRACKING DE CONVERSÃO - Detectar se cliente já fez perguntas
    if (order.status === 'paid' || order.status === 'confirmed') {
      await trackConversion(order, mlAccount)
    } else {
      logger.info(`[OrderProcessor] Order not paid yet, skipping conversion tracking`, {
        orderId: order.mlOrderId,
        status: order.status
      })
    }

  } catch (error) {
    logger.error(`[OrderProcessor] Error processing order ${orderId}:`, { error })
  }
}

/**
 * 🎯 LÓGICA DE TRACKING DE CONVERSÃO
 * Verifica se o comprador fez perguntas antes de comprar
 * Se sim, vincula a venda às perguntas = CONVERSÃO!
 */
async function trackConversion(order: any, mlAccount: MLAccountData) {
  try {
    logger.info(`[OrderProcessor] 🎯 Starting conversion tracking`, {
      orderId: order.mlOrderId,
      buyerId: order.buyerId,
      sellerId: order.sellerId
    })

    // BUSCAR PERGUNTAS DO COMPRADOR PARA ESTE VENDEDOR
    // Perguntas que foram respondidas (pelo Agent ou manualmente)
    const buyerQuestions = await prisma.question.findMany({
      where: {
        customerId: order.buyerId,
        sellerId: order.sellerId,
        mlAccountId: mlAccount.id,
        status: {
          in: ['RESPONDED', 'COMPLETED', 'SENT_TO_ML', 'AWAITING_APPROVAL']
        },
        answeredAt: { not: null },
        // Opcional: limitar janela de atribuição (ex: perguntas nos últimos 30 dias)
        // dateCreated: {
        //   gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        // }
      },
      orderBy: { answeredAt: 'desc' }
    })

    logger.info(`[OrderProcessor] Found ${buyerQuestions.length} questions from buyer`, {
      orderId: order.mlOrderId,
      buyerId: order.buyerId,
      questionsCount: buyerQuestions.length
    })

    if (buyerQuestions.length > 0) {
      // ✅ CONVERSÃO DETECTADA!
      logger.info(`[OrderProcessor] 🎉 CONVERSION DETECTED!`, {
        orderId: order.mlOrderId,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        questionsCount: buyerQuestions.length,
        conversionValue: order.totalAmount,
        currency: order.currencyId,
        questions: buyerQuestions.map(q => ({
          id: q.mlQuestionId,
          text: q.text.substring(0, 50),
          answeredAt: q.answeredAt
        }))
      })

      // Calcular tempo de conversão (da primeira pergunta à venda)
      const firstQuestion = buyerQuestions[buyerQuestions.length - 1]
      const timeToConversion = order.dateClosed && firstQuestion?.answeredAt
        ? Math.floor((order.dateClosed.getTime() - firstQuestion.answeredAt.getTime()) / 60000) // minutos
        : null

      // VINCULAR PERGUNTAS À ORDER (criar registros OrderConversion)
      for (const question of buyerQuestions) {
        await prisma.orderConversion.upsert({
          where: {
            questionId_orderId: {
              questionId: question.id,
              orderId: order.id
            }
          },
          update: {
            conversionValue: order.totalAmount,
            timeToConversion
          },
          create: {
            questionId: question.id,
            orderId: order.id,
            conversionValue: order.totalAmount,
            timeToConversion
          }
        })
      }

      // ATUALIZAR FLAGS DE CONVERSÃO NAS PERGUNTAS
      await prisma.question.updateMany({
        where: { id: { in: buyerQuestions.map(q => q.id) } },
        data: {
          hasConversion: true,
          convertedAt: order.dateClosed || new Date(),
          conversionValue: order.totalAmount
        }
      })

      // ATUALIZAR FLAGS NA ORDER
      await prisma.order.update({
        where: { id: order.id },
        data: {
          hasRelatedQuestions: true,
          attributedToAgent: true
        }
      })

      logger.info(`[OrderProcessor] ✅ Conversion tracking completed`, {
        orderId: order.mlOrderId,
        questionsLinked: buyerQuestions.length,
        timeToConversionMinutes: timeToConversion
      })

      // 🔔 EMITIR EVENTO WEBSOCKET PARA DASHBOARD
      try {
        const { emitToOrganization } = require('@/lib/websocket/emit-events')

        emitToOrganization(mlAccount.organizationId, 'conversion:detected', {
          orderId: order.mlOrderId,
          buyerId: order.buyerId,
          conversionValue: order.totalAmount,
          currency: order.currencyId,
          questionsCount: buyerQuestions.length,
          timeToConversionMinutes: timeToConversion,
          items: order.orderItems
        })

        logger.info(`[OrderProcessor] 🚀 Conversion event emitted to dashboard`)
      } catch (wsError) {
        logger.error(`[OrderProcessor] Failed to emit conversion event:`, { error: wsError })
      }

      // 📊 REGISTRAR NO AUDIT LOG
      await prisma.auditLog.create({
        data: {
          action: 'conversion.detected',
          entityType: 'order',
          entityId: order.id,
          organizationId: mlAccount.organizationId,
          mlAccountId: mlAccount.id,
          metadata: {
            orderId: order.mlOrderId,
            buyerId: order.buyerId,
            conversionValue: order.totalAmount,
            questionsCount: buyerQuestions.length,
            timeToConversionMinutes: timeToConversion
          }
        }
      })

    } else {
      logger.info(`[OrderProcessor] ℹ️ No questions found from this buyer - organic sale`, {
        orderId: order.mlOrderId,
        buyerId: order.buyerId
      })
    }

  } catch (error) {
    logger.error(`[OrderProcessor] Error in conversion tracking:`, { error })
  }
}

/**
 * Busca dados completos da order na API do ML
 */
async function fetchOrderFromML(orderId: string, accessToken: string): Promise<MLOrderData | null> {
  try {
    logger.info(`[OrderProcessor] 🔍 Fetching order from ML API`, {
      orderId,
      timestamp: new Date().toISOString()
    })

    const response = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    logger.info(`[OrderProcessor] 📡 ML API Response`, {
      orderId,
      status: response.status,
      statusText: response.statusText
    })

    if (response.status === 404) {
      logger.warn(`[OrderProcessor] Order ${orderId} not found (404)`)
      return null
    }

    if (response.status === 429) {
      logger.warn(`[OrderProcessor] Rate limited, waiting...`)
      // Aguardar e tentar novamente
      await new Promise(resolve => setTimeout(resolve, 5000))
      const retryResponse = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })

      if (!retryResponse.ok) {
        throw new Error(`API error ${retryResponse.status}: ${await retryResponse.text()}`)
      }

      return await retryResponse.json()
    }

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${await response.text()}`)
    }

    const orderData = await response.json()
    logger.info(`[OrderProcessor] ✅ Order data fetched successfully`, {
      orderId,
      status: orderData.status,
      totalAmount: orderData.total_amount
    })

    return orderData

  } catch (error: any) {
    logger.error(`[OrderProcessor] Failed to fetch order ${orderId}:`, {
      error: error?.message || error
    })
    return null
  }
}

const ordersProcessor = {
  processOrderWebhook
}

export default ordersProcessor

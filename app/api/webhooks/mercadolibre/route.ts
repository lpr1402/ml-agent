/**
 * Webhook handler para notificações do Mercado Livre
 * Implementa validação HMAC-SHA256 conforme documentação ML
 * Processa questions, orders e outras notificações
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateMLWebhook } from '@/lib/security/webhook-validator'
import { processQuestionWebhook } from '@/lib/webhooks/question-processor'

// Webhook secret configurado no ML (futura implementação de validação HMAC)
// const WEBHOOK_SECRET = process.env['ML_WEBHOOK_SECRET']!

export async function POST(request: NextRequest) {
  try {
    // Obter body como texto para validação da assinatura
    const body = await request.text()
    const signature = request.headers.get('x-signature') || request.headers.get('x-hub-signature')
    
    // Obter IP real do request (para log futuro)
    // const ip = getRealIP(request, request.headers)
    
    // Validação do webhook ML
    const validation = validateMLWebhook(request, request.headers)
    
    if (!validation.isValid) {
      logger.error('[Webhook] Validation failed:', { data: validation.reason })
      
      // Registrar tentativa de webhook inválido
      await prisma.auditLog.create({
        data: {
          action: 'webhook.validation_failed',
          entityType: 'webhook',
          entityId: 'unknown',
          organizationId: 'system',
          metadata: {
            reason: validation.reason,
            ip: validation.ip || 'unknown',
            signature: signature ? signature.substring(0, 20) + '...' : 'none',
            bodyPreview: body.substring(0, 100)
          },
          ipAddress: validation.ip || 'unknown'
        }
      })
      
      return NextResponse.json({ 
        error: validation.reason,
        details: process.env.NODE_ENV === 'development' ? validation : undefined
      }, { status: 403 })
    }
    
    // Parse do body
    const data = JSON.parse(body)
    
    // Validar campos obrigatórios do webhook ML
    if (!data.topic || !data.resource || !data.user_id) {
      logger.error('[Webhook] Missing required fields:', { error: data })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Log do webhook recebido
    logger.info(`[Webhook] Received ${data.topic} for user ${data.user_id}`)
    
    // Buscar conta ML baseada no user_id
    const mlAccount = await prisma.mLAccount.findFirst({
      where: { 
        mlUserId: data.user_id.toString(),
        isActive: true
      },
      include: {
        organization: true
      }
    })
    
    if (!mlAccount) {
      logger.warn(`[Webhook] No active ML account found for user ${data.user_id}`)
      // Ainda assim registramos o webhook para análise posterior
    }
    
    // Registrar webhook no banco
    const idempotencyKey = `${data.topic}-${data.resource}-${data.user_id}-${data.sent || Date.now()}`
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        idempotencyKey,
        mlAccountId: mlAccount?.id ?? null,
        organizationId: mlAccount?.organizationId || 'unknown',
        eventType: data.topic || 'unknown',
        eventId: data.resource?.split('/').pop() || null,
        topic: data.topic || null,
        resourceId: data.resource || '',
        resourceUrl: data.resource || null,
        userId: data.user_id?.toString() || null,
        applicationId: data.application_id?.toString() || null,
        attemptId: data.attempt_id || null,
        sentAt: data.sent ? new Date(data.sent) : new Date(),
        receivedAt: new Date(),
        processed: false,
        payload: data,
        signature: signature || null
      }
    })
    
    // ⚡ PERFORMANCE: Responder 200 IMEDIATAMENTE (< 500ms requirement)
    // Processar webhook de forma ASYNC (não bloquear resposta)
    const processAsync = async () => {
      try {
        switch (data.topic) {
          case 'questions':
            // GARANTIA EXTRA: Log de todas perguntas recebidas
            logger.info('[Webhook] 📨 QUESTION WEBHOOK RECEIVED', {
              questionId: data.resource?.split('/').pop(),
              userId: data.user_id,
              timestamp: new Date().toISOString(),
              webhookId: webhookEvent.id
            })

            // Processar nova pergunta
            if (mlAccount) {
              await processQuestionWebhook(data, mlAccount)

              // Marcar webhook como processado
              await prisma.webhookEvent.update({
                where: { id: webhookEvent.id },
                data: {
                  processed: true,
                  processedAt: new Date(),
                  status: 'COMPLETED'
                }
              })

              logger.info('[Webhook] ✅ Question webhook processed successfully', {
                questionId: data.resource?.split('/').pop(),
                webhookId: webhookEvent.id
              })
            } else {
              logger.warn('[Webhook] ⚠️ No ML account found for question webhook', {
                questionId: data.resource?.split('/').pop(),
                userId: data.user_id
              })
            }
            break

          case 'orders_v2':
          case 'orders':
            // 💰 ORDERS WEBHOOK - Real-time sales updates
            logger.info('[Webhook] 💰 ORDER WEBHOOK RECEIVED', {
              topic: data.topic,
              resource: data.resource,
              userId: data.user_id,
              webhookId: webhookEvent.id
            })

            if (mlAccount) {
              const { processOrderWebhook } = await import('@/lib/webhooks/orders-processor')

              await processOrderWebhook(data, {
                id: mlAccount.id,
                mlUserId: mlAccount.mlUserId,
                organizationId: mlAccount.organizationId,
                siteId: mlAccount.siteId,
                accessToken: mlAccount.accessToken,
                accessTokenIV: mlAccount.accessTokenIV,
                accessTokenTag: mlAccount.accessTokenTag
              })

              await prisma.webhookEvent.update({
                where: { id: webhookEvent.id },
                data: {
                  processed: true,
                  processedAt: new Date(),
                  status: 'COMPLETED'
                }
              })

              logger.info('[Webhook] ✅ Order webhook processed', {
                resource: data.resource,
                webhookId: webhookEvent.id
              })
            }
            break

          case 'items':
            // 🏷️ ITEMS WEBHOOK - Product changes + Profile refresh trigger
            logger.info('[Webhook] 🏷️ ITEM WEBHOOK RECEIVED', {
              resource: data.resource,
              userId: data.user_id,
              webhookId: webhookEvent.id
            })

            if (mlAccount) {
              const { processItemWebhook } = await import('@/lib/webhooks/items-processor')

              await processItemWebhook(data, {
                id: mlAccount.id,
                mlUserId: mlAccount.mlUserId,
                organizationId: mlAccount.organizationId,
                siteId: mlAccount.siteId
              })

              await prisma.webhookEvent.update({
                where: { id: webhookEvent.id },
                data: {
                  processed: true,
                  processedAt: new Date(),
                  status: 'COMPLETED'
                }
              })

              logger.info('[Webhook] ✅ Item webhook processed', {
                resource: data.resource,
                webhookId: webhookEvent.id
              })
            }
            break

          case 'payments':
            // 💳 PAYMENTS WEBHOOK - Payment status updates
            logger.info('[Webhook] 💳 PAYMENT WEBHOOK RECEIVED', {
              resource: data.resource,
              userId: data.user_id,
              webhookId: webhookEvent.id
            })

            if (mlAccount) {
              const { processPaymentWebhook } = await import('@/lib/webhooks/payments-processor')

              await processPaymentWebhook(data, {
                id: mlAccount.id,
                mlUserId: mlAccount.mlUserId,
                organizationId: mlAccount.organizationId,
                siteId: mlAccount.siteId,
                accessToken: mlAccount.accessToken,
                accessTokenIV: mlAccount.accessTokenIV,
                accessTokenTag: mlAccount.accessTokenTag
              })

              await prisma.webhookEvent.update({
                where: { id: webhookEvent.id },
                data: {
                  processed: true,
                  processedAt: new Date(),
                  status: 'COMPLETED'
                }
              })

              logger.info('[Webhook] ✅ Payment webhook processed', {
                resource: data.resource,
                webhookId: webhookEvent.id
              })
            }
            break

          case 'messages':
            // 💬 MESSAGES WEBHOOK - Chat messages
            logger.info('[Webhook] 💬 MESSAGE WEBHOOK RECEIVED', {
              resource: data.resource,
              userId: data.user_id,
              webhookId: webhookEvent.id,
              actions: data.actions
            })

            // Emit WebSocket event para UI (toast notification opcional)
            if (mlAccount) {
              try {
                const { emitToOrganization } = require('@/lib/websocket/emit-events')

                emitToOrganization(
                  mlAccount.organizationId,
                  'message:received',
                  {
                    messageId: data.resource,
                    accountId: mlAccount.id,
                    actions: data.actions,
                    receivedAt: new Date()
                  }
                )
              } catch (wsError) {
                logger.warn('[Webhook] Failed to emit message event', { error: wsError })
              }

              await prisma.webhookEvent.update({
                where: { id: webhookEvent.id },
                data: {
                  processed: true,
                  processedAt: new Date(),
                  status: 'COMPLETED'
                }
              })
            }
            break

          default:
            logger.info(`[Webhook] Unknown topic: ${data.topic}`)
        }

      } catch (processingError) {
        logger.error('[Webhook] Processing error:', { error: { error: processingError } })

        // Atualizar webhook com erro
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            processingError: processingError instanceof Error ? processingError.message : 'Unknown error',
            status: 'FAILED'
          }
        })
      }
    }

    // ⚡ CRITICAL: Processar ASYNC - não aguardar
    setImmediate(() => {
      processAsync().catch(err => {
        logger.error('[Webhook] Async processing failed', { error: err })
      })
    })

    // ⚡ Retornar sucesso IMEDIATAMENTE (< 500ms requirement)
    return NextResponse.json({
      received: true,
      webhookId: webhookEvent.id
    })
    
  } catch (_error) {
    logger.error('[Webhook] Fatal error:', { error: _error })
    
    // Ainda assim retornamos 200 para evitar retry do ML
    return NextResponse.json({ 
      received: true,
      error: 'Internal processing error' 
    })
  }
}

/**
 * GET - Verificação de webhook (ML pode enviar GET para verificar)
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')
  
  if (challenge) {
    // Responder ao challenge do ML para verificação
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({ 
    status: 'ok',
    webhook: 'mercadolibre' 
  })
}
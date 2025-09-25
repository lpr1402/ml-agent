import * as crypto from 'crypto'
/**
 * Mercado Livre Webhook Handler
 * Processes all incoming ML webhooks with proper validation
 * Production-ready for September 2025
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { MLWebhookValidator } from '@/lib/webhooks/ml-webhook-validator'
// import { mlCircuitBreaker } from '@/lib/resilience/ml-circuit-breaker' // Unused - removed
import { auditLog, AUDIT_ACTIONS } from '@/lib/audit/audit-logger'
import { cache } from '@/lib/cache/cache-strategy'

// ML Webhook event types
enum WebhookTopic {
  QUESTIONS = 'questions',
  ORDERS = 'orders_v2',
  ITEMS = 'items',
  MESSAGES = 'messages',
  CLAIMS = 'claims',
  SHIPMENTS = 'shipments',
  PAYMENTS = 'payments'
}

interface WebhookPayload {
  _id: string
  topic: string
  resource: string
  user_id: string
  application_id: string
  sent: string
  attempts: number
  received: string
}

/**
 * POST /api/webhooks/ml
 * Handles all ML webhook notifications
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let payload: WebhookPayload | null = null
  
  try {
    // Parse request body
    const body = await request.text()
    
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      logger.error('[ML Webhook] Invalid JSON payload', { error: parseError })
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    
    // Validate webhook signature and source IP
    const validation = await MLWebhookValidator.validateWebhook(request, payload)
    if (!validation.valid) {
      logger.warn('[ML Webhook] Validation failed', { 
        reason: validation.reason,
        payload 
      })
      
      // Security audit
      await auditLog({
        action: AUDIT_ACTIONS.WEBHOOK_VALIDATION_FAILED,
        entityType: 'webhook',
        entityId: payload?._id || 'unknown',
        metadata: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
          reason: validation.reason,
          topic: payload?.topic,
          resource: payload?.resource
        }
      })
      
      return NextResponse.json(
        { error: validation.reason },
        { status: (validation as any).statusCode || 400 || 400 }
      )
    }
    
    // Check for duplicate processing (idempotency)
    const cacheKey = `webhook:${payload!._id}`
    const processed = await cache.get(cacheKey) as boolean | null
    
    if (processed) {
      logger.info('[ML Webhook] Duplicate webhook ignored', { id: payload!._id })
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }
    
    // Process webhook based on topic
    await processWebhook(payload!)
    
    // Mark as processed (cache for 24 hours)
    await cache.set(cacheKey, true, 86400)
    
    // Audit successful webhook
    await auditLog({
      action: AUDIT_ACTIONS.WEBHOOK_RECEIVED,
      entityType: 'webhook',
      entityId: payload!._id,
      metadata: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        topic: payload!.topic,
        resource: payload!.resource,
        user_id: payload!.user_id,
        processingTime: Date.now() - startTime
      }
    })
    
    // Return success immediately (async processing)
    return NextResponse.json(
      { message: 'Webhook received' },
      { status: 200 }
    )
    
  } catch (_error) {
    logger.error('[ML Webhook] Processing error', { 
      error: _error,
      payload 
    })
    
    // Don't return 5xx to avoid ML retries for bad data
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 400 }
    )
  }
}

/**
 * Process webhook based on topic
 */
async function processWebhook(payload: WebhookPayload): Promise<void> {
  const { topic, resource, user_id } = payload
  
  logger.info('[ML Webhook] Processing webhook', { 
    topic,
    resource,
    user_id 
  })
  
  // Find ML account by user_id
  const mlAccount = await prisma.mLAccount.findUnique({
    where: { mlUserId: user_id },
    include: { organization: true }
  })
  
  if (!mlAccount) {
    logger.warn('[ML Webhook] ML account not found', { user_id })
    return
  }
  
  // Process based on topic
  switch (topic) {
    case WebhookTopic.QUESTIONS:
      await processQuestionWebhook(resource, mlAccount)
      break
      
    case WebhookTopic.ORDERS:
      await processOrderWebhook(resource, mlAccount)
      break
      
    case WebhookTopic.ITEMS:
      await processItemWebhook(resource, mlAccount)
      break
      
    case WebhookTopic.MESSAGES:
      await processMessageWebhook(resource, mlAccount)
      break
      
    case WebhookTopic.CLAIMS:
      await processClaimWebhook(resource, mlAccount)
      break
      
    case WebhookTopic.SHIPMENTS:
      await processShipmentWebhook(resource, mlAccount)
      break
      
    case WebhookTopic.PAYMENTS:
      await processPaymentWebhook(resource, mlAccount)
      break
      
    default:
      logger.warn('[ML Webhook] Unknown topic', { topic })
  }
}

/**
 * Process question webhook
 */
async function processQuestionWebhook(resource: string, mlAccount: any): Promise<void> {
  try {
    // Extract question ID from resource URL
    const questionId = resource.split('/').pop()
    
    if (!questionId) {
      logger.error('[ML Webhook] Invalid question resource', { resource })
      return
    }
    
    // Check if question already exists
    const existingQuestion = await prisma.question.findUnique({
      where: { mlQuestionId: questionId }
    })
    
    if (existingQuestion) {
      logger.info('[ML Webhook] Question already exists', { questionId })
      return
    }
    
    // Create webhook event for processing
    await prisma.webhookEvent.create({
      data: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        eventType: 'QUESTION_RECEIVED',
        resourceId: questionId,
        resourceUrl: resource,
        status: 'PENDING',
        payload: { resource }
      }
    })
    
    logger.info('[ML Webhook] Question webhook queued', { 
      questionId,
      mlAccountId: mlAccount.id 
    })
    
  } catch (_error) {
    logger.error('[ML Webhook] Question processing failed', { 
      error: _error,
      resource 
    })
  }
}

/**
 * Process order webhook
 */
async function processOrderWebhook(resource: string, mlAccount: any): Promise<void> {
  try {
    const orderId = resource.split('/').pop()
    
    if (!orderId) {
      logger.error('[ML Webhook] Invalid order resource', { resource })
      return
    }
    
    // Create webhook event for processing
    await prisma.webhookEvent.create({
      data: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        eventType: 'ORDER_UPDATED',
        resourceId: orderId,
        resourceUrl: resource,
        status: 'PENDING',
        payload: { resource }
      }
    })
    
    logger.info('[ML Webhook] Order webhook queued', { 
      orderId,
      mlAccountId: mlAccount.id 
    })
    
  } catch (_error) {
    logger.error('[ML Webhook] Order processing failed', { 
      error: _error,
      resource 
    })
  }
}

/**
 * Process item webhook
 */
async function processItemWebhook(resource: string, mlAccount: any): Promise<void> {
  try {
    const itemId = resource.split('/').pop()
    
    if (!itemId) {
      logger.error('[ML Webhook] Invalid item resource', { resource })
      return
    }
    
    // Invalidate item cache
    await cache.invalidate(`item:${itemId}`)
    
    // Create webhook event
    await prisma.webhookEvent.create({
      data: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        eventType: 'ITEM_UPDATED',
        resourceId: itemId,
        resourceUrl: resource,
        status: 'PENDING',
        payload: { resource }
      }
    })
    
    logger.info('[ML Webhook] Item webhook queued', { 
      itemId,
      mlAccountId: mlAccount.id 
    })
    
  } catch (_error) {
    logger.error('[ML Webhook] Item processing failed', { 
      error: _error,
      resource 
    })
  }
}

/**
 * Process message webhook
 */
async function processMessageWebhook(resource: string, mlAccount: any): Promise<void> {
  try {
    const messageId = resource.split('/').pop()
    
    if (!messageId) {
      logger.error('[ML Webhook] Invalid message resource', { resource })
      return
    }
    
    // Create webhook event
    await prisma.webhookEvent.create({
      data: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        eventType: 'MESSAGE_RECEIVED',
        resourceId: messageId,
        resourceUrl: resource,
        status: 'PENDING',
        payload: { resource }
      }
    })
    
    logger.info('[ML Webhook] Message webhook queued', { 
      messageId,
      mlAccountId: mlAccount.id 
    })
    
  } catch (_error) {
    logger.error('[ML Webhook] Message processing failed', { 
      error: _error,
      resource 
    })
  }
}

/**
 * Process claim webhook
 */
async function processClaimWebhook(resource: string, mlAccount: any): Promise<void> {
  try {
    const claimId = resource.split('/').pop()
    
    if (!claimId) {
      logger.error('[ML Webhook] Invalid claim resource', { resource })
      return
    }
    
    // High priority event - claims are critical
    await prisma.webhookEvent.create({
      data: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        eventType: 'CLAIM_CREATED',
        resourceId: claimId,
        resourceUrl: resource,
        status: 'PENDING',
        priority: 1, // HIGH priority = 1
        payload: { resource }
      }
    })
    
    logger.warn('[ML Webhook] CLAIM webhook received', { 
      claimId,
      mlAccountId: mlAccount.id 
    })
    
  } catch (_error) {
    logger.error('[ML Webhook] Claim processing failed', { 
      error: _error,
      resource 
    })
  }
}

/**
 * Process shipment webhook
 */
async function processShipmentWebhook(resource: string, mlAccount: any): Promise<void> {
  try {
    const shipmentId = resource.split('/').pop()
    
    if (!shipmentId) {
      logger.error('[ML Webhook] Invalid shipment resource', { resource })
      return
    }
    
    // Create webhook event
    await prisma.webhookEvent.create({
      data: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        eventType: 'SHIPMENT_UPDATED',
        resourceId: shipmentId,
        resourceUrl: resource,
        status: 'PENDING',
        payload: { resource }
      }
    })
    
    logger.info('[ML Webhook] Shipment webhook queued', { 
      shipmentId,
      mlAccountId: mlAccount.id 
    })
    
  } catch (_error) {
    logger.error('[ML Webhook] Shipment processing failed', { 
      error: _error,
      resource 
    })
  }
}

/**
 * Process payment webhook
 */
async function processPaymentWebhook(resource: string, mlAccount: any): Promise<void> {
  try {
    const paymentId = resource.split('/').pop()
    
    if (!paymentId) {
      logger.error('[ML Webhook] Invalid payment resource', { resource })
      return
    }
    
    // High priority - payments are critical
    await prisma.webhookEvent.create({
      data: {
          idempotencyKey: crypto.randomBytes(16).toString('hex'),
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        eventType: 'PAYMENT_UPDATED',
        resourceId: paymentId,
        resourceUrl: resource,
        status: 'PENDING',
        priority: 1, // HIGH priority = 1
        payload: { resource }
      }
    })
    
    logger.info('[ML Webhook] Payment webhook queued', { 
      paymentId,
      mlAccountId: mlAccount.id 
    })
    
  } catch (_error) {
    logger.error('[ML Webhook] Payment processing failed', { 
      error: _error,
      resource 
    })
  }
}

/**
 * GET /api/webhooks/ml
 * Health check endpoint for ML webhook validation
 */
export async function GET(_request: NextRequest) {
  // ML sends GET requests to validate webhook URL
  return NextResponse.json(
    { 
      status: 'active',
      application: 'ML Agent',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  )
}
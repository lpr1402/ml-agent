/**
 * API para confirmar pagamento PIX
 * Ativa a assinatura após confirmação manual
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/ml-auth'
import { prisma } from '@/lib/prisma'
import { auditLog, AUDIT_ACTIONS } from '@/lib/audit/audit-logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { organizationId, amount, method } = await request.json()
    
    // Verifica se a organização corresponde à sessão
    if (organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    // Cria registro de pagamento
    const payment = await prisma.payment.create({
      data: {
        organizationId,
        amount: amount || 500.00,
        currency: 'BRL',
        method: method || 'PIX',
        status: 'CONFIRMED',
        paidAt: new Date(),
        confirmedBy: session.primaryMLUserId,
        metadata: {
          confirmedFrom: 'dashboard',
          sessionId: session.sessionToken
        }
      }
    })
    
    // Ativa a assinatura
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: thirtyDaysFromNow
      }
    })
    
    // Audit log
    await auditLog({
      action: AUDIT_ACTIONS.PAYMENT_CONFIRMED,
      entityType: 'payment',
      entityId: payment.id,
      organizationId,
      metadata: {
        amount,
        method,
        confirmedBy: session.primaryMLUserId
      }
    })
    
    await auditLog({
      action: AUDIT_ACTIONS.SUBSCRIPTION_ACTIVATED,
      entityType: 'organization',
      entityId: organizationId,
      organizationId,
      metadata: {
        status: 'ACTIVE',
        endsAt: thirtyDaysFromNow
      }
    })
    
    logger.info(`[Payments] Payment confirmed for org ${organizationId}`)
    
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt
      },
      subscription: {
        status: 'ACTIVE',
        endsAt: thirtyDaysFromNow
      }
    })
    
  } catch (error) {
    logger.error('[Payments] Error confirming payment:', { error })
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}

// GET - Verifica status da assinatura
export async function GET(_request: Request) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        trialEndsAt: true
      }
    })
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    // Verifica se precisa atualizar status
    const now = new Date()
    let needsUpdate = false
    let newStatus = organization.subscriptionStatus
    
    if (organization.subscriptionStatus === 'ACTIVE' && 
        organization.subscriptionEndsAt && 
        organization.subscriptionEndsAt < now) {
      newStatus = 'EXPIRED'
      needsUpdate = true
    } else if (organization.subscriptionStatus === 'TRIAL' && 
               organization.trialEndsAt && 
               organization.trialEndsAt < now) {
      newStatus = 'EXPIRED'
      needsUpdate = true
    }
    
    if (needsUpdate) {
      await prisma.organization.update({
        where: { id: session.organizationId },
        data: { subscriptionStatus: newStatus }
      })
    }
    
    // Busca últimos pagamentos
    const payments = await prisma.payment.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        amount: true,
        status: true,
        paidAt: true,
        createdAt: true
      }
    })
    
    return NextResponse.json({
      subscription: {
        status: newStatus,
        endsAt: organization.subscriptionStatus === 'ACTIVE' 
          ? organization.subscriptionEndsAt 
          : organization.trialEndsAt,
        isActive: newStatus === 'ACTIVE' || newStatus === 'TRIAL',
        requiresPayment: newStatus === 'EXPIRED' || newStatus === 'PAST_DUE'
      },
      payments
    })
    
  } catch (error) {
    logger.error('[Payments] Error getting subscription status:', { error })
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}
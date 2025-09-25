/**
 * API para remover conta ML da organização
 * Apenas contas secundárias podem ser removidas
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/ml-auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    // Verifica sessão
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { accountId: mlAccountId } = await params
    
    if (!mlAccountId) {
      return NextResponse.json(
        { error: 'ML account ID required' },
        { status: 400 }
      )
    }
    
    // Buscar conta ML
    const mlAccount = await prisma.mLAccount.findUnique({
      where: { id: mlAccountId },
      include: {
        organization: true
      }
    })
    
    if (!mlAccount) {
      return NextResponse.json(
        { error: 'ML account not found' },
        { status: 404 }
      )
    }
    
    // Verificar se a conta pertence à organização da sessão
    if (mlAccount.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized to remove this account' },
        { status: 403 }
      )
    }
    
    // Não permitir remover conta primária
    if (mlAccount.isPrimary) {
      return NextResponse.json(
        { error: 'Cannot remove primary account. Primary account is required for organization.' },
        { status: 400 }
      )
    }
    
    // Se esta é a conta ativa na sessão, limpar
    if (session.activeMLAccountId === mlAccountId) {
      await prisma.session.update({
        where: { id: session.id },
        data: { activeMLAccountId: null }
      })
    }
    
    // Registrar no audit log antes de remover
    await prisma.auditLog.create({
      data: {
        action: 'ml_account.removed',
        entityType: 'ml_account',
        entityId: mlAccountId,
        organizationId: session.organizationId,
        mlAccountId: session.activeMLAccountId,
        metadata: {
          removedAccount: {
            mlUserId: mlAccount.mlUserId,
            nickname: mlAccount.nickname,
            email: mlAccount.email
          }
        }
      }
    })
    
    // Remover conta (cascade deleta questions, metrics, webhooks relacionados)
    await prisma.mLAccount.delete({
      where: { id: mlAccountId }
    })
    
    logger.info(`[ML Accounts] Removed account ${mlAccount.nickname} from org ${session.organizationId}`)
    
    return NextResponse.json({
      success: true,
      message: 'ML account removed successfully'
    })
    
  } catch (error) {
    logger.error('[ML Accounts] Error removing account:', { error })
    return NextResponse.json(
      { error: 'Failed to remove ML account' },
      { status: 500 }
    )
  }
}
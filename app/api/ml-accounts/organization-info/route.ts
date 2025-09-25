import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * GET /api/ml-accounts/organization-info
 * Retorna informações sobre a organização e limites de contas
 */
export async function GET(request: NextRequest) {
  try {
    // Obter sessão do usuário
    const sessionToken = request.cookies.get('ml-agent-session')?.value
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Buscar sessão e organização
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: {
          include: {
            _count: {
              select: { mlAccounts: true }
            }
          }
        }
      }
    })
    
    if (!session || !session.organization) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 })
    }
    
    // Limites por plano
    const accountLimits = {
      TRIAL: 1,
      ACTIVE: 10,
      PAST_DUE: 3,
      CANCELLED: 0,
      EXPIRED: 0
    }
    
    const organization = session.organization
    const maxAccounts = accountLimits[organization.subscriptionStatus]
    
    return NextResponse.json({
      organizationId: organization.id,
      primaryMLUserId: organization.primaryMLUserId,
      primaryNickname: organization.primaryNickname,
      subscriptionStatus: organization.subscriptionStatus,
      plan: organization.plan,
      accountCount: organization._count.mlAccounts,
      maxAccounts,
      canAddMoreAccounts: organization._count.mlAccounts < maxAccounts,
      subscriptionEndsAt: organization.subscriptionEndsAt,
      trialEndsAt: organization.trialEndsAt
    })
    
  } catch (error) {
    logger.error('[Organization Info] Error fetching info:', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
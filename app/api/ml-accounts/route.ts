/**
 * API para gerenciar contas ML da organização
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession, getOrganizationMLAccounts, removeMLAccount, switchMLAccount } from '@/lib/auth/ml-auth'
import { mlApi } from '@/lib/ml-api/api-client'

// GET - Lista todas as contas ML da organização
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const accounts = await getOrganizationMLAccounts(session.organizationId)
    
    // Enriquece com métricas básicas se solicitado
    const includeMetrics = request.nextUrl.searchParams.get('metrics') === 'true'
    
    if (includeMetrics) {
      const enrichedAccounts = await Promise.all(
        accounts.map(async (account) => {
          try {
            // Busca métricas básicas da API ML
            const metrics = await mlApi.getSalesMetrics(account.id, account.mlUserId)
            
            return {
              ...account,
              metrics: {
                totalOrders: metrics.metrics.totalOrders,
                reputation: metrics.metrics.reputation
              }
            }
          } catch (error) {
            logger.error(`Failed to get metrics for ${account.nickname}:`, { error })
            return {
              ...account,
              metrics: null
            }
          }
        })
      )
      
      return NextResponse.json({
        accounts: enrichedAccounts,
        activeAccountId: session.activeMLAccountId
      })
    }
    
    return NextResponse.json({
      accounts,
      activeAccountId: session.activeMLAccountId
    })
    
  } catch (error) {
    logger.error('[ML Accounts] Error listing accounts:', { error })
    return NextResponse.json(
      { error: 'Failed to list ML accounts' },
      { status: 500 }
    )
  }
}

// POST - Alterna entre contas ML
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { accountId } = await request.json()
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }
    
    const success = await switchMLAccount(session.sessionToken, accountId)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to switch account' },
        { status: 400 }
      )
    }
    
    logger.info(`[ML Accounts] Switched to account ${accountId}`)
    
    return NextResponse.json({ 
      success: true,
      activeAccountId: accountId
    })
    
  } catch (error) {
    logger.error('[ML Accounts] Error switching account:', { error })
    return NextResponse.json(
      { error: 'Failed to switch ML account' },
      { status: 500 }
    )
  }
}

// DELETE - Remove uma conta ML da organização
export async function DELETE(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { searchParams } = request.nextUrl
    const accountId = searchParams.get('accountId')
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }
    
    const success = await removeMLAccount(session.organizationId, accountId)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove account or account is primary' },
        { status: 400 }
      )
    }
    
    logger.info(`[ML Accounts] Removed account ${accountId}`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Account removed successfully'
    })
    
  } catch (error) {
    logger.error('[ML Accounts] Error removing account:', { error })
    return NextResponse.json(
      { error: 'Failed to remove ML account' },
      { status: 500 }
    )
  }
}
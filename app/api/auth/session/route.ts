import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function GET(_request: Request) {
  try {
    const cookieStore = await cookies()
    // Cookie padronizado para produção
    const sessionToken = cookieStore.get("ml-agent-session")?.value
    
    if (!sessionToken) {
      return NextResponse.json(null, { status: 401 })
    }
    
    // Buscar sessão no banco
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: {
          include: {
            mlAccounts: {
              where: { isActive: true }
            }
          }
        }
      }
    })
    
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(null, { status: 401 })
    }
    
    // Buscar a conta ML ativa
    const activeAccount = session.activeMLAccountId 
      ? session.organization.mlAccounts.find(acc => acc.id === session.activeMLAccountId)
      : session.organization.mlAccounts.find(acc => acc.isPrimary)
    
    // Retornar dados completos da sessão para o dashboard multi-conta
    return NextResponse.json({
      // Dados essenciais para o dashboard
      organizationId: session.organizationId,
      organizationName: session.organization.primaryNickname || 'ML Agent Pro',
      accountCount: session.organization.mlAccounts.length,
      plan: session.organization.plan || 'TRIAL',
      
      // Dados do usuário/conta ativa
      user: {
        id: session.organization.primaryMLUserId,
        nickname: activeAccount?.nickname || session.organization.primaryNickname,
        email: activeAccount?.email || session.organization.primaryEmail,
        siteId: activeAccount?.siteId || session.organization.primarySiteId,
      },
      
      // Dados da organização
      organization: {
        id: session.organization.id,
        subscriptionStatus: session.organization.subscriptionStatus,
        trialEndsAt: session.organization.trialEndsAt,
        subscriptionEndsAt: session.organization.subscriptionEndsAt
      },
      
      // Conta ativa
      activeAccount: activeAccount ? {
        id: activeAccount.id,
        mlUserId: activeAccount.mlUserId,
        nickname: activeAccount.nickname,
        isPrimary: activeAccount.isPrimary
      } : null,
      
      // Todas as contas
      accounts: session.organization.mlAccounts.map(acc => ({
        id: acc.id,
        mlUserId: acc.mlUserId,
        nickname: acc.nickname,
        isPrimary: acc.isPrimary,
        isActive: acc.isActive
      })),
      
      // Dados da sessão
      sessionToken,
      expiresAt: session.expiresAt
    })
  } catch (error) {
    logger.error("Session check error:", { error })
    return NextResponse.json(null, { status: 500 })
  }
}
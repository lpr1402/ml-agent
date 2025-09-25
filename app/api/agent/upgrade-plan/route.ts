import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"

export async function POST(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = auth.organizationId

    // Atualizar plano da organização para PRO
    const updatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 ano
      }
    })

    logger.info('[Upgrade Plan] Organization upgraded to PRO', {
      organizationId,
      nickname: auth.mlAccount?.nickname
    })

    return NextResponse.json({
      success: true,
      plan: updatedOrg.plan,
      message: 'Plano atualizado para PRO com sucesso!'
    })

  } catch (error) {
    logger.error('[Upgrade Plan] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({
      error: "Erro ao atualizar plano"
    }, { status: 500 })
  }
}
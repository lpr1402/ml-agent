/**
 * API: Detalhes de Organização
 * GET /api/admin/organization/[orgId]
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateAdminAccess } from '@/lib/admin/admin-auth'

export async function GET(
  _request: Request,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const { isValid, error } = await validateAdminAccess()

    if (!isValid) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await context.params

    // Buscar organização com todas as relações
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        mlAccounts: {
          select: {
            id: true,
            mlUserId: true,
            nickname: true,
            siteId: true,
            thumbnail: true,
            isActive: true,
            tokenExpiresAt: true,
            connectionError: true,
            lastSyncAt: true,
            rateLimitCount: true,
            rateLimitReset: true
          }
        },
        _count: {
          select: {
            mlAccounts: true,
            alerts: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Contar perguntas
    const questionsTotal = await prisma.question.count({
      where: {
        mlAccount: { organizationId: orgId }
      }
    })

    const questionsToday = await prisma.question.count({
      where: {
        mlAccount: { organizationId: orgId },
        receivedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })

    const questionsPending = await prisma.question.count({
      where: {
        mlAccount: { organizationId: orgId },
        status: { in: ['RECEIVED', 'PROCESSING', 'AWAITING_APPROVAL'] }
      }
    })

    // Buscar alertas ativos
    const alerts = await prisma.alert.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE'
      },
      orderBy: { detectedAt: 'desc' },
      take: 10
    })

    return NextResponse.json({
      success: true,
      data: {
        ...organization,
        questionsTotal,
        questionsToday,
        questionsPending,
        alerts
      }
    })

  } catch (error: any) {
    console.error('[Admin API] Error fetching organization:', error)
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 })
  }
}

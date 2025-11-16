/**
 * API: Alertas
 * GET /api/admin/alerts
 * Retorna alertas do sistema
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateAdminAccess } from '@/lib/admin/admin-auth'

export async function GET(request: NextRequest) {
  try {
    // Validar acesso admin
    const { isValid, error } = await validateAdminAccess()

    if (!isValid) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ACTIVE'
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Buscar alertas
    const alerts = await prisma.alert.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(type && { type: type as any })
      },
      include: {
        organization: {
          select: {
            organizationName: true,
            username: true
          }
        },
        mlAccount: {
          select: {
            nickname: true
          }
        }
      },
      orderBy: {
        detectedAt: 'desc'
      },
      take: limit
    })

    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      category: alert.category,
      message: alert.message,
      suggestedAction: alert.suggestedAction,
      actionUrl: alert.actionUrl,
      organizationName: alert.organization?.organizationName || alert.organization?.username,
      accountNickname: alert.mlAccount?.nickname,
      affectedQuestions: alert.affectedQuestions,
      status: alert.status,
      detectedAt: alert.detectedAt.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString(),
      dismissedAt: alert.dismissedAt?.toISOString()
    }))

    return NextResponse.json({
      success: true,
      data: formattedAlerts,
      total: formattedAlerts.length
    })

  } catch (error: any) {
    console.error('[Admin API] Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

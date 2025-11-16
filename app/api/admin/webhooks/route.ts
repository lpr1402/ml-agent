/**
 * API: Webhooks do Sistema
 * GET /api/admin/webhooks
 * Retorna webhooks recebidos do ML
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateAdminAccess } from '@/lib/admin/admin-auth'

export async function GET(request: NextRequest) {
  try {
    // Validar acesso admin
    const { isValid } = await validateAdminAccess()

    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    // Buscar webhooks events
    const webhookEvents = await prisma.webhookEvent.findMany({
      take: limit,
      orderBy: { receivedAt: 'desc' },
      include: {
        organization: {
          select: {
            organizationName: true,
            username: true
          }
        }
      }
    })

    // Calcular stats
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [total, success, failed, pending, last24h] = await Promise.all([
      prisma.webhookEvent.count(),
      prisma.webhookEvent.count({ where: { status: 'SUCCESS' } }),
      prisma.webhookEvent.count({ where: { status: 'FAILED' } }),
      prisma.webhookEvent.count({ where: { status: 'PENDING' } }),
      prisma.webhookEvent.count({ where: { receivedAt: { gte: yesterday } } })
    ])

    return NextResponse.json({
      success: true,
      webhooks: webhookEvents.map(w => ({
        id: w.id,
        topic: w.topic,
        resourceId: w.resourceId,
        userId: w.userId,
        status: w.status,
        receivedAt: w.receivedAt,
        processedAt: w.processedAt,
        error: w.error,
        organizationName: w.organization?.organizationName || w.organization?.username
      })),
      stats: {
        total,
        success,
        failed,
        pending,
        last24h
      }
    })

  } catch (error: any) {
    console.error('[Admin API] Error fetching webhooks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    )
  }
}

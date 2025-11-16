/**
 * API Route - Métricas de ROI do ML Agent
 * GET /api/agent/metrics-roi
 *
 * Retorna métricas de conversão consolidadas:
 * - Vendas geradas pelo Agent
 * - Taxa de conversão
 * - Receita total
 * - Produtos que mais convertem
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/get-server-session'
import { 
  getConversionMetrics, 
  getTopConvertingProducts,
  getConversionTrend,
  getRecentConversions,
  getConversionStatsByAccount
} from '@/lib/metrics/roi-queries'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const session = await getServerSession()

    if (!session || !session.organization?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const organizationId = session.organization.id

    // Parâmetros de query
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const includeTop = searchParams.get('includeTop') === 'true'
    const includeTrend = searchParams.get('includeTrend') === 'true'
    const includeRecent = searchParams.get('includeRecent') === 'true'
    const includeByAccount = searchParams.get('includeByAccount') === 'true'

    // Calcular dateRange baseado em days
    const dateRange = days > 0 ? {
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      to: new Date()
    } : undefined

    logger.info(`[ROI API] Fetching metrics for organization ${organizationId}`, {
      days,
      dateRange
    })

    // Buscar métricas principais (sempre)
    const metrics = await getConversionMetrics(organizationId, dateRange)

    // Buscar dados opcionais
    const [topProducts, trend, recentConversions, statsByAccount] = await Promise.all([
      includeTop ? getTopConvertingProducts(organizationId, 10, dateRange) : null,
      includeTrend ? getConversionTrend(organizationId, days) : null,
      includeRecent ? getRecentConversions(organizationId, 10) : null,
      includeByAccount ? getConversionStatsByAccount(organizationId) : null
    ])

    logger.info(`[ROI API] Metrics fetched successfully`, {
      totalSales: metrics.totalSales,
      totalRevenue: metrics.totalRevenue,
      conversionRate: metrics.conversionRate
    })

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        topProducts: topProducts || [],
        trend: trend || [],
        recentConversions: recentConversions || [],
        statsByAccount: statsByAccount || []
      },
      meta: {
        organizationId,
        days,
        dateRange: dateRange ? {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString()
        } : null,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('[ROI API] Error fetching metrics:', { error })

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch ROI metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * API Route - Métricas de ROI ENTERPRISE (ALL TIME)
 * GET /api/agent/metrics-roi-alltime
 *
 * Retorna métricas REAIS de TODAS as contas ML:
 * - Vendas de TODOS OS TEMPOS (ou período customizado)
 * - ROI calculado com custos e receitas reais
 * - Conversão baseada em Orders REAIS
 * - Performance operacional multi-conta
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/get-server-session'
import {
  getConversionMetricsAllTime,
  getTopConvertingProductsAllTime,
  getConversionTrendAllTime,
  getRecentConversionsAllTime
} from '@/lib/metrics/roi-queries-enterprise'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const session = await getServerSession()

    if (!session?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const organizationId = session.organizationId

    // Parâmetros de query
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'all' // all, 30d, 7d, 24h
    const includeTop = searchParams.get('includeTop') !== 'false'
    const includeTrend = searchParams.get('includeTrend') !== 'false'
    const includeRecent = searchParams.get('includeRecent') !== 'false'

    // Calcular dateRange baseado no período
    let dateRange: { from: Date; to: Date } | undefined = undefined

    if (period !== 'all') {
      const now = new Date()
      const daysMap: Record<string, number> = {
        '24h': 1,
        '7d': 7,
        '30d': 30
      }

      const days = daysMap[period] || 30
      const from = new Date(now)
      from.setDate(from.getDate() - days)

      dateRange = { from, to: now }
    }

    logger.info('[ROI API] Fetching ALL TIME metrics', {
      organizationId,
      period,
      dateRange: dateRange ? {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString()
      } : 'ALL TIME'
    })

    // Buscar métricas principais (SEMPRE de todas as contas)
    const metrics = await getConversionMetricsAllTime(organizationId, dateRange)

    // Buscar dados complementares
    const [topProducts, trend, recentConversions] = await Promise.all([
      includeTop ? getTopConvertingProductsAllTime(organizationId, 10, dateRange) : [],
      includeTrend ? getConversionTrendAllTime(organizationId, period === 'all' ? 90 : 30) : [],
      includeRecent ? getRecentConversionsAllTime(organizationId, 10) : []
    ])

    logger.info('[ROI API] ALL TIME metrics calculated successfully', {
      totalOrders: metrics.totalOrders,
      totalRevenue: `R$ ${metrics.totalRevenue.toFixed(2)}`,
      conversionRate: `${metrics.conversionRate.toFixed(2)}%`,
      roi: `${metrics.roiPercentage.toFixed(1)}%`,
      accountsCount: metrics.accountsCount,
      period: period === 'all' ? 'TODOS OS TEMPOS' : period
    })

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        topProducts,
        trend,
        recentConversions
      },
      meta: {
        organizationId,
        period,
        dateRange: dateRange ? {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString()
        } : 'ALL_TIME',
        generatedAt: new Date().toISOString(),
        accountsCount: metrics.accountsCount
      }
    })

  } catch (error: any) {
    logger.error('[ROI API] Error fetching ALL TIME metrics', {
      error: error.message,
      stack: error.stack
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ROI metrics',
        message: error.message
      },
      { status: 500 }
    )
  }
}

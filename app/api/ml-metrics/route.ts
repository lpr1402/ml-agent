/**
 * ML METRICS API ENDPOINT
 * Expõe métricas em tempo real do sistema ML
 * GET /api/ml-metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { mlMetricsCollector } from '@/lib/metrics/ml-metrics-collector'
import { globalMLRateLimiter } from '@/lib/ml-api/global-rate-limiter'
import { getServerSession } from '@/lib/auth/get-server-session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ml-metrics
 * Retorna métricas atuais do sistema
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'dashboard'

    switch (format) {
      case 'dashboard':
        // Dashboard resumido
        const dashboard = mlMetricsCollector.getDashboard()
        return NextResponse.json({
          success: true,
          data: dashboard
        })

      case 'detailed':
        // Métricas detalhadas
        const current = mlMetricsCollector.getCurrentMetrics()
        return NextResponse.json({
          success: true,
          data: current
        })

      case 'history':
        // Histórico de métricas
        const limit = parseInt(searchParams.get('limit') || '100')
        const history = mlMetricsCollector.getMetricsHistory(limit)
        return NextResponse.json({
          success: true,
          data: history
        })

      case 'alerts':
        // Alertas
        const activeOnly = searchParams.get('active') === 'true'
        const alerts = activeOnly
          ? mlMetricsCollector.getActiveAlerts()
          : mlMetricsCollector.getAllAlerts()
        return NextResponse.json({
          success: true,
          data: alerts
        })

      case 'queue':
        // Status da fila
        const queueStatus = globalMLRateLimiter.getQueueStatus()
        return NextResponse.json({
          success: true,
          data: queueStatus
        })

      case 'export':
        // Exportar métricas
        const exportFormat = searchParams.get('exportFormat') || 'json'
        const exported = mlMetricsCollector.exportMetrics(exportFormat as 'json' | 'csv')

        if (exportFormat === 'csv') {
          return new NextResponse(String(exported), {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="ml-metrics-${Date.now()}.csv"`
            }
          })
        }

        return NextResponse.json({
          success: true,
          data: exported
        })

      default:
        return NextResponse.json(
          { error: 'Invalid format parameter' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ml-metrics
 * Ações de controle (reset, resolver alertas)
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticação
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'resolve_alert':
        if (!params.alertId) {
          return NextResponse.json(
            { error: 'alertId required' },
            { status: 400 }
          )
        }
        mlMetricsCollector.resolveAlert(params.alertId)
        return NextResponse.json({
          success: true,
          message: 'Alert resolved'
        })

      case 'clear_queue':
        globalMLRateLimiter.clearQueue(params.mlAccountId)
        return NextResponse.json({
          success: true,
          message: params.mlAccountId
            ? 'Account queue cleared'
            : 'All queues cleared'
        })

      case 'reset_metrics':
        mlMetricsCollector.reset()
        return NextResponse.json({
          success: true,
          message: 'Metrics reset'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

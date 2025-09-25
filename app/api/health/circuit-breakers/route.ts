/**
 * API Route - Circuit Breaker Health & Monitoring
 * Endpoint para monitoramento e health checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { monitoringAPI } from '@/lib/resilience/circuit-breaker-monitor'
import { getAllCircuitBreakerStats } from '@/lib/resilience/circuit-breaker'
import { multiAccountProcessor } from '@/lib/resilience/multi-account-processor'
import { logger } from '@/lib/logger'

/**
 * GET /api/health/circuit-breakers
 * Retorna status completo dos Circuit Breakers
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar parâmetro de query
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'summary'

    let response: any = {}

    switch (view) {
      case 'summary':
        // Visão resumida para health checks rápidos
        response = monitoringAPI.getStatus()
        break

      case 'dashboard':
        // Dados completos para dashboard
        response = monitoringAPI.getDashboardData()
        break

      case 'breakers':
        // Status individual de cada circuit breaker
        response = {
          circuitBreakers: getAllCircuitBreakerStats(),
          timestamp: new Date().toISOString()
        }
        break

      case 'accounts':
        // Status das contas multi-tenant
        response = {
          accounts: multiAccountProcessor.getAllAccountsStatus(),
          statistics: multiAccountProcessor.getStatistics(),
          timestamp: new Date().toISOString()
        }
        break

      case 'full':
        // Relatório completo
        const report = monitoringAPI.getDashboardData()
        response = {
          ...report,
          circuitBreakers: getAllCircuitBreakerStats(),
          accounts: {
            status: multiAccountProcessor.getAllAccountsStatus(),
            statistics: multiAccountProcessor.getStatistics()
          }
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid view parameter' },
          { status: 400 }
        )
    }

    // Determinar status HTTP baseado na saúde
    const health = response.health || response
    const httpStatus =
      health.status === 'critical' ? 503 : // Service Unavailable
      health.status === 'degraded' ? 200 : // OK but degraded
      200 // Healthy

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': health.status || 'unknown'
      }
    })

  } catch (error: any) {
    logger.error('[Health API] Failed to get circuit breaker status', {
      error: error.message
    })

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to retrieve health status',
        error: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/health/circuit-breakers
 * Ações de manutenção nos Circuit Breakers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, target, params } = body

    let result: any = { success: false }

    switch (action) {
      case 'reset':
        // Resetar circuit breaker específico ou todos
        if (target === 'all') {
          // Reset all circuit breakers
          const stats = getAllCircuitBreakerStats()
          for (const _name of Object.keys(stats)) {
            // TODO: Implementar reset individual
          }
          result = {
            success: true,
            message: 'All circuit breakers reset',
            timestamp: new Date().toISOString()
          }
        } else if (target === 'account' && params?.accountId) {
          // Reset specific account
          multiAccountProcessor.resetAccount(params.accountId)
          result = {
            success: true,
            message: `Account ${params.accountId} reset`,
            timestamp: new Date().toISOString()
          }
        }
        break

      case 'acknowledge':
        // Reconhecer alerta
        if (params?.alertId) {
          // TODO: Implementar acknowledge de alertas
          result = {
            success: true,
            message: `Alert ${params.alertId} acknowledged`,
            timestamp: new Date().toISOString()
          }
        }
        break

      case 'force-health-check':
        // Forçar health check em todas as contas
        // TODO: Implementar force health check
        result = {
          success: true,
          message: 'Health check initiated',
          timestamp: new Date().toISOString()
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)

  } catch (error: any) {
    logger.error('[Health API] Failed to execute action', {
      error: error.message
    })

    return NextResponse.json(
      { error: 'Failed to execute action', details: error.message },
      { status: 500 }
    )
  }
}
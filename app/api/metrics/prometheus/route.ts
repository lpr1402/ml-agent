/**
 * API Route - Prometheus Metrics Endpoint
 * Expõe métricas em formato Prometheus para monitoramento
 * Production-ready
 */

import { NextRequest, NextResponse } from 'next/server'
import { register } from '@/lib/monitoring/prometheus-metrics'
import { logger } from '@/lib/logger'

/**
 * GET /api/metrics/prometheus
 * Retorna métricas no formato texto do Prometheus
 */
export async function GET(_request: NextRequest) {
  try {
    // Obter métricas em formato Prometheus
    const metrics = await register.metrics()

    // Retornar com content-type correto para Prometheus
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error: any) {
    logger.error('[Metrics API] Failed to get Prometheus metrics', {
      error: error.message
    })

    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/metrics/prometheus?format=json
 * Retorna métricas em formato JSON (para debug/dashboard)
 */
export async function POST(_request: NextRequest) {
  try {
    // Obter métricas em formato JSON
    const metrics = await register.getMetricsJSON()

    return NextResponse.json({
      metrics,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    logger.error('[Metrics API] Failed to get JSON metrics', {
      error: error.message
    })

    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    )
  }
}
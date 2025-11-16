/**
 * API: Métricas Detalhadas
 * GET /api/admin/metrics
 * Retorna métricas com gráficos temporais
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
    const period = searchParams.get('period') || '30d'

    // Calcular data inicial
    const now = new Date()
    const startDate = new Date()
    let groupBy: 'day' | 'week' | 'month' = 'day'

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        groupBy = 'day'
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        groupBy = 'day'
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        groupBy = 'week'
        break
    }

    // Questions over time
    const questions = await prisma.question.findMany({
      where: {
        receivedAt: { gte: startDate }
      },
      select: {
        receivedAt: true,
        status: true
      },
      orderBy: { receivedAt: 'asc' }
    })

    // Organizations over time
    const organizations = await prisma.organization.findMany({
      where: {
        createdAt: { gte: startDate },
        role: 'CLIENT'
      },
      select: {
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Agrupar por data
    const questionsOverTime = groupByDate(questions.map(q => q.receivedAt), groupBy)
    const organizationsOverTime = groupByDate(organizations.map(o => o.createdAt), groupBy)

    // Performance metrics
    const totalQuestions = await prisma.question.count()
    const activeOrganizations = await prisma.organization.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        role: 'CLIENT'
      }
    })

    const successfulQuestions = await prisma.question.count({
      where: {
        status: { in: ['RESPONDED', 'COMPLETED', 'SENT_TO_ML'] }
      }
    })

    const successRate = totalQuestions > 0 ? (successfulQuestions / totalQuestions) * 100 : 100

    // Tempo médio de processamento
    const recentWithTime = await prisma.question.findMany({
      where: {
        sentToAIAt: { not: null },
        aiProcessedAt: { not: null }
      },
      select: {
        sentToAIAt: true,
        aiProcessedAt: true
      },
      orderBy: { aiProcessedAt: 'desc' },
      take: 100
    })

    let avgProcessingTime = 0
    if (recentWithTime.length > 0) {
      const totalTime = recentWithTime.reduce((sum, q) => {
        if (q.sentToAIAt && q.aiProcessedAt) {
          return sum + (q.aiProcessedAt.getTime() - q.sentToAIAt.getTime())
        }
        return sum
      }, 0)
      avgProcessingTime = (totalTime / recentWithTime.length) / 1000 // segundos
    }

    return NextResponse.json({
      success: true,
      data: {
        questionsOverTime,
        organizationsOverTime,
        performanceMetrics: {
          avgResponseTime: 0,
          avgProcessingTime,
          successRate,
          totalQuestions,
          activeOrganizations
        }
      }
    })

  } catch (error: any) {
    console.error('[Admin API] Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

function groupByDate(dates: Date[], groupBy: 'day' | 'week' | 'month') {
  const groups = new Map<string, number>()

  dates.forEach(date => {
    let key: string
    const d = new Date(date)

    if (groupBy === 'day') {
      key = d.toISOString().split('T')[0]!
    } else if (groupBy === 'week') {
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      key = weekStart.toISOString().split('T')[0]!
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    groups.set(key, (groups.get(key) || 0) + 1)
  })

  return Array.from(groups.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

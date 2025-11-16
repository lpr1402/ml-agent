/**
 * ROI QUERIES - ENTERPRISE GRADE
 * Métricas REAIS de TODAS as contas ML da organização
 * Dados de TODOS OS TEMPOS (não apenas período limitado)
 * Cálculos baseados em Orders REAIS do Mercado Livre
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface DateRange {
  from: Date
  to: Date
}

interface ConversionMetrics {
  // Vendas REAIS
  totalSales: number
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number

  // Conversão REAL
  totalQuestions: number
  questionsAnswered: number
  conversionRate: number // % de perguntas que viraram venda
  avgRevenuePerQuestion: number

  // Performance Operacional
  avgTimeToConversion: number // Minutos entre pergunta e venda
  avgResponseTime: number // Tempo médio de resposta

  // ROI REAL
  platformCost: number // Custo da plataforma (baseado no plano)
  timeSaved: number // Horas economizadas
  timeSavedValue: number // Valor monetário do tempo economizado
  netProfit: number // Lucro líquido
  roiPercentage: number // ROI %

  // Multi-conta
  accountsCount: number
  accountsData: Array<{
    accountId: string
    nickname: string
    siteId: string
    totalOrders: number
    totalRevenue: number
    questionsAnswered: number
    conversionRate: number
  }>
}

/**
 * Calcular métricas de conversão REAIS de TODOS OS TEMPOS
 */
export async function getConversionMetricsAllTime(
  organizationId: string,
  dateRange?: DateRange
): Promise<ConversionMetrics> {
  try {
    logger.info('[ROI] Calculating ALL TIME metrics', { organizationId })

    // Build date filter (se fornecido)
    const dateFilter = dateRange ? {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to
      }
    } : {} // SEM filtro = TODOS OS TEMPOS

    // 1. Buscar TODAS as contas ML da organização
    const mlAccounts = await prisma.mLAccount.findMany({
      where: {
        organizationId,
        isActive: true
      },
      select: {
        id: true,
        nickname: true,
        siteId: true,
        mlUserId: true
      }
    })

    logger.info('[ROI] Found ML accounts', { count: mlAccounts.length })

    // 2. Buscar TODAS as perguntas (de todas as contas)
    const allQuestions = await prisma.question.findMany({
      where: {
        mlAccount: {
          organizationId
        },
        ...dateFilter
      },
      select: {
        id: true,
        mlAccountId: true,
        status: true,
        answer: true,
        answeredAt: true,
        createdAt: true
      }
    })

    const totalQuestions = allQuestions.length
    const questionsAnswered = allQuestions.filter(q =>
      q.status === 'ANSWERED' || q.status === 'AUTO_APPROVED' || q.answeredAt
    ).length

    logger.info('[ROI] Questions stats', {
      totalQuestions,
      questionsAnswered,
      answerRate: totalQuestions > 0 ? ((questionsAnswered / totalQuestions) * 100).toFixed(1) + '%' : '0%'
    })

    // 3. Buscar TODAS as Orders (vendas reais de todas as contas)
    const allOrders = await prisma.order.findMany({
      where: {
        mlAccount: {
          organizationId
        },
        status: { in: ['paid', 'confirmed'] }, // Apenas orders pagas/confirmadas
        ...dateFilter
      },
      select: {
        id: true,
        mlOrderId: true,
        mlAccountId: true,
        totalAmount: true,
        paidAmount: true,
        currencyId: true,
        status: true,
        orderItems: true,
        createdAt: true,
        dateCreated: true
      }
    })

    const totalOrders = allOrders.length
    const totalRevenue = allOrders.reduce((sum, order) => sum + (order.paidAmount || order.totalAmount), 0)
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    logger.info('[ROI] Orders stats', {
      totalOrders,
      totalRevenue: `R$ ${totalRevenue.toFixed(2)}`,
      avgOrderValue: `R$ ${avgOrderValue.toFixed(2)}`
    })

    // 4. Calcular conversões REAIS (OrderConversion table)
    const conversions = await prisma.orderConversion.findMany({
      where: {
        question: {
          mlAccount: {
            organizationId
          }
        },
        ...dateFilter
      },
      include: {
        question: {
          select: {
            mlAccountId: true,
            createdAt: true
          }
        },
        order: {
          select: {
            paidAmount: true,
            totalAmount: true,
            createdAt: true
          }
        }
      }
    })

    const totalSales = conversions.length
    const conversionRate = questionsAnswered > 0
      ? (totalSales / questionsAnswered) * 100
      : 0

    const avgRevenuePerQuestion = questionsAnswered > 0
      ? totalRevenue / questionsAnswered
      : 0

    // 5. Calcular tempo médio de conversão
    const conversionTimes = conversions
      .filter(c => c.timeToConversion)
      .map(c => c.timeToConversion!)

    const avgTimeToConversion = conversionTimes.length > 0
      ? conversionTimes.reduce((sum, t) => sum + t, 0) / conversionTimes.length
      : 0

    // 6. Calcular tempo médio de resposta (de todas as perguntas respondidas)
    const answeredQuestions = await prisma.question.findMany({
      where: {
        mlAccount: {
          organizationId
        },
        status: { in: ['ANSWERED', 'AUTO_APPROVED'] },
        answeredAt: { not: null },
        ...dateFilter
      },
      select: {
        createdAt: true,
        answeredAt: true
      }
    })

    const responseTimes = answeredQuestions
      .filter(q => q.answeredAt)
      .map(q => {
        const responseTime = q.answeredAt!.getTime() - q.createdAt.getTime()
        return responseTime / 1000 // Segundos
      })

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0

    // 7. Calcular ROI REAL
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        createdAt: true,
        subscriptionStatus: true
      }
    })

    // Custo da plataforma (baseado no plano e tempo de uso)
    const daysActive = organization
      ? Math.floor((Date.now() - organization.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 30

    const monthlyCost = organization?.plan === 'PRO' ? 97 : 0 // R$ 97/mês para PRO
    const platformCost = organization?.plan === 'PRO'
      ? (monthlyCost / 30) * (dateRange ? Math.min(daysActive, 30) : daysActive)
      : 0

    // Tempo economizado (assumindo 5min/pergunta se fosse manual)
    const timeSaved = (questionsAnswered * 5) / 60 // Horas
    const timeSavedValue = timeSaved * 50 // R$ 50/hora valor do tempo do vendedor

    // Net Profit = Receita gerada - Custo da plataforma
    const netProfit = timeSavedValue - platformCost

    // ROI % = (Net Profit / Custo) * 100
    const roiPercentage = platformCost > 0 ? (netProfit / platformCost) * 100 : 0

    // 8. Calcular stats por conta
    const accountsData = await Promise.all(
      mlAccounts.map(async (account) => {
        const accountOrders = allOrders.filter(o => o.mlAccountId === account.id)
        const accountQuestions = allQuestions.filter(q => q.mlAccountId === account.id)
        const accountAnswered = accountQuestions.filter(q =>
          q.status === 'ANSWERED' || q.status === 'AUTO_APPROVED' || q.answeredAt
        ).length
        const accountConversions = conversions.filter(c => c.question.mlAccountId === account.id)
        const accountRevenue = accountOrders.reduce((sum, o) => sum + (o.paidAmount || o.totalAmount), 0)

        return {
          accountId: account.id,
          nickname: account.nickname,
          siteId: account.siteId,
          totalOrders: accountOrders.length,
          totalRevenue: accountRevenue,
          questionsAnswered: accountAnswered,
          conversionRate: accountAnswered > 0
            ? (accountConversions.length / accountAnswered) * 100
            : 0
        }
      })
    )

    const metrics: ConversionMetrics = {
      totalSales,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      totalQuestions,
      questionsAnswered,
      conversionRate,
      avgRevenuePerQuestion,
      avgTimeToConversion,
      avgResponseTime,
      platformCost,
      timeSaved,
      timeSavedValue,
      netProfit,
      roiPercentage,
      accountsCount: mlAccounts.length,
      accountsData
    }

    logger.info('[ROI] ALL TIME metrics calculated', {
      totalOrders,
      totalRevenue: `R$ ${totalRevenue.toFixed(2)}`,
      conversionRate: `${conversionRate.toFixed(2)}%`,
      roi: `${roiPercentage.toFixed(1)}%`
    })

    return metrics

  } catch (error: any) {
    logger.error('[ROI] Failed to calculate metrics', {
      error: error.message,
      stack: error.stack
    })

    // Return empty metrics on error
    return {
      totalSales: 0,
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      totalQuestions: 0,
      questionsAnswered: 0,
      conversionRate: 0,
      avgRevenuePerQuestion: 0,
      avgTimeToConversion: 0,
      avgResponseTime: 0,
      platformCost: 0,
      timeSaved: 0,
      timeSavedValue: 0,
      netProfit: 0,
      roiPercentage: 0,
      accountsCount: 0,
      accountsData: []
    }
  }
}

/**
 * Buscar produtos que mais convertem
 */
export async function getTopConvertingProductsAllTime(
  organizationId: string,
  limit: number = 10,
  dateRange?: DateRange
): Promise<Array<{
  itemId: string
  itemTitle: string
  conversions: number
  totalRevenue: number
  avgConversionTime: number
}>> {
  try {
    const dateFilter = dateRange ? {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to
      }
    } : {}

    // Buscar conversões com items
    const conversions = await prisma.orderConversion.findMany({
      where: {
        question: {
          mlAccount: {
            organizationId
          }
        },
        ...dateFilter
      },
      include: {
        question: {
          select: {
            itemId: true,
            itemTitle: true
          }
        },
        order: {
          select: {
            paidAmount: true,
            totalAmount: true
          }
        }
      }
    })

    // Agrupar por item
    const itemsMap = new Map<string, {
      itemId: string
      itemTitle: string
      conversions: number
      totalRevenue: number
      conversionTimes: number[]
    }>()

    for (const conv of conversions) {
      const itemId = conv.question.itemId
      if (!itemsMap.has(itemId)) {
        itemsMap.set(itemId, {
          itemId,
          itemTitle: conv.question.itemTitle || 'Produto sem título',
          conversions: 0,
          totalRevenue: 0,
          conversionTimes: []
        })
      }

      const item = itemsMap.get(itemId)!
      item.conversions++
      item.totalRevenue += conv.order.paidAmount || conv.order.totalAmount
      if (conv.timeToConversion) {
        item.conversionTimes.push(conv.timeToConversion)
      }
    }

    // Transformar e ordenar
    const topProducts = Array.from(itemsMap.values())
      .map(item => ({
        itemId: item.itemId,
        itemTitle: item.itemTitle,
        conversions: item.conversions,
        totalRevenue: item.totalRevenue,
        avgConversionTime: item.conversionTimes.length > 0
          ? item.conversionTimes.reduce((sum, t) => sum + t, 0) / item.conversionTimes.length
          : 0
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, limit)

    return topProducts

  } catch (error: any) {
    logger.error('[ROI] Failed to get top products', { error: error.message })
    return []
  }
}

/**
 * Buscar conversões recentes
 */
export async function getRecentConversionsAllTime(
  organizationId: string,
  limit: number = 10
): Promise<Array<{
  id: string
  questionId: string
  orderId: string
  itemTitle: string
  conversionValue: number
  timeToConversion: number
  createdAt: Date
  accountNickname: string
}>> {
  try {
    const conversions = await prisma.orderConversion.findMany({
      where: {
        question: {
          mlAccount: {
            organizationId
          }
        }
      },
      include: {
        question: {
          select: {
            itemTitle: true,
            mlAccount: {
              select: {
                nickname: true
              }
            }
          }
        },
        order: {
          select: {
            mlOrderId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return conversions.map(c => ({
      id: c.id,
      questionId: c.questionId,
      orderId: c.order.mlOrderId || '',
      itemTitle: c.question.itemTitle || 'Produto',
      conversionValue: c.conversionValue,
      timeToConversion: c.timeToConversion || 0,
      createdAt: c.createdAt,
      accountNickname: c.question.mlAccount?.nickname || 'Conta'
    }))

  } catch (error: any) {
    logger.error('[ROI] Failed to get recent conversions', { error: error.message })
    return []
  }
}

/**
 * Calcular trend de conversões por período
 */
export async function getConversionTrendAllTime(
  organizationId: string,
  days: number = 30
): Promise<Array<{
  date: string
  conversions: number
  revenue: number
}>> {
  try {
    // Buscar conversões dos últimos N dias
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    const conversions = await prisma.orderConversion.findMany({
      where: {
        question: {
          mlAccount: {
            organizationId
          }
        },
        createdAt: {
          gte: dateFrom
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Agrupar por dia
    const dailyData = new Map<string, { conversions: number; revenue: number }>()

    for (const conv of conversions) {
      const dateKey: string = conv.createdAt.toISOString().split('T')[0] || ''
      if (!dateKey) continue

      const existing = dailyData.get(dateKey) || { conversions: 0, revenue: 0 }
      existing.conversions++
      existing.revenue += conv.conversionValue
      dailyData.set(dateKey, existing)
    }

    // Transformar em array
    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      conversions: data.conversions,
      revenue: data.revenue
    }))

  } catch (error: any) {
    logger.error('[ROI] Failed to get trend', { error: error.message })
    return []
  }
}

/**
 * Queries de ROI - Métricas de Conversão do ML Agent
 * 🎯 Calcula vendas geradas, taxa de conversão e valor médio
 *
 * Estas queries alimentam o dashboard de ROI
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export interface ConversionMetrics {
  totalSales: number          // Total de vendas atribuídas ao Agent
  totalRevenue: number        // Receita total gerada
  conversionRate: number      // Taxa de conversão (%)
  avgRevenuePerQuestion: number // Valor médio por pergunta respondida
  avgTimeToConversion: number // Tempo médio para conversão (minutos)
}

export interface TopConvertingProduct {
  itemId: string
  itemTitle: string
  itemPrice: number
  conversions: number
  totalRevenue: number
}

export interface ConversionTrend {
  date: string
  sales: number
  revenue: number
  questions: number
  conversionRate: number
}

/**
 * Busca métricas consolidadas de conversão
 */
export async function getConversionMetrics(
  organizationId: string,
  dateRange?: { from: Date; to: Date }
): Promise<ConversionMetrics> {
  try {
    // 1. Total de vendas geradas pelo Agent (orders com perguntas relacionadas)
    const salesData = await prisma.order.aggregate({
      where: {
        organizationId,
        status: 'paid',
        attributedToAgent: true,
        ...(dateRange && {
          dateClosed: {
            gte: dateRange.from,
            lte: dateRange.to
          }
        })
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    })

    const totalSales = salesData._count
    const totalRevenue = salesData._sum?.totalAmount || 0

    // 2. Total de perguntas respondidas no período
    const totalQuestions = await prisma.question.count({
      where: {
        mlAccount: { organizationId },
        status: { in: ['RESPONDED', 'COMPLETED', 'SENT_TO_ML'] },
        ...(dateRange && {
          answeredAt: {
            gte: dateRange.from,
            lte: dateRange.to
          }
        })
      }
    })

    // 3. Taxa de conversão (perguntas que viraram vendas)
    const convertedQuestions = await prisma.question.count({
      where: {
        mlAccount: { organizationId },
        hasConversion: true,
        ...(dateRange && {
          convertedAt: {
            gte: dateRange.from,
            lte: dateRange.to
          }
        })
      }
    })

    const conversionRate = totalQuestions > 0
      ? (convertedQuestions / totalQuestions) * 100
      : 0

    // 4. Valor médio por pergunta respondida
    const avgRevenuePerQuestion = totalQuestions > 0
      ? totalRevenue / totalQuestions
      : 0

    // 5. Tempo médio para conversão
    const conversions = await prisma.orderConversion.findMany({
      where: {
        order: {
          organizationId,
          ...(dateRange && {
            dateClosed: {
              gte: dateRange.from,
              lte: dateRange.to
            }
          })
        },
        timeToConversion: { not: null }
      },
      select: {
        timeToConversion: true
      }
    })

    const avgTimeToConversion = conversions.length > 0
      ? conversions.reduce((sum, c) => sum + (c.timeToConversion ?? 0), 0) / conversions.length
      : 0

    return {
      totalSales,
      totalRevenue,
      conversionRate,
      avgRevenuePerQuestion,
      avgTimeToConversion
    }

  } catch (error) {
    logger.error('[ROI Queries] Error fetching conversion metrics:', { error })
    throw error
  }
}

/**
 * Busca top produtos que mais converteram
 */
export async function getTopConvertingProducts(
  organizationId: string,
  limit: number = 10,
  dateRange?: { from: Date; to: Date }
): Promise<TopConvertingProduct[]> {
  try {
    // Buscar perguntas que converteram com seus produtos
    const questions = await prisma.question.findMany({
      where: {
        mlAccount: { organizationId },
        hasConversion: true,
        conversionValue: { gt: 0 },
        ...(dateRange && {
          convertedAt: {
            gte: dateRange.from,
            lte: dateRange.to
          }
        })
      },
      select: {
        itemId: true,
        itemTitle: true,
        itemPrice: true,
        conversionValue: true
      }
    })

    // Agrupar por itemId
    const grouped = questions.reduce((acc, q) => {
      if (!acc[q.itemId]) {
        acc[q.itemId] = {
          itemId: q.itemId,
          itemTitle: q.itemTitle || 'Produto',
          itemPrice: q.itemPrice || 0,
          conversions: 0,
          totalRevenue: 0
        }
      }
      const item = acc[q.itemId]
      if (item) {
        item.conversions += 1
        item.totalRevenue += q.conversionValue || 0
      }
      return acc
    }, {} as Record<string, TopConvertingProduct>)

    // Ordenar por receita total e limitar
    return Object.values(grouped)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)

  } catch (error) {
    logger.error('[ROI Queries] Error fetching top converting products:', { error })
    throw error
  }
}

/**
 * Busca tendência de conversões ao longo do tempo (últimos 30 dias)
 */
export async function getConversionTrend(
  organizationId: string,
  days: number = 30
): Promise<ConversionTrend[]> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Buscar vendas agrupadas por dia
    const salesByDay = await prisma.$queryRaw<Array<{
      date: Date
      sales: bigint
      revenue: number
    }>>`
      SELECT
        DATE("dateClosed") as date,
        COUNT(*)::bigint as sales,
        SUM("totalAmount")::float as revenue
      FROM "Order"
      WHERE "organizationId" = ${organizationId}
        AND "attributedToAgent" = true
        AND "dateClosed" >= ${startDate}
      GROUP BY DATE("dateClosed")
      ORDER BY date ASC
    `

    // Buscar perguntas respondidas por dia
    const questionsByDay = await prisma.$queryRaw<Array<{
      date: Date
      questions: bigint
    }>>`
      SELECT
        DATE("answeredAt") as date,
        COUNT(*)::bigint as questions
      FROM "Question"
      WHERE "mlAccountId" IN (
        SELECT id FROM "MLAccount" WHERE "organizationId" = ${organizationId}
      )
        AND "answeredAt" >= ${startDate}
        AND status IN ('RESPONDED', 'COMPLETED', 'SENT_TO_ML')
      GROUP BY DATE("answeredAt")
      ORDER BY date ASC
    `

    // Combinar dados
    const trend: ConversionTrend[] = []
    const questionsMap = new Map(
      questionsByDay.map(q => [q.date?.toISOString().split('T')[0] || '', Number(q.questions)])
    )

    salesByDay.forEach(s => {
      const dateKey = s.date?.toISOString().split('T')[0] || ''
      const questions = questionsMap.get(dateKey) || 0
      const sales = Number(s.sales)
      const revenue = s.revenue ?? 0

      trend.push({
        date: dateKey,
        sales,
        revenue,
        questions,
        conversionRate: questions > 0 ? (sales / questions) * 100 : 0
      })
    })

    return trend

  } catch (error) {
    logger.error('[ROI Queries] Error fetching conversion trend:', { error })
    throw error
  }
}

/**
 * Busca detalhes de conversões recentes
 */
export async function getRecentConversions(
  organizationId: string,
  limit: number = 10
) {
  try {
    const conversions = await prisma.orderConversion.findMany({
      where: {
        order: {
          organizationId,
          attributedToAgent: true
        }
      },
      include: {
        order: {
          select: {
            mlOrderId: true,
            totalAmount: true,
            currencyId: true,
            dateClosed: true,
            orderItems: true
          }
        },
        question: {
          select: {
            mlQuestionId: true,
            text: true,
            itemTitle: true,
            answeredAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return conversions

  } catch (error) {
    logger.error('[ROI Queries] Error fetching recent conversions:', { error })
    throw error
  }
}

/**
 * Estatísticas por conta ML (multi-account)
 */
export async function getConversionStatsByAccount(organizationId: string) {
  try {
    const accounts = await prisma.mLAccount.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        mlUserId: true,
        nickname: true,
        siteId: true
      }
    })

    const stats = await Promise.all(
      accounts.map(async (account) => {
        const [sales, questions] = await Promise.all([
          prisma.order.count({
            where: {
              mlAccountId: account.id,
              attributedToAgent: true,
              status: 'paid'
            }
          }),
          prisma.question.count({
            where: {
              mlAccountId: account.id,
              status: { in: ['RESPONDED', 'COMPLETED', 'SENT_TO_ML'] }
            }
          })
        ])

        const revenue = await prisma.order.aggregate({
          where: {
            mlAccountId: account.id,
            attributedToAgent: true,
            status: 'paid'
          },
          _sum: { totalAmount: true }
        })

        return {
          accountId: account.id,
          nickname: account.nickname,
          siteId: account.siteId,
          sales,
          questions,
          revenue: revenue._sum.totalAmount || 0,
          conversionRate: questions > 0 ? (sales / questions) * 100 : 0
        }
      })
    )

    return stats

  } catch (error) {
    logger.error('[ROI Queries] Error fetching stats by account:', { error })
    throw error
  }
}

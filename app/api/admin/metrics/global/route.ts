/**
 * API: Métricas Globais do Sistema
 * GET /api/admin/metrics/global
 * Retorna métricas agregadas de todas organizações
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateAdminAccess, logAdminAction } from '@/lib/admin/admin-auth'

export async function GET() {
  try {
    // Validar acesso admin
    const { isValid, error } = await validateAdminAccess()

    if (!isValid) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Calcular métricas em paralelo
    const [
      totalOrganizations,
      activeOrganizations,
      totalMLAccounts,
      activeMLAccounts,
      totalQuestions,
      questionsToday,
      questionsPending,
      questionsFailed,
      criticalAlerts,
      warningAlerts
    ] = await Promise.all([
      // Organizações
      prisma.organization.count(),
      prisma.organization.count({
        where: {
          subscriptionStatus: 'ACTIVE',
          role: 'CLIENT' // Não contar admin
        }
      }),

      // Contas ML
      prisma.mLAccount.count(),
      prisma.mLAccount.count({
        where: { isActive: true }
      }),

      // Perguntas total
      prisma.question.count(),

      // Perguntas hoje
      prisma.question.count({
        where: {
          receivedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Perguntas pendentes
      prisma.question.count({
        where: {
          status: {
            in: ['RECEIVED', 'PROCESSING', 'AWAITING_APPROVAL']
          }
        }
      }),

      // Perguntas falhadas (últimas 24h)
      prisma.question.count({
        where: {
          status: 'FAILED',
          receivedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Alertas críticos ativos
      prisma.alert.count({
        where: {
          status: 'ACTIVE',
          type: 'CRITICAL'
        }
      }),

      // Alertas warning ativos
      prisma.alert.count({
        where: {
          status: 'ACTIVE',
          type: 'WARNING'
        }
      })
    ])

    // Taxa de sucesso (últimas 24h)
    const questionsLast24h = await prisma.question.count({
      where: {
        receivedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })

    const successfulLast24h = await prisma.question.count({
      where: {
        receivedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        status: {
          in: ['SENT_TO_ML', 'COMPLETED']
        }
      }
    })

    const successRate = questionsLast24h > 0
      ? ((successfulLast24h / questionsLast24h) * 100).toFixed(1)
      : '100.0'

    // Tempo médio de processamento (últimas 100 perguntas)
    const recentQuestions = await prisma.question.findMany({
      where: {
        status: {
          in: ['SENT_TO_ML', 'COMPLETED']
        },
        sentToAIAt: { not: null },
        answeredAt: { not: null }
      },
      select: {
        sentToAIAt: true,
        answeredAt: true
      },
      orderBy: { answeredAt: 'desc' },
      take: 100
    })

    let avgProcessingTime = 0
    if (recentQuestions.length > 0) {
      const totalTime = recentQuestions.reduce((sum, q) => {
        if (q.sentToAIAt && q.answeredAt) {
          return sum + (q.answeredAt.getTime() - q.sentToAIAt.getTime())
        }
        return sum
      }, 0)
      avgProcessingTime = Math.round((totalTime / recentQuestions.length) / 1000) // em segundos
    }

    // Contar organizações com problemas
    const orgsWithIssues = await prisma.organization.count({
      where: {
        role: 'CLIENT',
        OR: [
          // Sem contas ativas
          {
            mlAccounts: {
              none: { isActive: true }
            }
          },
          // Tem alertas críticos
          {
            alerts: {
              some: {
                status: 'ACTIVE',
                type: 'CRITICAL'
              }
            }
          }
        ]
      }
    })

    // Log da ação
    await logAdminAction(
      'view_global_metrics',
      'system',
      'global_metrics',
      { timestamp: new Date() }
    )

    return NextResponse.json({
      success: true,
      data: {
        organizations: {
          total: totalOrganizations - 1, // -1 para não contar AXNEX
          active: activeOrganizations,
          withIssues: orgsWithIssues
        },
        mlAccounts: {
          total: totalMLAccounts,
          active: activeMLAccounts,
          inactive: totalMLAccounts - activeMLAccounts
        },
        questions: {
          total: totalQuestions,
          today: questionsToday,
          pending: questionsPending,
          failed: questionsFailed,
          last24h: questionsLast24h,
          successRate: parseFloat(successRate),
          avgProcessingTime // segundos
        },
        alerts: {
          critical: criticalAlerts,
          warning: warningAlerts,
          total: criticalAlerts + warningAlerts
        },
        performance: {
          avgProcessingTime,
          successRate: parseFloat(successRate)
        }
      }
    })

  } catch (error: any) {
    console.error('[Admin API] Error fetching global metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

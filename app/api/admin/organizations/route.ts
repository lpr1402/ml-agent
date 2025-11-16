/**
 * API: Lista de Organizações
 * GET /api/admin/organizations
 * Retorna todas organizações com estatísticas
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateAdminAccess } from '@/lib/admin/admin-auth'

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

    // Buscar organizações (exceto AXNEX)
    const organizations = await prisma.organization.findMany({
      where: {
        role: 'CLIENT'
      },
      include: {
        mlAccounts: {
          where: { isActive: true },
          select: {
            id: true,
            nickname: true,
            mlUserId: true,
            siteId: true,
            thumbnail: true,
            isActive: true,
            tokenExpiresAt: true,
            connectionError: true,
            lastSyncAt: true
          }
        },
        _count: {
          select: {
            mlAccounts: true,
            alerts: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calcular métricas para cada organização
    const orgsWithMetrics = await Promise.all(
      organizations.map(async (org) => {
        // Perguntas hoje
        const questionsToday = await prisma.question.count({
          where: {
            mlAccount: {
              organizationId: org.id
            },
            receivedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        })

        // Perguntas pendentes
        const questionsPending = await prisma.question.count({
          where: {
            mlAccount: {
              organizationId: org.id
            },
            status: {
              in: ['RECEIVED', 'PROCESSING', 'AWAITING_APPROVAL']
            }
          }
        })

        // Perguntas falhadas (últimas 24h)
        const questionsFailed = await prisma.question.count({
          where: {
            mlAccount: {
              organizationId: org.id
            },
            status: 'FAILED',
            receivedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })

        // Alertas ativos
        const alerts = await prisma.alert.findMany({
          where: {
            organizationId: org.id,
            status: 'ACTIVE'
          },
          select: {
            type: true
          }
        })

        const criticalAlerts = alerts.filter(a => a.type === 'CRITICAL').length
        const warningAlerts = alerts.filter(a => a.type === 'WARNING').length

        // Contar total de perguntas da org
        const questionsTotal = await prisma.question.count({
          where: {
            mlAccount: {
              organizationId: org.id
            }
          }
        })

        // Determinar status de saúde
        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy'

        if (criticalAlerts > 0 || org.mlAccounts.length === 0) {
          healthStatus = 'critical'
        } else if (warningAlerts > 0 || questionsFailed > 5) {
          healthStatus = 'warning'
        }

        // Verificar tokens expirando
        const tokensExpiringSoon = org.mlAccounts.filter((acc: any) => {
          const hoursUntilExpiry = (acc.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
          return hoursUntilExpiry < 24 && hoursUntilExpiry > 0
        }).length

        if (tokensExpiringSoon > 0) {
          healthStatus = healthStatus === 'healthy' ? 'warning' : healthStatus
        }

        return {
          id: org.id,
          username: org.username,
          organizationName: org.organizationName,
          plan: org.plan,
          subscriptionStatus: org.subscriptionStatus,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,

          // Contas ML
          mlAccounts: org.mlAccounts,
          totalMLAccounts: org._count.mlAccounts,
          activeMLAccounts: org.mlAccounts.length,

          // Métricas de perguntas
          questionsTotal,
          questionsToday,
          questionsPending,
          questionsFailed,

          // Alertas
          criticalAlerts,
          warningAlerts,
          totalAlerts: org._count.alerts,

          // Health status
          healthStatus,
          healthIssues: [
            ...(org.mlAccounts.length === 0 ? ['Nenhuma conta ML conectada'] : []),
            ...(criticalAlerts > 0 ? [`${criticalAlerts} alertas críticos`] : []),
            ...(tokensExpiringSoon > 0 ? [`${tokensExpiringSoon} tokens expirando em breve`] : []),
            ...(questionsFailed > 5 ? [`${questionsFailed} perguntas falhadas hoje`] : [])
          ]
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: orgsWithMetrics,
      total: orgsWithMetrics.length
    })

  } catch (error: any) {
    console.error('[Admin API] Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}

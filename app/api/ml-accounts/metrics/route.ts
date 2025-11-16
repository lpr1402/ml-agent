import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { decryptToken } from "@/lib/security/encryption"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { redis } from "@/lib/redis"

// 🚀 ENTERPRISE: Cache de 5 minutos para evitar chamadas excessivas ao ML
const CACHE_TTL = 300 // 5 minutos

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from session
    const auth = await getAuthenticatedAccount()

    if (!auth?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = auth.organizationId

    // 🚀 CRITICAL: Verificar cache primeiro
    const cacheKey = `ml-accounts-metrics:${organizationId}`
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        logger.info('[ML Accounts Metrics] Cache hit', { organizationId })
        return NextResponse.json(JSON.parse(cached))
      }
    } catch (error) {
      logger.warn('[ML Accounts Metrics] Cache read failed, continuing without cache', { error })
    }

    // Get period filter from query params
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '7days'

    // Calculate date range based on period
    let dateFilter: Date | undefined
    const now = new Date()

    switch(period) {
      case 'today':
        dateFilter = new Date(now.setHours(0, 0, 0, 0))
        break
      case '7days':
        dateFilter = new Date(now.setDate(now.getDate() - 7))
        break
      case '30days':
        dateFilter = new Date(now.setDate(now.getDate() - 30))
        break
      default:
        dateFilter = new Date(now.setDate(now.getDate() - 7))
    }

    // Fetch all ML accounts for the organization
    const mlAccounts = await prisma.mLAccount.findMany({
      where: {
        organizationId: organizationId
      },
      select: {
        id: true,
        mlUserId: true,
        nickname: true,
        thumbnail: true,
        isActive: true,
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true,
        updatedAt: true
      }
    })

    // Fetch questions separately for each account with period filter
    const accountsWithQuestions = await Promise.all(
      mlAccounts.map(async (account) => {
        const questions = await prisma.question.findMany({
          where: {
            mlAccountId: account.id,
            receivedAt: {
              gte: dateFilter
            }
          },
          select: {
            id: true,
            status: true,
            receivedAt: true,
            sentToMLAt: true,
            approvalType: true,
            itemPrice: true
          }
        })
        return { ...account, questions }
      })
    )

    // Process each account to calculate metrics
    const accountsWithMetrics = await Promise.all(
      accountsWithQuestions.map(async (account) => {
        try {
          // Calculate question metrics
          const totalQuestions = account.questions.length
          const answeredQuestions = account.questions.filter(
            (q: any) => q.status === "COMPLETED" || q.status === "APPROVED"
          ).length
          const pendingQuestions = account.questions.filter(
            (q: any) => ["PENDING", "AWAITING_APPROVAL", "PROCESSING", "REVISING"].includes(q.status)
          ).length

          // Calculate total revenue (sum of item prices for completed questions)
          const totalRevenue = account.questions
            .filter((q: any) => q.status === "COMPLETED" || q.status === "APPROVED")
            .reduce((sum: number, q: any) => sum + (q.itemPrice || 0), 0)

          // Calculate ML fees (average 13% commission on sales)
          const mlFees = totalRevenue * 0.13

          // Estimate shipping costs (average R$15 per sale)
          const shippingCosts = answeredQuestions * 15

          // Calculate real profit after fees and costs
          const realProfit = totalRevenue - mlFees - shippingCosts

          // Calculate average response time
          const questionsWithTime = account.questions.filter(
            (q: any) => q.sentToMLAt && q.receivedAt
          )
          const avgResponseTime = questionsWithTime.length > 0
            ? questionsWithTime.reduce((sum: number, q: any) => {
                const time = (new Date(q.sentToMLAt!).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
                return sum + time
              }, 0) / questionsWithTime.length
            : 0

          // Calculate conversion rate (simplified - questions that led to sales)
          const conversionRate = answeredQuestions > 0 ? answeredQuestions / totalQuestions : 0

          // Try to fetch real-time metrics from ML API
          let activeListings = 0
          let totalSales = 0
          let reputation = 0

          if (account.accessToken) {
            try {
              const token = decryptToken({
                encrypted: account.accessToken,
                iv: account.accessTokenIV!,
                authTag: account.accessTokenTag!
              })

              // Fetch user metrics (usa cache de 3 horas)
              const userResponse = await fetch(`https://api.mercadolibre.com/users/${account.mlUserId}`, {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              })

              if (userResponse.ok) {
                const userData = await userResponse.json()
                reputation = userData.seller_reputation?.level_id ?
                  ["5_green", "4_light_green", "3_yellow", "2_orange", "1_red"].indexOf(userData.seller_reputation.level_id) + 1 : 0
                totalSales = userData.seller_reputation?.transactions?.completed || 0
              }

              // REMOVIDO: Fetch active listings - não necessário para dashboard
              // Economia de 1 chamada API por conta
              activeListings = 0 // Será atualizado via job periódico se necessário
            } catch (error) {
              logger.warn("Failed to fetch ML metrics for account", {
                accountId: account.id,
                error: error instanceof Error ? error.message : String(error)
              })
            }
          }

          return {
            id: account.id,
            nickname: account.nickname,
            mlUserId: account.mlUserId,
            thumbnail: account.thumbnail,
            isActive: account.isActive,
            totalQuestions,
            answeredQuestions,
            pendingQuestions,
            totalRevenue,
            avgResponseTime,
            conversionRate,
            reputation,
            activeListings,
            totalSales,
            lastSync: account.updatedAt,
            realProfit: Math.max(0, realProfit),
            mlFees,
            shippingCosts
          }
        } catch (error) {
          logger.error("Error processing account metrics", {
            accountId: account.id,
            error: error instanceof Error ? error.message : String(error)
          })

          // Return basic metrics if processing fails
          return {
            id: account.id,
            nickname: account.nickname,
            mlUserId: account.mlUserId,
            thumbnail: account.thumbnail,
            isActive: account.isActive,
            totalQuestions: account.questions.length,
            answeredQuestions: 0,
            pendingQuestions: 0,
            totalRevenue: 0,
            avgResponseTime: 0,
            conversionRate: 0,
            reputation: 0,
            activeListings: 0,
            totalSales: 0,
            lastSync: account.updatedAt,
            realProfit: 0,
            mlFees: 0,
            shippingCosts: 0
          }
        }
      })
    )

    // Sort by total questions by default
    accountsWithMetrics.sort((a, b) => b.totalQuestions - a.totalQuestions)

    const responseData = {
      accounts: accountsWithMetrics,
      totalAccounts: accountsWithMetrics.length,
      organizationId: organizationId
    }

    // 🚀 CRITICAL: Salvar no cache para próximas requisições (5min)
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(responseData))
      logger.info('[ML Accounts Metrics] Cache saved', { organizationId, ttl: CACHE_TTL })
    } catch (error) {
      logger.warn('[ML Accounts Metrics] Cache write failed, continuing without cache', { error })
    }

    return NextResponse.json(responseData)

  } catch (error) {
    logger.error("Error fetching ML accounts metrics", {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { error: "Failed to fetch accounts metrics" },
      { status: 500 }
    )
  }
}
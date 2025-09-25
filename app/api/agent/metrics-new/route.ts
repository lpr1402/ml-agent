import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { cache } from "@/lib/redis"

export async function GET(_request: Request) {
  try {
    // Get authenticated user from session
    const auth = await getAuthenticatedAccount()

    if (!auth) {
      logger.warn("[Metrics API] No auth returned from getAuthenticatedAccount")
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 })
    }

    logger.info("[Metrics API] Auth result:", {
      hasAuth: !!auth,
      nickname: auth?.mlAccount?.nickname,
      hasToken: !!auth?.accessToken
    })

    const organizationId = auth.organizationId

    // Get organization plan
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true }
    })

    // Try to get from cache (but don't fail if Redis is down)
    try {
      const cacheKey = `org:${organizationId}:metrics:simple`
      const cachedMetrics = await cache.get(cacheKey, organizationId)
      if (cachedMetrics) {
        logger.info("[Metrics API] Returning cached metrics")
        return NextResponse.json({
          ...cachedMetrics,
          organizationPlan: organization?.plan || 'FREE'
        })
      }
    } catch (cacheError) {
      logger.warn("[Metrics API] Cache error, continuing without cache:", { message: cacheError instanceof Error ? cacheError.message : 'Unknown error' })
    }
    
    // Buscar todas as contas ML ativas da organização
    const mlAccounts = await prisma.mLAccount.findMany({
      where: {
        organizationId: organizationId,
        isActive: true
      },
      select: {
        id: true,
        mlUserId: true
      }
    })

    if (mlAccounts.length === 0) {
      return NextResponse.json({
        totalQuestions: 0,
        answeredQuestions: 0,
        pendingQuestions: 0,
        avgResponseTime: 0,
        avgProcessingTime: 0
      })
    }

    const accountIds = mlAccounts.map(acc => acc.id)

    // Use aggregation queries for all accounts in the organization
    const [
      pendingCount,
      answeredCount,
      totalCount,
      responseTimeStats,
      processingTimeStats
    ] = await Promise.all([
      // Count pending questions (single query)
      prisma.question.count({
        where: {
          mlAccountId: { in: accountIds },
          status: {
            in: ["AWAITING_APPROVAL", "REVISING", "FAILED", "TOKEN_ERROR", "PROCESSING"]
          }
        }
      }),

      // Count answered questions (single query)
      prisma.question.count({
        where: {
          mlAccountId: { in: accountIds },
          status: {
            in: ["APPROVED", "COMPLETED"]
          }
        }
      }),

      // Count total questions (single query)
      prisma.question.count({
        where: { mlAccountId: { in: accountIds } }
      }),

      // Calculate average response time for ML Agent (from receivedAt to answeredAt)
      prisma.$queryRaw<Array<{ avg: number }>>(
        Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM ("answeredAt" - "receivedAt"))) as avg
          FROM "Question"
          WHERE "mlAccountId" = ANY(${accountIds})
          AND "answeredAt" IS NOT NULL
          AND "receivedAt" IS NOT NULL
          AND "status" IN ('APPROVED', 'COMPLETED')
        `
      ),

      // Calculate average AI processing time (from receivedAt to aiProcessedAt)
      prisma.$queryRaw<Array<{ avg: number }>>(
        Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM (COALESCE("aiProcessedAt", "processedAt") - "receivedAt"))) as avg
          FROM "Question"
          WHERE "mlAccountId" = ANY(${accountIds})
          AND (("aiProcessedAt" IS NOT NULL) OR ("processedAt" IS NOT NULL))
          AND "receivedAt" IS NOT NULL
          AND "status" IN ('APPROVED', 'COMPLETED', 'AWAITING_APPROVAL')
        `
      )
    ])

    const avgResponseTime = responseTimeStats[0]?.avg || 0
    const avgProcessingTime = processingTimeStats[0]?.avg || 0
    
    const response = {
      totalQuestions: totalCount,
      answeredQuestions: answeredCount,
      pendingQuestions: pendingCount,
      avgResponseTime: avgResponseTime,
      avgProcessingTime: avgProcessingTime,
      organizationId: organizationId,
      organizationPlan: organization?.plan || 'FREE',
      accountCount: mlAccounts.length
    }
    
    // Try to cache the result (but don't fail if Redis is down)
    try {
      const cacheKey = `org:${organizationId}:metrics:simple`
      await cache.set(cacheKey, response, 30, organizationId)
    } catch (cacheError) {
      logger.warn("[Metrics API] Failed to cache metrics:", { message: cacheError instanceof Error ? cacheError.message : 'Unknown error' })
    }

    logger.info("[Metrics API] Successfully calculated metrics", {
      totalQuestions: totalCount,
      avgResponseTime: avgResponseTime,
      avgProcessingTime: avgProcessingTime
    })
    
    return NextResponse.json(response)
    
  } catch (error) {
    logger.error("Metrics error:", { message: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
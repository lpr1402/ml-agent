import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { logger } from "@/lib/logger"

interface QuestionWithAccount {
  id: string
  mlQuestionId: string
  text: string
  itemTitle: string | null
  itemPrice: number
  itemId: string
  itemPermalink?: string | null
  status: string
  aiSuggestion?: string | null
  finalResponse?: string | null
  receivedAt: string
  aiProcessedAt?: string | null
  approvedAt?: string | null
  approvalType?: string | null
  failedAt?: string | null
  sentToMLAt?: string | null
  mlResponseCode?: number | null
  mlResponseData?: any
  mlAccount: {
    id: string
    mlUserId: string
    nickname: string
    thumbnail?: string | null
    siteId: string
  }
}

export async function GET(request: NextRequest) {
  try {
    // Use session-based authentication
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filterAccountId = searchParams.get('accountId')
    const filterStatus = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '200')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    logger.info("[Multi Questions] Fetching questions", {
      organizationId: auth.organizationId,
      filterAccountId,
      filterStatus,
      limit,
      offset
    })
    
    // Build where clause
    const whereClause: any = {
      mlAccount: {
        organizationId: auth.organizationId,
        isActive: true
      }
    }
    
    // Apply account filter if specified
    if (filterAccountId && filterAccountId !== 'all') {
      whereClause.mlAccountId = filterAccountId
    }
    
    // Apply status filter if specified
    if (filterStatus && filterStatus !== 'all') {
      if (filterStatus === 'pending') {
        whereClause.status = {
          in: ["PROCESSING", "AWAITING_APPROVAL", "REVISING", "FAILED", "TOKEN_ERROR"]
        }
      } else if (filterStatus === 'completed') {
        whereClause.status = {
          in: ["APPROVED", "COMPLETED"]
        }
      } else {
        whereClause.status = filterStatus
      }
    }
    
    // Fetch questions with account information
    const questions = await prisma.question.findMany({
      where: whereClause,
      include: {
        mlAccount: {
          select: {
            id: true,
            mlUserId: true,
            nickname: true,
            thumbnail: true,
            siteId: true
          }
        }
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
      skip: offset
    })
    
    // Count total for pagination
    const totalCount = await prisma.question.count({
      where: whereClause
    })
    
    logger.info(`[Multi Questions] Found ${questions.length} questions (total: ${totalCount})`)
    
    // Map to frontend format with account info
    const mappedQuestions: QuestionWithAccount[] = questions.map(q => ({
      id: q.id,
      mlQuestionId: q.mlQuestionId,
      text: q.text,
      itemTitle: q.itemTitle,
      itemPrice: q.itemPrice || 0,
      itemId: q.itemId,
      itemPermalink: q.itemPermalink,
      status: q.status,
      aiSuggestion: q.aiSuggestion,
      finalResponse: q.answer,
      receivedAt: q.receivedAt.toISOString(),
      aiProcessedAt: q.aiProcessedAt?.toISOString() || q.processedAt?.toISOString() || null,
      approvedAt: q.approvedAt?.toISOString() || q.answeredAt?.toISOString() || null,
      approvalType: q.approvalType,
      failedAt: q.failedAt?.toISOString() || null,
      sentToMLAt: q.sentToMLAt?.toISOString() || null,
      mlResponseCode: q.mlResponseCode,
      mlResponseData: q.mlResponseData,
      mlAccount: {
        id: q.mlAccount.id,
        mlUserId: q.mlAccount.mlUserId,
        nickname: q.mlAccount.nickname,
        thumbnail: q.mlAccount.thumbnail,
        siteId: q.mlAccount.siteId
      }
    }))
    
    // Group by account for summary
    const accountSummary = questions.reduce((acc, q) => {
      const accountId = q.mlAccount.id
      if (!acc[accountId]) {
        acc[accountId] = {
          accountId: q.mlAccount.id,
          nickname: q.mlAccount.nickname,
          thumbnail: q.mlAccount.thumbnail,
          totalQuestions: 0,
          pendingQuestions: 0,
          completedQuestions: 0
        }
      }
      
      acc[accountId].totalQuestions++
      
      if (['PROCESSING', 'AWAITING_APPROVAL', 'REVISING', 'FAILED', 'TOKEN_ERROR'].includes(q.status)) {
        acc[accountId].pendingQuestions++
      } else if (['APPROVED', 'COMPLETED'].includes(q.status)) {
        acc[accountId].completedQuestions++
      }
      
      return acc
    }, {} as Record<string, {
      accountId: string
      nickname: string
      thumbnail: string | null
      totalQuestions: number
      pendingQuestions: number
      completedQuestions: number
    }>)
    
    return NextResponse.json({
      questions: mappedQuestions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      accountSummary: Object.values(accountSummary),
      filters: {
        accountId: filterAccountId,
        status: filterStatus
      }
    })
    
  } catch (error) {
    logger.error("Multi Questions fetch error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
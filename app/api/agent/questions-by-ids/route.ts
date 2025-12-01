import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { logger } from "@/lib/logger"
import { ensureHttps } from "@/lib/utils/ensure-https"

/**
 * GET - Buscar perguntas específicas por IDs
 * Usado para reconciliação de perguntas em estado transitório
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAccount()

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const idsParam = searchParams.get('ids')

    if (!idsParam) {
      return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 })
    }

    const ids = idsParam.split(',').filter(Boolean)

    logger.info("[Questions By IDs] Fetching questions", {
      organizationId: auth.organizationId,
      idsCount: ids.length
    })

    // Buscar perguntas
    const questions = await prisma.question.findMany({
      where: {
        id: {
          in: ids
        },
        mlAccount: {
          organizationId: auth.organizationId
        }
      },
      include: {
        mlAccount: {
          select: {
            id: true,
            mlUserId: true,
            nickname: true,
            thumbnail: true,
            siteId: true,
            organizationId: true
          }
        }
      }
    })

    // Map para formato do frontend
    const mappedQuestions = questions.map(q => ({
      id: q.id,
      mlQuestionId: q.mlQuestionId,
      text: q.text,
      itemTitle: q.itemTitle,
      itemPrice: q.itemPrice || 0,
      itemId: q.itemId,
      itemPermalink: q.itemPermalink,
      itemThumbnail: ensureHttps((q as any).itemThumbnail) || null,
      status: q.status,
      aiSuggestion: q.aiSuggestion,
      answer: q.answer,
      receivedAt: q.receivedAt.toISOString(),
      aiProcessedAt: q.aiProcessedAt?.toISOString() || null,
      approvedAt: q.approvedAt?.toISOString() || null,
      approvalType: q.approvalType,
      failedAt: q.failedAt?.toISOString() || null,
      sentToMLAt: q.sentToMLAt?.toISOString() || null,
      mlResponseCode: q.mlResponseCode,
      mlResponseData: q.mlResponseData,
      dateCreated: q.dateCreated.toISOString(),
      mlAccount: {
        id: q.mlAccount.id,
        mlUserId: q.mlAccount.mlUserId,
        nickname: q.mlAccount.nickname,
        thumbnail: ensureHttps(q.mlAccount.thumbnail) ?? null,
        siteId: q.mlAccount.siteId,
        organizationId: q.mlAccount.organizationId
      }
    }))

    return NextResponse.json({
      success: true,
      questions: mappedQuestions
    })

  } catch (error: any) {
    logger.error("[Questions By IDs] Error:", { error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

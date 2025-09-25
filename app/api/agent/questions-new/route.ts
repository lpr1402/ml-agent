import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { logger } from "@/lib/logger"

export async function GET(_request: Request) {
  try {
    // Use session-based authentication
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // const sellerId = auth.mlAccount.mlUserId // Reserved for future seller validation
    
    // Buscar todas as perguntas da conta ativa
    const questions = await prisma.question.findMany({
      where: { 
        mlAccountId: auth.mlAccount.id // Usar conta ML específica
      },
      orderBy: { receivedAt: "desc" }, // Usar receivedAt que agora existe
      take: 100 // Limit to last 100 questions
    })
    
    logger.info(`[Agent Questions] Found ${questions.length} questions for account ${auth.mlAccount.nickname}`, {
      count: questions.length,
      account: auth.mlAccount.nickname
    })
    
    // Mapear para formato esperado pelo frontend com campos CORRETOS
    const mappedQuestions = questions.map(q => ({
      id: q.id,
      mlQuestionId: q.mlQuestionId,
      text: q.text,
      itemTitle: q.itemTitle,
      itemPrice: q.itemPrice || 0,
      itemId: q.itemId,
      itemPermalink: q.itemPermalink,
      status: q.status,
      aiSuggestion: q.aiSuggestion, // Campo correto para resposta da IA
      finalResponse: q.answer,
      receivedAt: q.receivedAt, // Campo agora existe!
      aiProcessedAt: q.aiProcessedAt || q.processedAt, // Usar o campo correto
      approvedAt: q.approvedAt || q.answeredAt, // Usar approvedAt
      approvalType: q.approvalType, // Campo agora existe!
      failedAt: q.failedAt, // Campo agora existe!
      sentToMLAt: q.sentToMLAt, // Campo agora existe!
      mlResponseCode: q.mlResponseCode,
      mlResponseData: q.mlResponseData
    }))
    
    return NextResponse.json(mappedQuestions)
    
  } catch (error) {
    logger.error("Questions fetch error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
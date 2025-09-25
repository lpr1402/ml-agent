import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"

export async function GET(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Use the userId from authenticated account
    const userId = String(auth.mlAccount.mlUserId)
    
    // Buscar total de perguntas respondidas (status APPROVED, SENT_TO_ML ou COMPLETED)
    const answeredQuestions = await prisma.question.count({
      where: {
        sellerId: userId,
        status: {
          in: ['RESPONDED', 'APPROVED', 'SENT_TO_ML', 'COMPLETED']
        }
      }
    })
    
    // Buscar perguntas processadas hoje
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const questionsToday = await prisma.question.count({
      where: {
        sellerId: userId,
        status: {
          in: ['RESPONDED', 'APPROVED', 'SENT_TO_ML', 'COMPLETED']
        },
        dateCreated: {
          gte: today
        }
      }
    })
    
    // Buscar tempo médio de resposta das últimas 50 perguntas aprovadas
    const recentQuestions = await prisma.question.findMany({
      where: {
        sellerId: userId,
        status: {
          in: ['RESPONDED', 'APPROVED', 'SENT_TO_ML', 'COMPLETED']
        }
      },
      select: {
        dateCreated: true,
        answeredAt: true
      },
      orderBy: {
        answeredAt: 'desc'
      },
      take: 50
    })
    
    let totalResponseTime = 0
    let validCount = 0
    
    recentQuestions.forEach(q => {
      // Usar answeredAt para calcular tempo de resposta
      if (q.answeredAt && q.dateCreated) {
        const responseTime = (q.answeredAt.getTime() - q.dateCreated.getTime()) / 1000 / 60 // em minutos
        if (responseTime > 0 && responseTime < 1440) { // menos de 24 horas
          totalResponseTime += responseTime
          validCount++
        }
      }
    })
    
    const avgResponseMinutes = validCount > 0 ? Math.round(totalResponseTime / validCount) : 0
    
    // Buscar perguntas pendentes
    const pendingQuestions = await prisma.question.count({
      where: {
        sellerId: userId,
        status: {
          in: ['RECEIVED', 'PROCESSING', 'AWAITING_APPROVAL', 'REVISING']
        }
      }
    })
    
    return NextResponse.json({
      answeredByAgent: answeredQuestions,
      answeredToday: questionsToday,
      avgResponseTime: avgResponseMinutes > 60 
        ? `${Math.round(avgResponseMinutes / 60)}h ${avgResponseMinutes % 60}min`
        : avgResponseMinutes > 0
          ? `${avgResponseMinutes}min`
          : 'N/A',
      pendingQuestions: pendingQuestions
    })
    
  } catch (error) {
    logger.error('Error fetching agent stats:', { error })
    return NextResponse.json(
      { 
        error: 'Failed to fetch agent stats',
        answeredByAgent: 0,
        answeredToday: 0,
        avgResponseTime: 'N/A',
        pendingQuestions: 0
      },
      { status: 500 }
    )
  }
}
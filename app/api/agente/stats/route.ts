import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }
    
    // Get user ID from ML API
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })
    
    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch user" }, { status: 401 })
    }
    
    const userData = await userResponse.json()
    const userId = String(userData.id)
    
    // Buscar total de perguntas respondidas (status APPROVED, SENT_TO_ML ou COMPLETED)
    const answeredQuestions = await prisma.question.count({
      where: {
        mlUserId: userId,
        status: {
          in: ['APPROVED', 'SENT_TO_ML', 'COMPLETED']
        }
      }
    })
    
    // Buscar perguntas processadas hoje
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const questionsToday = await prisma.question.count({
      where: {
        mlUserId: userId,
        status: {
          in: ['APPROVED', 'SENT_TO_ML', 'COMPLETED']
        },
        approvedAt: {
          gte: today
        }
      }
    })
    
    // Buscar tempo médio de resposta das últimas 50 perguntas aprovadas
    const recentQuestions = await prisma.question.findMany({
      where: {
        mlUserId: userId,
        status: {
          in: ['APPROVED', 'SENT_TO_ML', 'COMPLETED']
        }
      },
      select: {
        receivedAt: true,
        approvedAt: true,
        aiProcessedAt: true
      },
      orderBy: {
        approvedAt: 'desc'
      },
      take: 50
    })
    
    let totalResponseTime = 0
    let validCount = 0
    
    recentQuestions.forEach(q => {
      // Usar aiProcessedAt se disponível, senão usar approvedAt
      const respondedAt = q.aiProcessedAt || q.approvedAt
      if (respondedAt && q.receivedAt) {
        const responseTime = (respondedAt.getTime() - q.receivedAt.getTime()) / 1000 / 60 // em minutos
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
        mlUserId: userId,
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
    console.error('Error fetching agent stats:', error)
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
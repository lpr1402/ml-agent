import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

export async function GET(request: NextRequest) {
  try {
    // Get user authentication from request headers (Bearer token)
    const auth = await getAuthFromRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Get user ID from ML API using the token
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })
    
    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to get user info" }, { status: 401 })
    }
    
    const userData = await userResponse.json()
    const sellerId = String(userData.id)
    
    // Get all questions to calculate real metrics
    const allQuestions = await prisma.question.findMany({
      where: { mlUserId: sellerId }
    })
    
    // Calculate real metrics from questions
    const pendingQuestions = allQuestions.filter(q => 
      q.status === "AWAITING_APPROVAL" || 
      q.status === "REVISING" || 
      q.status === "FAILED" || 
      q.status === "TOKEN_ERROR" ||
      q.status === "PROCESSING"
    ).length
    
    const answeredQuestions = allQuestions.filter(q => 
      q.status === "APPROVED" || q.status === "COMPLETED"
    ).length
    
    const totalQuestions = allQuestions.length
    
    // Get or create user metrics
    const metrics = await prisma.userMetrics.upsert({
      where: { mlUserId: sellerId },
      update: {
        totalQuestions,
        answeredQuestions,
        pendingQuestions
      },
      create: {
        mlUserId: sellerId,
        totalQuestions,
        answeredQuestions,
        pendingQuestions
      }
    })
    
    // Calculate additional metrics
    const recentQuestions = await prisma.question.findMany({
      where: {
        mlUserId: sellerId,
        approvedAt: { not: null }
      },
      select: {
        receivedAt: true,
        aiProcessedAt: true,
        approvedAt: true
      },
      take: 100
    })
    
    let totalResponseTime = 0
    let totalApprovalTime = 0
    let validResponseCount = 0
    let validApprovalCount = 0
    
    recentQuestions.forEach(q => {
      if (q.aiProcessedAt) {
        const responseTime = (q.aiProcessedAt.getTime() - q.receivedAt.getTime()) / 1000
        totalResponseTime += responseTime
        validResponseCount++
      }
      
      if (q.approvedAt && q.aiProcessedAt) {
        const approvalTime = (q.approvedAt.getTime() - q.aiProcessedAt.getTime()) / 1000
        totalApprovalTime += approvalTime
        validApprovalCount++
      }
    })
    
    const avgResponseTime = validResponseCount > 0 ? totalResponseTime / validResponseCount : 0
    const avgApprovalTime = validApprovalCount > 0 ? totalApprovalTime / validApprovalCount : 0
    
    // Update calculated metrics
    await prisma.userMetrics.update({
      where: { mlUserId: sellerId },
      data: {
        avgResponseTime,
        avgApprovalTime
      }
    })
    
    return NextResponse.json({
      ...metrics,
      avgResponseTime,
      avgApprovalTime,
      conversionRate: metrics.conversionRate || 0
    })
    
  } catch (error) {
    console.error("Metrics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
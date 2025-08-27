import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Get seller ID from ML
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
    
    // Get response time metrics from ML API
    let responseTimeData = null
    try {
      const responseTimeResponse = await fetch(
        `https://api.mercadolibre.com/users/${sellerId}/questions/response_time`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      )
      
      if (responseTimeResponse.ok) {
        responseTimeData = await responseTimeResponse.json()
      }
    } catch (error) {
      console.log("Could not fetch response time metrics:", error)
    }
    
    // Get seller reputation
    let reputationData = null
    try {
      const sellerResponse = await fetch(
        `https://api.mercadolibre.com/users/${sellerId}`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      )
      
      if (sellerResponse.ok) {
        const sellerData = await sellerResponse.json()
        reputationData = sellerData.seller_reputation
      }
    } catch (error) {
      console.log("Could not fetch reputation data:", error)
    }
    
    // Get recent questions for analysis
    let questionsData = null
    try {
      const questionsResponse = await fetch(
        `https://api.mercadolibre.com/questions/search?seller_id=${sellerId}&limit=100&api_version=4`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      )
      
      if (questionsResponse.ok) {
        questionsData = await questionsResponse.json()
      }
    } catch (error) {
      console.log("Could not fetch questions data:", error)
    }
    
    // Calculate metrics
    const metrics = {
      // Response time from ML API (in minutes)
      avgResponseTime: responseTimeData?.total?.response_time || 0,
      responseTimeWeekday: responseTimeData?.weekdays_working_hours?.response_time || 0,
      responseTimeWeekend: responseTimeData?.weekend?.response_time || 0,
      salesPercentIncrease: responseTimeData?.weekdays_working_hours?.sales_percent_increase || 0,
      
      // Reputation metrics
      level: reputationData?.level_id || "unknown",
      powerSellerStatus: reputationData?.power_seller_status || null,
      transactionsCompleted: reputationData?.transactions?.completed || 0,
      transactionsCanceled: reputationData?.transactions?.canceled || 0,
      
      // Questions analysis
      totalQuestionsML: questionsData?.total || 0,
      unansweredQuestions: questionsData?.questions?.filter((q: any) => 
        q.status === "UNANSWERED"
      ).length || 0,
      
      // Calculate response rate
      responseRate: questionsData?.questions ? 
        ((questionsData.questions.filter((q: any) => q.status === "ANSWERED").length / 
          Math.max(questionsData.questions.length, 1)) * 100).toFixed(1) : 0,
      
      // User details
      nickname: userData.nickname,
      userLevel: userData.seller_experience || "unknown",
      registrationDate: userData.registration_date,
      
      // Success metrics
      isTopSeller: responseTimeData?.total?.response_time < 60,
      needsImprovement: responseTimeData?.total?.response_time > 120,
      
      // Raw data for further analysis
      rawResponseTime: responseTimeData,
      rawReputation: reputationData
    }
    
    return NextResponse.json(metrics)
    
  } catch (error) {
    console.error("ML Metrics error:", error)
    return NextResponse.json({ error: "Failed to fetch ML metrics" }, { status: 500 })
  }
}
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
    
    // Get all questions for this seller
    const questions = await prisma.question.findMany({
      where: { mlUserId: sellerId },
      orderBy: { receivedAt: "desc" },
      take: 100 // Limit to last 100 questions
    })
    
    return NextResponse.json(questions)
    
  } catch (error) {
    console.error("Questions fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
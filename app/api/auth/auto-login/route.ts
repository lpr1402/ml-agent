import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sessionStore } from "@/lib/session-store"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "ml-agent-secret-key-2024"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const action = searchParams.get("action")
    
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    
    // Token is the questionId
    const question = await prisma.question.findUnique({
      where: { id: token }
    })
    
    if (!question) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    
    // Get user token for authentication
    const userToken = await prisma.userToken.findUnique({
      where: { mlUserId: question.mlUserId }
    })
    
    if (!userToken) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    
    // Create JWT session token
    const sessionToken = jwt.sign(
      {
        userId: question.mlUserId,
        questionId: token
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    )
    
    // Store session with token data
    const expiresIn = Math.floor((userToken.expiresAt.getTime() - Date.now()) / 1000)
    sessionStore.setSession(question.mlUserId, {
      accessToken: userToken.accessToken,
      refreshToken: userToken.refreshToken,
      expiresIn: expiresIn > 0 ? expiresIn : 3600, // Default to 1 hour if expired
      nickname: `User_${question.mlUserId}`
    })
    
    // Redirect to agent page with session
    const response = NextResponse.redirect(
      new URL(`/agente?question=${token}${action ? `&action=${action}` : ""}`, request.url)
    )
    
    // Set session cookie
    response.cookies.set("ml-session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400 // 24 hours
    })
    
    return response
    
  } catch (error) {
    console.error("Auto-login error:", error)
    return NextResponse.redirect(new URL("/login", request.url))
  }
}
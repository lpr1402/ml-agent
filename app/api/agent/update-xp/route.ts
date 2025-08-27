import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    const { xp, achievements, level, streak } = body
    
    // First, get existing metrics to compare maxStreak
    const existingMetrics = await prisma.userMetrics.findUnique({
      where: { mlUserId: auth.userId }
    })
    
    const maxStreak = existingMetrics 
      ? Math.max(existingMetrics.maxStreak || 0, streak || 0)
      : (streak || 0)
    
    // Update user metrics with XP and gamification data
    const updatedMetrics = await prisma.userMetrics.upsert({
      where: { mlUserId: auth.userId },
      update: {
        totalXP: xp || 0,
        currentLevel: level || 1,
        currentStreak: streak || 0,
        maxStreak: maxStreak,
        achievements: achievements || [],
        lastXPUpdate: new Date(),
        lastActiveAt: new Date()
      },
      create: {
        mlUserId: auth.userId,
        totalXP: xp || 0,
        currentLevel: level || 1,
        currentStreak: streak || 0,
        maxStreak: streak || 0,
        achievements: achievements || [],
        lastXPUpdate: new Date(),
        lastActiveAt: new Date(),
        totalQuestions: 0,
        answeredQuestions: 0,
        pendingQuestions: 0,
        autoApprovedCount: 0,
        manualApprovedCount: 0,
        revisedCount: 0,
        rejectedCount: 0,
        failedQuestions: 0
      }
    })
    
    return NextResponse.json({ 
      success: true,
      xp: updatedMetrics.totalXP,
      level: updatedMetrics.currentLevel,
      streak: updatedMetrics.currentStreak
    })
    
  } catch (error) {
    console.error("Update XP error:", error)
    return NextResponse.json({ error: "Failed to update XP" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const metrics = await prisma.userMetrics.findUnique({
      where: { mlUserId: auth.userId }
    })
    
    if (!metrics) {
      return NextResponse.json({
        xp: 0,
        level: 1,
        streak: 0,
        achievements: []
      })
    }
    
    return NextResponse.json({
      xp: metrics.totalXP,
      level: metrics.currentLevel,
      streak: metrics.currentStreak,
      maxStreak: metrics.maxStreak,
      achievements: metrics.achievements || [],
      lastUpdate: metrics.lastXPUpdate
    })
    
  } catch (error) {
    console.error("Get XP error:", error)
    return NextResponse.json({ error: "Failed to get XP" }, { status: 500 })
  }
}
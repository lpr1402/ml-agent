import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { prisma } from "@/lib/prisma"

export async function POST(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const sellerId = auth.mlAccount.mlUserId
    
    const body = await _request.json()
    const { xp, achievements, level, streak } = body
    
    // First, get existing metrics to compare maxStreak
    const existingMetrics = await prisma.userMetrics.findUnique({
      where: { mlUserId: sellerId }
    })
    
    const maxStreak = existingMetrics 
      ? Math.max(existingMetrics.maxStreak || 0, streak || 0)
      : (streak || 0)
    
    // Update user metrics with XP and gamification data
    const updatedMetrics = await prisma.userMetrics.upsert({
      where: { mlUserId: sellerId },
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
        mlUserId: sellerId,
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
    logger.error("Update XP error:", { error })
    return NextResponse.json({ error: "Failed to update XP" }, { status: 500 })
  }
}

export async function GET(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const sellerId = auth.mlAccount.mlUserId
    
    const metrics = await prisma.userMetrics.findUnique({
      where: { mlUserId: sellerId }
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
    logger.error("Get XP error:", { error })
    return NextResponse.json({ error: "Failed to get XP" }, { status: 500 })
  }
}
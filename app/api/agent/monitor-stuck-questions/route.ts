import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

/**
 * Monitor questions stuck in PROCESSING status for too long
 * This should be called periodically (e.g., every minute via cron)
 */
export async function GET() {
  try {
    const TIMEOUT_MINUTES = 5 // Questions processing for more than 5 minutes are considered stuck
    const cutoffTime = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000)
    
    // Find questions stuck in PROCESSING status
    const stuckQuestions = await prisma.question.updateMany({
      where: {
        status: 'PROCESSING',
        receivedAt: {
          lt: cutoffTime
        }
      },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        mlResponseData: JSON.stringify({ 
          error: 'Tempo limite de processamento excedido (5 minutos)' 
        })
      }
    })
    
    if (stuckQuestions.count > 0) {
      logger.warn(`[Monitor] Marked ${stuckQuestions.count} stuck questions as FAILED`, {
        count: stuckQuestions.count,
        timeout: TIMEOUT_MINUTES
      })
    }
    
    // Also find questions in PENDING status for too long (never got processed)
    const pendingQuestions = await prisma.question.updateMany({
      where: {
        status: 'PENDING',
        receivedAt: {
          lt: cutoffTime
        }
      },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        mlResponseData: JSON.stringify({ 
          error: 'Pergunta não foi processada (timeout)' 
        })
      }
    })
    
    if (pendingQuestions.count > 0) {
      logger.warn(`[Monitor] Marked ${pendingQuestions.count} pending questions as FAILED`, {
        count: pendingQuestions.count,
        timeout: TIMEOUT_MINUTES
      })
    }
    
    return NextResponse.json({
      success: true,
      processed: stuckQuestions.count,
      pending: pendingQuestions.count,
      message: `Processed ${stuckQuestions.count} stuck and ${pendingQuestions.count} pending questions`
    })
    
  } catch (error) {
    logger.error("[Monitor] Error monitoring stuck questions", { error })
    return NextResponse.json(
      { error: "Failed to monitor stuck questions" },
      { status: 500 }
    )
  }
}

// POST method to manually trigger monitoring
export async function POST() {
  return GET()
}
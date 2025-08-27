import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendApprovalConfirmation } from "@/lib/services/whatsapp-professional"
import { tokenManager } from "@/lib/token-manager"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

// Function to post answer to ML with retry logic
async function postAnswerToML(
  questionId: string, 
  answer: string, 
  accessToken: string,
  maxRetries: number = 3
): Promise<{success: boolean; status: number; data: any; error?: string}> {
  let lastError: string = ""
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ML API] Attempt ${attempt}/${maxRetries} - Posting answer for question ${questionId}`)
      
      const response = await fetch("https://api.mercadolibre.com/answers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          question_id: questionId,
          text: answer
        })
      })
      
      const responseText = await response.text()
      let data = null
      
      try {
        data = responseText ? JSON.parse(responseText) : null
      } catch (e) {
        console.error("Failed to parse ML response:", responseText)
      }
      
      if (response.ok) {
        console.log(`[ML API] Success! Answer posted for question ${questionId}`)
        return {
          success: true,
          status: response.status,
          data
        }
      }
      
      // Handle specific ML errors
      if (response.status === 400 && data?.message?.includes("already answered")) {
        console.log(`[ML API] Question ${questionId} already answered`)
        return {
          success: true, // Consider already answered as success
          status: response.status,
          data
        }
      }
      
      // Don't retry on client errors (4xx) except 401/403
      if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403) {
        lastError = data?.message || responseText || `Client error: ${response.status}`
        console.error(`[ML API] Client error (no retry): ${lastError}`)
        break
      }
      
      lastError = data?.message || responseText || `HTTP ${response.status}`
      console.error(`[ML API] Attempt ${attempt} failed:`, lastError)
      
      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Max 10 seconds
        console.log(`[ML API] Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      console.error(`[ML API] Network error on attempt ${attempt}:`, lastError)
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  return {
    success: false,
    status: 0,
    data: null,
    error: lastError
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user authentication from request headers
    const auth = await getAuthFromRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { questionId, action, response: userResponse } = await request.json()
    
    if (!questionId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    // Get question details (no include needed since we don't use the relation here)
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    // Determine final response
    const finalResponse = userResponse || question.aiResponse
    
    if (!finalResponse) {
      return NextResponse.json({ error: "No response available" }, { status: 400 })
    }
    
    // Update question status
    await prisma.question.update({
      where: { id: questionId },
      data: {
        finalResponse,
        approvedAt: new Date(),
        approvalType: action === "approve" ? "AUTO" : action === "manual" ? "MANUAL" : "REVISED",
        status: "APPROVED"
      }
    })
    
    // Update user metrics
    const metricsUpdate: any = {
      pendingQuestions: { decrement: 1 },
      answeredQuestions: { increment: 1 },
      lastActiveAt: new Date()
    }
    
    if (action === "approve") {
      metricsUpdate.autoApprovedCount = { increment: 1 }
    } else if (action === "revise") {
      metricsUpdate.revisedCount = { increment: 1 }
    } else {
      metricsUpdate.manualApprovedCount = { increment: 1 }
    }
    
    await prisma.userMetrics.update({
      where: { mlUserId: question.mlUserId },
      data: metricsUpdate
    })
    
    // Get access token using tokenManager for 24/7 operation
    let accessToken = await tokenManager.getAccessToken(question.mlUserId)
    
    if (!accessToken) {
      console.error(`[Approve] No valid token for seller ${question.mlUserId} - checking for user token from auth`)
      
      // Try to use the current user's token if they are the seller
      const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      })
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (String(userData.id) === question.mlUserId) {
          console.log(`[Approve] Using current user's token for seller ${question.mlUserId}`)
          accessToken = auth.accessToken
          
          // Store this token for future use
          await tokenManager.storeTokens({
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken || "",
            expiresIn: auth.expiresIn || 21600,
            userId: question.mlUserId
          })
        }
      }
      
      if (!accessToken) {
        console.error(`[Approve] No access token available for seller ${question.mlUserId}`)
        
        // Update question status to indicate token issue
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: "TOKEN_ERROR",
            mlResponseCode: 401
          }
        })
        
        return NextResponse.json({ 
          error: "No valid access token for seller. Please re-authenticate.",
          requiresAuth: true 
        }, { status: 403 })
      }
    }
    
    // Post to Mercado Livre with retry logic
    console.log(`[Approve] Posting answer to ML for question ${question.mlQuestionId}`)
    const mlResult = await postAnswerToML(question.mlQuestionId, finalResponse, accessToken)
    
    if (mlResult.success) {
      // Only mark as COMPLETED after successful ML response
      try {
        await prisma.question.update({
          where: { id: questionId },
          data: {
            sentToMLAt: new Date(),
            mlResponseCode: mlResult.status || 200, // Ensure it's a number
            mlResponseData: mlResult.data ? JSON.stringify(mlResult.data) : "", // Ensure it's a string
            status: "COMPLETED" // Only set COMPLETED after confirmed success
          }
        })
      } catch (prismaError) {
        console.error("[Approve] Prisma update error:", prismaError)
        throw prismaError
      }
      
      console.log(`[Approve] Successfully posted answer for question ${question.mlQuestionId}`)
      
      // Send WhatsApp confirmation
      await sendApprovalConfirmation({
        sequentialId: question.sequentialId,
        questionText: question.text,
        finalAnswer: question.finalResponse || question.aiResponse || "",
        productTitle: question.itemTitle || "Produto",
        approved: action === "approve"
      })
      
      return NextResponse.json({
        success: true,
        message: "Answer posted to Mercado Livre",
        mlResponse: mlResult.data
      })
    } else {
      // Mark as FAILED with detailed error info
      await prisma.question.update({
        where: { id: questionId },
        data: {
          mlResponseCode: mlResult.status || 500, // Ensure it's a number
          mlResponseData: JSON.stringify({
            error: mlResult.error || "Unknown error",
            timestamp: new Date().toISOString(),
            attempts: 3
          }), // Always a valid JSON string
          status: "FAILED"
        }
      })
      
      // Update metrics - just update lastActiveAt
      await prisma.userMetrics.update({
        where: { mlUserId: question.mlUserId },
        data: {
          lastActiveAt: new Date()
        }
      })
      
      console.error(`[Approve] Failed to post answer for question ${question.mlQuestionId}:`, mlResult.error)
      
      return NextResponse.json({
        success: false,
        message: "Failed to post to Mercado Livre after 3 attempts",
        error: mlResult.error,
        status: mlResult.status || 500,
        canRetry: true // Indicate that retry is possible
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error("Approval error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Quick approve endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("id")
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }
    
    // Auto-approve with AI response
    const response = await fetch(request.url.replace("/approve-question", "/approve-question"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        action: "approve",
        response: null // Use AI response
      })
    })
    
    if (response.ok) {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1>✅ Resposta Aprovada!</h1>
            <p>A resposta foi enviada ao cliente no Mercado Livre.</p>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Fechar</button>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      })
    } else {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1>❌ Erro</h1>
            <p>Não foi possível aprovar a resposta.</p>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Fechar</button>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      })
    }
    
  } catch (error) {
    console.error("Quick approve error:", error)
    return new Response("Error", { status: 500 })
  }
}
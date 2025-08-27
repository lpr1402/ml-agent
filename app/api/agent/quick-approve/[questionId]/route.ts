import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { tokenManager } from "@/lib/token-manager"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> }
) {
  try {
    const params = await context.params
    const questionId = params.questionId
    
    // Get question details
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { user: true }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    if (!question.aiResponse) {
      return NextResponse.json({ error: "No AI response available" }, { status: 400 })
    }
    
    // Get access token
    const accessToken = await tokenManager.getAccessToken(question.mlUserId)
    
    if (!accessToken) {
      return NextResponse.json({ error: "No access token available" }, { status: 401 })
    }
    
    // Send answer to Mercado Livre
    const mlResponse = await fetch(
      `https://api.mercadolibre.com/answers?api_version=4`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: question.mlQuestionId,
          text: question.aiResponse
        })
      }
    )
    
    if (!mlResponse.ok) {
      const errorText = await mlResponse.text()
      console.error("ML API error:", errorText)
      return NextResponse.json({ 
        error: "Failed to send to ML", 
        details: errorText 
      }, { status: 500 })
    }
    
    const mlData = await mlResponse.json()
    
    // Update question status
    await prisma.question.update({
      where: { id: questionId },
      data: {
        status: "COMPLETED",
        finalResponse: question.aiResponse,
        approvedAt: new Date(),
        approvalType: "AUTO",
        sentToMLAt: new Date(),
        mlResponseCode: mlResponse.status
      }
    })
    
    // Update metrics
    await prisma.userMetrics.update({
      where: { mlUserId: question.mlUserId },
      data: {
        answeredQuestions: { increment: 1 },
        pendingQuestions: { decrement: 1 },
        autoApprovedCount: { increment: 1 }
      }
    })
    
    // Send WhatsApp confirmation
    try {
      const { sendApprovalConfirmation } = await import("@/lib/services/whatsapp-professional")
      await sendApprovalConfirmation({
        sequentialId: question.sequentialId,
        questionText: question.text,
        finalAnswer: question.aiResponse || "",
        productTitle: question.itemTitle || "Produto",
        approved: true
      })
    } catch (whatsappError) {
      console.error("WhatsApp confirmation error:", whatsappError)
      // Continue even if WhatsApp fails
    }
    
    // Return HTML page with success message
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Resposta Aprovada</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 500px;
            text-align: center;
          }
          .success-icon {
            width: 80px;
            height: 80px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
          }
          .success-icon svg {
            width: 40px;
            height: 40px;
            color: white;
          }
          h1 {
            color: #1f2937;
            font-size: 28px;
            margin: 0 0 12px;
          }
          p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 24px;
          }
          .question-box {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
            text-align: left;
          }
          .question-box strong {
            color: #374151;
            display: block;
            margin-bottom: 8px;
          }
          .question-box span {
            color: #6b7280;
            font-size: 14px;
          }
          .button {
            background: #6366f1;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background 0.2s;
          }
          .button:hover {
            background: #4f46e5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1>Resposta Aprovada!</h1>
          <p>A resposta foi enviada com sucesso para o Mercado Livre.</p>
          
          <div class="question-box">
            <strong>Pergunta:</strong>
            <span>${question.text}</span>
          </div>
          
          <div class="question-box">
            <strong>Sua resposta:</strong>
            <span>${question.aiResponse}</span>
          </div>
          
          <p style="color: #10b981; font-weight: 500;">
            ✅ Resposta publicada no Mercado Livre
          </p>
          
          <a href="/agente" class="button">Voltar ao Painel</a>
        </div>
        
        <script>
          // Auto close window after 5 seconds if opened from WhatsApp
          if (window.opener === null && window.history.length <= 1) {
            setTimeout(() => {
              window.close();
            }, 5000);
          }
        </script>
      </body>
      </html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      }
    )
    
  } catch (error) {
    console.error("Quick approve error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

const N8N_WEBHOOK_URL = "https://dashboard.axnexlabs.com.br/webhook/processamento"

export async function POST(request: NextRequest) {
  try {
    // Get user authentication
    const auth = await getAuthFromRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { questionId } = await request.json()
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }
    
    // Get question details
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    // Only allow reprocessing of failed questions
    if (question.status !== "FAILED" && question.status !== "TOKEN_ERROR") {
      return NextResponse.json({ 
        error: "Only failed questions can be reprocessed",
        currentStatus: question.status 
      }, { status: 400 })
    }
    
    console.log(`[Reprocess] Reprocessing question ${question.mlQuestionId}`)
    
    // Update status to PROCESSING
    await prisma.question.update({
      where: { id: questionId },
      data: { 
        status: "PROCESSING"
      }
    })
    
    // Get user's access token for API calls
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
    
    // Verify this is the seller's question
    if (question.mlUserId !== sellerId) {
      return NextResponse.json({ error: "Unauthorized - not your question" }, { status: 403 })
    }
    
    // Fetch complete product data from ML API
    const productResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })
    
    let productData = null
    if (productResponse.ok) {
      productData = await productResponse.json()
    } else {
      // Try without auth
      const publicResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`)
      if (publicResponse.ok) {
        productData = await publicResponse.json()
      }
    }
    
    if (!productData) {
      // Use stored data as fallback
      productData = {
        title: question.itemTitle,
        price: question.itemPrice,
        available_quantity: 1,
        condition: 'new'
      }
    }
    
    // Fetch product description
    let descriptionData = null
    try {
      const descResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}/description`, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      })
      if (descResponse.ok) {
        descriptionData = await descResponse.json()
      }
    } catch (error) {
      console.log("Could not fetch description")
    }
    
    // Get seller info
    const sellerData = await fetch(`https://api.mercadolibre.com/users/${question.mlUserId}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    }).then(r => r.ok ? r.json() : null)
    
    // Prepare EXACT same payload format as original webhook
    const n8nPayload = {
      // 1. AI PERSONA
      ai_persona: `Você é ${sellerData?.nickname || "o vendedor"}, ${
        sellerData?.seller_reputation?.level_id ? 
        `vendedor com reputação ${sellerData.seller_reputation.level_id}` : 
        "vendedor profissional"
      } no Mercado Livre. Você vende ${productData.title} e deve responder como especialista neste produto.`,
      
      // SIGNATURE
      signature: `Equipe ${sellerData?.nickname || "Vendedor"}`,
      
      // 2. PRODUCT COMPLETE
      product_complete: `PRODUTO: ${productData.title}
PREÇO: R$ ${productData.price}
ESTOQUE: ${productData.available_quantity || 1} unidades disponíveis
${productData.sold_quantity > 0 ? `VENDIDOS: ${productData.sold_quantity} unidades já vendidas` : ''}
CONDIÇÃO: ${productData.condition === 'new' ? 'Novo' : 'Usado'}
DESCRIÇÃO: ${descriptionData?.plain_text || descriptionData?.text || 'Produto de qualidade'}
CARACTERÍSTICAS: ${productData.attributes
        ?.filter((attr: any) => attr.value_name)
        ?.map((attr: any) => `${attr.name}: ${attr.value_name}`)
        .join(", ") || 'Várias características técnicas'}
${productData.variations?.length > 0 ? `VARIAÇÕES: ${productData.variations
        ?.map((v: any) => v.attribute_combinations
          ?.map((ac: any) => `${ac.name}: ${ac.value_name}`).join(", "))
        .join(" | ")}` : ''}`,
      
      // 3. BUYER CONTEXT
      buyer_context: "Comprador interessado no produto (reprocessamento de pergunta)",
      
      // 4. KNOWLEDGE BASE
      knowledge_base: "Use seu conhecimento sobre o produto para responder adequadamente.",
      
      // 5. CURRENT QUESTION
      current_question: question.text,
      
      // 6. RECENT ACTIVITY
      recent_activity: "Pergunta sendo reprocessada por solicitação do vendedor.",
      
      // 7. BUSINESS INFO
      business_info: `FRETE: ${productData.shipping?.free_shipping ? 'Grátis' : 'Pago pelo comprador'}
ENVIO: ${productData.shipping?.mode === 'me2' ? 'Mercado Envios Full' : productData.shipping?.mode || 'Normal'}
GARANTIA: ${productData.warranty || 'Garantia do fabricante'}
PAGAMENTO: ${productData.accepts_mercadopago ? 'Aceita Mercado Pago (parcelamento disponível)' : 'Consulte formas de pagamento'}
${productData.attributes?.find((a: any) => a.id === "BRAND")?.value_name ? 
        `MARCA: ${productData.attributes.find((a: any) => a.id === "BRAND").value_name}` : ''}
${productData.attributes?.find((a: any) => a.id === "MODEL")?.value_name ? 
        `MODELO: ${productData.attributes.find((a: any) => a.id === "MODEL").value_name}` : ''}`,
      
      // 8. RESPONSE INSTRUCTIONS
      response_instructions: `IMPORTANTE: Responda em português brasileiro, máximo 500 caracteres, seja direto e profissional. ${
        productData.sold_quantity > 10 ? 'Destaque que o produto é muito procurado.' : ''
      } ${
        productData.shipping?.free_shipping ? 'Mencione o frete grátis se relevante.' : ''
      } Use informações do produto para ser específico. Seja cordial mas objetivo. SEMPRE finalize com a assinatura fornecida no campo signature.`,
      
      // 9. MEMORY KEY
      memory_key: `${question.itemId}_${question.mlUserId}`,
      
      // 10. METADATA
      metadata: {
        question_id: question.mlQuestionId,
        item_id: question.itemId,
        seller_id: question.mlUserId,
        buyer_id: question.buyerId || "anonymous",
        timestamp: new Date().toISOString(),
        reprocessed: true
      }
    }
    
    // Send to N8N for reprocessing
    try {
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(n8nPayload)
      })
      
      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text()
        console.error("[Reprocess] N8N webhook failed:", errorText)
        
        // Update status back to FAILED
        await prisma.question.update({
          where: { id: questionId },
          data: { 
            status: "FAILED"
          }
        })
        
        return NextResponse.json({ 
          error: "Failed to reprocess question",
          details: errorText 
        }, { status: 500 })
      }
      
      console.log(`[Reprocess] Question ${question.mlQuestionId} sent to N8N for reprocessing`)
      
      // N8N will send response back to /api/n8n/response
      
      return NextResponse.json({
        success: true,
        message: "Question sent for reprocessing",
        questionId: question.id
      })
      
    } catch (n8nError) {
      console.error("[Reprocess] N8N request error:", n8nError)
      
      // Update status back to FAILED
      await prisma.question.update({
        where: { id: questionId },
        data: { 
          status: "FAILED"
        }
      })
      
      return NextResponse.json({ 
        error: "Failed to connect to processing service" 
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error("[Reprocess] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint to check if question can be reprocessed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("questionId")
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }
    
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        status: true
      }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    const canReprocess = question.status === "FAILED" || question.status === "TOKEN_ERROR"
    
    return NextResponse.json({
      canReprocess,
      status: question.status
    })
    
  } catch (error) {
    console.error("[Reprocess] Check error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
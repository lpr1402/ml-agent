import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sessionStore } from "@/lib/session-store"
import { tokenManager } from "@/lib/token-manager"

const N8N_WEBHOOK_URL = "https://dashboard.axnexlabs.com.br/webhook/processamento"

// Helper to fetch from ML API
async function fetchFromML(endpoint: string, accessToken?: string | null) {
  const headers: any = {
    "Accept": "application/json",
    "Content-Type": "application/json"
  }
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }
  
  const response = await fetch(`https://api.mercadolibre.com${endpoint}`, { 
    headers,
    cache: 'no-store' 
  })
  
  if (!response.ok) {
    console.error(`ML API error for ${endpoint}:`, response.status)
    
    // If unauthorized or forbidden, try public endpoint
    if ((response.status === 401 || response.status === 403) && accessToken) {
      console.log("Retrying as public endpoint...")
      const publicResponse = await fetch(`https://api.mercadolibre.com${endpoint}`, {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        cache: 'no-store'
      })
      
      if (publicResponse.ok) {
        return publicResponse.json()
      }
    }
    
    return null
  }
  
  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const notification = await request.json()
    console.log("📨 ML Webhook received:", notification)
    
    // Extract question ID and seller ID
    const questionId = notification.resource?.split("/").pop()
    const sellerId = String(notification.user_id)
    
    if (!questionId || !sellerId) {
      console.error("Missing questionId or sellerId")
      return NextResponse.json({ error: "Invalid notification" }, { status: 400 })
    }
    
    // Check if question already processed
    const existingQuestion = await prisma.question.findUnique({
      where: { mlQuestionId: questionId }
    })
    
    if (existingQuestion) {
      console.log(`Question ${questionId} already exists`)
      return NextResponse.json({ status: "already_processed" })
    }
    
    // Get seller's access token - first try database (24/7), then session (memory)
    let accessToken = await tokenManager.getAccessToken(sellerId)
    
    if (!accessToken) {
      // Fallback to session store if not in database
      accessToken = await sessionStore.getAccessToken(sellerId)
      
      if (!accessToken) {
        console.warn(`No access token for seller ${sellerId} in database or memory, using public API`)
      } else {
        console.log(`Using session token for seller ${sellerId} (from memory)`)
      }
    } else {
      console.log(`Using persistent token for seller ${sellerId} (from database)`)
    }
    
    // 1. Fetch question details with api_version=4
    const questionData = await fetchFromML(`${notification.resource}?api_version=4`, accessToken)
    
    if (!questionData) {
      console.error("Failed to fetch question data")
      return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 })
    }
    
    const itemId = questionData.item_id
    const questionText = questionData.text
    const buyerId = questionData.from?.id
    
    // 2. Fetch complete product information
    const productData = await fetchFromML(`/items/${itemId}`, accessToken)
    
    if (!productData) {
      console.error("Failed to fetch product data")
      return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 })
    }
    
    // 3. Fetch product description
    const descriptionData = await fetchFromML(`/items/${itemId}/description`, accessToken)
    
    // 4. Fetch ALL questions from this item (last 10 for context)
    const allItemQuestions = await fetchFromML(
      `/questions/search?item=${itemId}&api_version=4&limit=10&sort_fields=date_created&sort_types=DESC`,
      accessToken
    )
    
    // 5. Fetch questions from THIS SPECIFIC BUYER on THIS ITEM
    const buyerQuestions = buyerId ? await fetchFromML(
      `/questions/search?item=${itemId}&from=${buyerId}&api_version=4`,
      accessToken
    ) : null
    
    // 6. Fetch only ANSWERED questions for knowledge base
    const answeredQuestions = await fetchFromML(
      `/questions/search?item=${itemId}&status=answered&api_version=4&limit=20`,
      accessToken
    )
    
    // Get seller info for context
    const sellerData = await fetchFromML(`/users/${sellerId}`, accessToken)
    
    // 7. Prepare OPTIMIZED data for N8N - 11 PERFECT fields for AI context
    const n8nPayload = {
      // 1. AI PERSONA - Who the AI should be
      ai_persona: `Você é ${sellerData?.nickname || "o vendedor"}, ${
        sellerData?.seller_reputation?.level_id ? 
        `vendedor com reputação ${sellerData.seller_reputation.level_id}` : 
        "vendedor profissional"
      } no Mercado Livre. Você vende ${productData.title} e deve responder como especialista neste produto.`,
      
      // SIGNATURE - Formatted seller signature for response
      signature: `Equipe ${sellerData?.nickname || "Vendedor"}`,
      
      // 2. PRODUCT COMPLETE - Everything about the product in natural language
      product_complete: `PRODUTO: ${productData.title}
PREÇO: R$ ${productData.price}
ESTOQUE: ${productData.available_quantity} unidades disponíveis
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
      
      // 3. BUYER CONTEXT - Who is asking and their history
      buyer_context: buyerQuestions?.questions?.length > 0 ? 
        `Este comprador já fez ${buyerQuestions.questions.length} pergunta(s) anteriormente neste produto: ${
          buyerQuestions.questions.map((q: any) => 
            `"${q.text}" (${q.answer?.text ? `respondida: "${q.answer.text}"` : 'aguardando resposta'})`
          ).join("; ")
        }` : 
        `Novo comprador interessado no produto${
          questionData.from?.answered_questions > 0 ? 
          `, já teve ${questionData.from.answered_questions} perguntas respondidas em outros produtos` : 
          ''
        }`,
      
      // 4. KNOWLEDGE BASE - Previous Q&A as examples
      knowledge_base: answeredQuestions?.questions?.length > 0 ?
        `Exemplos de perguntas já respondidas neste produto:\n${
          answeredQuestions.questions
            .filter((q: any) => q.answer?.text)
            .slice(0, 10)
            .map((q: any) => `Cliente: "${q.text}"\nVocê respondeu: "${q.answer.text}"`)
            .join("\n\n")
        }` : 
        "Ainda não há perguntas respondidas neste produto para usar como exemplo.",
      
      // 5. CURRENT QUESTION - What needs to be answered
      current_question: questionText,
      
      // 6. RECENT ACTIVITY - Latest interactions for context
      recent_activity: allItemQuestions?.questions?.length > 0 ?
        `Últimas ${Math.min(5, allItemQuestions.questions.length)} perguntas neste anúncio:\n${
          allItemQuestions.questions
            .slice(0, 5)
            .map((q: any) => `- "${q.text}" (${q.status === 'ANSWERED' ? 'respondida' : 'aguardando'}${
              q.date_created ? ` em ${new Date(q.date_created).toLocaleDateString('pt-BR')}` : ''
            })`)
            .join("\n")
        }` : 
        "Primeira pergunta neste anúncio.",
      
      // 7. BUSINESS INFO - Shipping, warranty, payment
      business_info: `FRETE: ${productData.shipping?.free_shipping ? 'Grátis' : 'Pago pelo comprador'}
ENVIO: ${productData.shipping?.mode === 'me2' ? 'Mercado Envios Full' : productData.shipping?.mode || 'Normal'}
GARANTIA: ${productData.warranty || 'Garantia do fabricante'}
PAGAMENTO: ${productData.accepts_mercadopago ? 'Aceita Mercado Pago (parcelamento disponível)' : 'Consulte formas de pagamento'}
${productData.attributes?.find((a: any) => a.id === "BRAND")?.value_name ? 
  `MARCA: ${productData.attributes.find((a: any) => a.id === "BRAND").value_name}` : ''}
${productData.attributes?.find((a: any) => a.id === "MODEL")?.value_name ? 
  `MODELO: ${productData.attributes.find((a: any) => a.id === "MODEL").value_name}` : ''}`,
      
      // 8. RESPONSE INSTRUCTIONS - How to answer
      response_instructions: `IMPORTANTE: Responda em português brasileiro, máximo 500 caracteres, seja direto e profissional. ${
        productData.sold_quantity > 10 ? 'Destaque que o produto é muito procurado.' : ''
      } ${
        productData.shipping?.free_shipping ? 'Mencione o frete grátis se relevante.' : ''
      } Use informações do produto para ser específico. Seja cordial mas objetivo. SEMPRE finalize com a assinatura fornecida no campo signature.`,
      
      // 9. MEMORY KEY - For AI memory/context persistence
      memory_key: `${itemId}_${sellerId}`,
      
      // 10. METADATA - IDs for tracking and processing
      metadata: {
        question_id: questionId,
        item_id: itemId,
        seller_id: sellerId,
        buyer_id: buyerId || "anonymous",
        timestamp: new Date().toISOString()
      }
    }
    
    // 8. Update or create user metrics
    await prisma.userMetrics.upsert({
      where: { mlUserId: sellerId },
      update: {
        totalQuestions: { increment: 1 },
        pendingQuestions: { increment: 1 },
        lastQuestionAt: new Date(),
        lastActiveAt: new Date()
      },
      create: {
        mlUserId: sellerId,
        totalQuestions: 1,
        pendingQuestions: 1,
        firstQuestionAt: new Date(),
        lastQuestionAt: new Date(),
        lastActiveAt: new Date()
      }
    })
    
    // 9. Create question record with PROCESSING status
    await prisma.question.create({
      data: {
        mlQuestionId: questionId,
        mlUserId: sellerId,
        text: questionText,
        itemId: itemId,
        itemTitle: productData.title,
        itemPrice: productData.price,
        itemPermalink: productData.permalink, // Store the official ML permalink
        buyerId: buyerId ? String(buyerId) : null,
        status: "PROCESSING",
        receivedAt: new Date()
      }
    })
    
    console.log(`📤 Sending to N8N webhook:`, {
      question: n8nPayload.current_question,
      seller: sellerData?.nickname,
      signature: n8nPayload.signature,
      product: productData.title,
      memory_key: n8nPayload.memory_key,
      optimized_fields: 11
    })
    
    // 10. Send to N8N webhook for AI processing
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
        console.error("N8N webhook failed:", n8nResponse.status, errorText)
        
        // Update status to FAILED
        await prisma.question.update({
          where: { mlQuestionId: questionId },
          data: { status: "FAILED" }
        })
        
        await prisma.userMetrics.update({
          where: { mlUserId: sellerId },
          data: {
            pendingQuestions: { decrement: 1 }
          }
        })
        
        return NextResponse.json({ error: "N8N processing failed" }, { status: 500 })
      }
      
      console.log(`✅ Question ${questionId} sent to N8N for processing`)
      
      // N8N will process and send response to /api/n8n/response
      
    } catch (n8nError) {
      console.error("N8N request error:", n8nError)
      
      await prisma.question.update({
        where: { mlQuestionId: questionId },
        data: { status: "FAILED" }
      })
      
      await prisma.userMetrics.update({
        where: { mlUserId: sellerId },
        data: {
          pendingQuestions: { decrement: 1 }
        }
      })
      
      return NextResponse.json({ error: "N8N connection failed" }, { status: 500 })
    }
    
    return NextResponse.json({ 
      status: "processing",
      questionId,
      message: "Question sent to AI agent for processing"
    })
    
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
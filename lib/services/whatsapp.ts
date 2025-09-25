import { logger } from '@/lib/logger'

interface WhatsAppNotification {
  questionId: string
  question: string
  suggestedAnswer: string
  productTitle: string
  productImage?: string
  productPrice?: number
  confidence: number
  sellerName?: string
}

export async function notifyWhatsApp({
  questionId,
  question,
  suggestedAnswer,
  productTitle,
  productImage,
  productPrice,
  confidence,
  sellerName,
}: WhatsAppNotification): Promise<boolean> {
  try {
    const confidenceEmoji = getConfidenceEmoji(confidence)
    const confidenceText = getConfidenceText(confidence)
    
    // Construir URLs para os botões
    const approvalUrl = `${process.env['NEXT_PUBLIC_APP_URL']}/agente/aprovar/${questionId}`
    const approveDirectUrl = `${process.env['NEXT_PUBLIC_APP_URL']}/api/agent/quick-approve/${questionId}?action=approve&quick=true`
    
    // Formatar mensagem com formatação melhorada
    const message = `📣 *${sellerName || "Vendedor"}*

🛍️ *Nova pergunta sobre:* ${productTitle}
${productPrice ? `💰 *Preço:* R$ ${productPrice.toFixed(2)}` : ""}

❓ *Pergunta do Cliente:*
_"${question}"_

🤖 *Resposta Sugerida:* ${confidenceEmoji}
_"${suggestedAnswer}"_

📊 *Confiança:* ${confidenceText} (${Math.round(confidence * 100)}%)

⏰ *Resposta automática em 5 minutos*`

    // Preparar body com botões interativos
    const bodyData: any = {
      recipient: process.env['ZAPSTER_GROUP_ID'] || "group:120363420949294702",
      text: message,
      instance_id: process.env['ZAPSTER_INSTANCE_ID'] || "21iwlxlswck0m95497nzl",
      // Adicionar botões interativos
      buttons: [
        {
          label: "✅ Aprovar",
          type: "url",
          url: approveDirectUrl
        },
        {
          label: "✏️ Editar",
          type: "url",
          url: approvalUrl
        }
      ],
      buttons_mode: "interactive" // Forçar modo interativo para melhor visualização
    }

    // Adicionar imagem se disponível
    if (productImage) {
      try {
        // Para imagens, usar media.url ao invés de base64 (mais eficiente)
        bodyData.media = {
          url: productImage,
          caption: `${productTitle}${productPrice ? ` - R$ ${productPrice.toFixed(2)}` : ""}`
        }
      } catch (error) {
        logger.info("Erro ao processar imagem:", { error })
      }
    }

    // Enviar para WhatsApp via Zapster API
    const response = await fetch("https://api.zapsterapi.com/v1/wa/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env['ZAPSTER_API_TOKEN']}`,
        "Content-Type": "application/json",
        "X-Instance-ID": process.env['ZAPSTER_INSTANCE_ID'] || "21iwlxlswck0m95497nzl"
      },
      body: JSON.stringify(bodyData),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error("WhatsApp API error:", { error })
      return false
    }

    logger.info("WhatsApp notification sent successfully")
    return true
  } catch (error) {
    logger.error("Error sending WhatsApp notification:", { error })
    return false
  }
}

export async function sendApprovalConfirmation(
  _questionId: string,
  action: "approved" | "edited" | "rejected",
  productTitle?: string
): Promise<boolean> {
  try {
    const emoji = action === "approved" ? "✅" : action === "edited" ? "✏️" : "❌"
    const actionText = 
      action === "approved" ? "APROVADA" : 
      action === "edited" ? "EDITADA E ENVIADA" : 
      "REJEITADA"
    
    const message = `${emoji} *Sua resposta foi enviada ao cliente no Mercado Livre!*

${productTitle ? `📦 *Produto:* ${productTitle}` : ""}

Status: *${actionText}*
${action !== "rejected" 
  ? "✅ Resposta enviada com sucesso ao cliente!" 
  : "❌ Resposta rejeitada e não enviada"}

${action === "approved" 
  ? "🚀 A resposta foi aprovada automaticamente e já está visível para o cliente." 
  : action === "edited" 
    ? "✏️ Sua edição foi aplicada e a resposta personalizada foi enviada."
    : "⚠️ A resposta foi rejeitada e não será enviada."}

---
_ML Agent IA - Atendimento Inteligente_`

    const response = await fetch("https://api.zapsterapi.com/v1/wa/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env['ZAPSTER_API_TOKEN']}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: process.env['ZAPSTER_GROUP_ID'] || "group:120363420949294702",
        text: message,
        instance_id: process.env['ZAPSTER_INSTANCE_ID'] || "21iwlxlswck0m95497nzl",
      }),
    })

    return response.ok
  } catch (error) {
    logger.error("Error sending approval confirmation:", { error })
    return false
  }
}

function getConfidenceEmoji(confidence: number): string {
  if (confidence >= 0.9) return "🟢"
  if (confidence >= 0.7) return "🟡"
  if (confidence >= 0.5) return "🟠"
  return "🔴"
}

function getConfidenceText(confidence: number): string {
  if (confidence >= 0.9) return "Muito Alta"
  if (confidence >= 0.7) return "Alta"
  if (confidence >= 0.5) return "Média"
  return "Baixa"
}

export async function sendQuestionNotification(
  questionId: string,
  question: string,
  aiResponse: string,
  productInfo: any
): Promise<boolean> {
  try {
    const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || "https://gugaleo.axnexlabs.com.br"
    const approvalUrl = `${baseUrl}/agente/aprovar/${questionId}`
    const approveDirectUrl = `${baseUrl}/api/agent/quick-approve/${questionId}?action=approve&quick=true`
    
    const message = `🤖 *Nova Pergunta Processada pela IA*

📦 *Produto:* ${productInfo?.title || "Produto"}
💰 *Preço:* R$ ${productInfo?.price?.toFixed(2) || "N/A"}

❓ *Pergunta:*
_"${question}"_

✨ *Resposta Gerada (GPT-5):*
_"${aiResponse}"_

⏰ *Ação Necessária!*
Aprove ou edite a resposta antes do envio ao cliente.`

    const bodyData: any = {
      recipient: process.env['ZAPSTER_GROUP_ID'] || "group:120363420949294702",
      text: message,
      instance_id: process.env['ZAPSTER_INSTANCE_ID'] || "21iwlxlswck0m95497nzl",
      buttons: [
        {
          label: "✅ Aprovar e Enviar",
          type: "url",
          url: approveDirectUrl
        },
        {
          label: "✏️ Editar Resposta",
          type: "url",
          url: approvalUrl
        }
      ],
      buttons_mode: "interactive"
    }

    if (productInfo?.thumbnail) {
      bodyData.media = {
        url: productInfo.thumbnail,
        caption: productInfo.title
      }
    }

    const response = await fetch("https://api.zapsterapi.com/v1/wa/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env['ZAPSTER_API_TOKEN']}`,
        "Content-Type": "application/json",
        "X-Instance-ID": process.env['ZAPSTER_INSTANCE_ID'] || "21iwlxlswck0m95497nzl"
      },
      body: JSON.stringify(bodyData),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error("WhatsApp API error:", { error })
      return false
    }

    logger.info("Question notification sent to WhatsApp")
    return true
  } catch (error) {
    logger.error("Error sending question notification:", { error })
    return false
  }
}

export async function sendDailyReport(metrics: any): Promise<boolean> {
  try {
    const message = `📊 *RELATÓRIO DIÁRIO - AGENTE IA*

📅 Data: ${new Date().toLocaleDateString("pt-BR")}

📈 *MÉTRICAS DO DIA:*
• Total de Perguntas: ${metrics.totalQuestions}
• Respondidas: ${metrics.answered} (${metrics.answerRate}%)
• Tempo Médio: ${metrics.avgResponseTime}s
• Taxa de Aprovação: ${metrics.approvalRate}%

💰 *IMPACTO NAS VENDAS:*
• Taxa de Conversão: ${metrics.conversionRate}%
• Aumento vs Manual: +${metrics.improvement}%

🏆 *TOP PRODUTOS:*
${metrics.topProducts.map((p: any, i: number) => 
  `${i + 1}. ${p.title} (${p.questions} perguntas)`
).join("\n")}

⚡ *PERFORMANCE:*
• Uptime: ${metrics.uptime}%
• Erros: ${metrics.errors}

---
_Sistema de IA - Atendimento Automatizado ML_`

    const response = await fetch("https://api.zapsterapi.com/v1/wa/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env['ZAPSTER_API_TOKEN']}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: process.env['ZAPSTER_GROUP_ID'] || "group:120363420949294702",
        text: message,
        instance_id: process.env['ZAPSTER_INSTANCE_ID'] || "21iwlxlswck0m95497nzl",
      }),
    })

    return response.ok
  } catch (error) {
    logger.error("Error sending daily report:", { error })
    return false
  }
}
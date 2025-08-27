interface QuestionNotification {
  questionId: string
  sequentialId: number
  mlQuestionId: string
  question: string
  aiResponse: string
  productTitle: string
  productPrice: number
  productImage?: string
  approvalUrl: string
}

interface RevisionNotification {
  questionId: string
  sequentialId: number
  productTitle: string
  originalResponse: string
  revisedResponse: string
  approvalUrl: string
}

interface ApprovalConfirmation {
  sequentialId: number
  questionText: string
  finalAnswer: string
  productTitle: string
  approved: boolean
}

export async function sendQuestionNotification(data: QuestionNotification): Promise<boolean> {
  try {
    // Format the message with sequential ID
    const messageText = `🔔 *PERGUNTA #${data.sequentialId}*

📦 *Produto:* ${data.productTitle}

👤 *Cliente perguntou:*
_"${data.question}"_

🔗 *Link de Aprovação:*
${data.approvalUrl}

━━━━━━━━━━━━━━━━━━━
_Clique no link acima para visualizar e responder a pergunta_`

    const payload = {
      recipient: process.env.ZAPSTER_GROUP_ID || "group:120363420949294702",
      text: messageText
    }

    // Add product image if available
    if (data.productImage) {
      (payload as any).media = {
        url: data.productImage,
        caption: messageText
      }
      delete (payload as any).text
    }

    console.log("📤 Sending WhatsApp notification for question #" + data.sequentialId)

    const response = await fetch("https://api.zapsterapi.com/v1/wa/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.ZAPSTER_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-Instance-ID": process.env.ZAPSTER_INSTANCE_ID || "21iwlxlswck0m95497nzl"
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("WhatsApp API error:", errorText)
      return false
    }

    console.log("✅ WhatsApp notification sent for question #" + data.sequentialId)
    return true
  } catch (error) {
    console.error("WhatsApp notification error:", error)
    return false
  }
}

export async function sendRevisionNotification(data: RevisionNotification): Promise<boolean> {
  try {
    const messageText = `✏️ *REVISÃO SOLICITADA - PERGUNTA #${data.sequentialId}*

📦 *Produto:* ${data.productTitle}

❌ *Resposta original:*
_"${data.originalResponse}"_

✅ *Resposta revisada pelo ML Agent:*
_"${data.revisedResponse}"_

🔗 *Link para aprovar revisão:*
${data.approvalUrl}

━━━━━━━━━━━━━━━━━━━
_Clique no link para aprovar a nova resposta_`

    const payload = {
      recipient: process.env.ZAPSTER_GROUP_ID || "group:120363420949294702",
      text: messageText
    }

    const response = await fetch("https://api.zapsterapi.com/v1/wa/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.ZAPSTER_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-Instance-ID": process.env.ZAPSTER_INSTANCE_ID || "21iwlxlswck0m95497nzl"
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("WhatsApp API error:", errorText)
      return false
    }

    return true
  } catch (error) {
    console.error("WhatsApp revision notification error:", error)
    return false
  }
}

export async function sendApprovalConfirmation(data: ApprovalConfirmation): Promise<boolean> {
  try {
    const emoji = data.approved ? "✅" : "✏️"
    const action = data.approved ? "APROVADA" : "EM REVISÃO"
    
    const message = `${emoji} *PERGUNTA #${data.sequentialId} - ${action}*

📦 *Produto:* ${data.productTitle}

👤 *Pergunta:*
_"${data.questionText}"_

💬 *Resposta ${data.approved ? "enviada" : "em revisão"}:*
_"${data.finalAnswer}"_

${data.approved ? "✅ Resposta publicada no Mercado Livre!" : "⏳ Aguardando nova resposta do ML Agent..."}`

    const response = await fetch("https://api.zapsterapi.com/v1/wa/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.ZAPSTER_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-Instance-ID": process.env.ZAPSTER_INSTANCE_ID || "21iwlxlswck0m95497nzl"
      },
      body: JSON.stringify({
        recipient: process.env.ZAPSTER_GROUP_ID || "group:120363420949294702",
        text: message
      })
    })

    return response.ok
  } catch (error) {
    console.error("WhatsApp confirmation error:", error)
    return false
  }
}
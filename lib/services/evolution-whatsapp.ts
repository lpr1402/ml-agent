/**
 * Evolution API Integration for WhatsApp Notifications
 * Production-ready implementation with retry logic
 * Self-hosted WhatsApp API running on evolution.axnexlabs.com.br
 */

import { logger } from '@/lib/logger'

interface EvolutionMessage {
  number: string // Recipient: phone number or group JID
  text: string
  delay?: number
  linkPreview?: boolean
  mentioned?: string[]
}

interface EvolutionButton {
  type: 'reply' | 'copy' | 'url' | 'call' | 'pix'
  displayText: string
  id?: string
  url?: string
  copyCode?: string
  phoneNumber?: string
}

interface EvolutionButtonMessage {
  number: string // Recipient: phone number or group JID
  title?: string
  description?: string
  footer?: string
  buttons: EvolutionButton[]
  delay?: number
}

interface QuestionNotification {
  sequentialId: number | string // Pode ser número ou string (formato XX/DDMM)
  questionText: string
  productTitle: string
  productPrice?: number
  productImage?: string
  suggestedAnswer: string
  approvalUrl: string
  customerName?: string
  sellerName: string // Nome do vendedor/conta ML
  organizationName?: string
  questionId?: string // ID da pergunta para gerar token
  mlAccountId?: string // ID da conta ML
  organizationId?: string // ID da organização
}

interface ApprovalConfirmation {
  sequentialId: number | string // Pode ser número ou string (formato XX/DDMM)
  questionText: string
  finalAnswer: string
  productTitle: string
  sellerName: string // Nome do vendedor/conta ML
  approved: boolean
}

class EvolutionWhatsAppService {
  private apiUrl: string
  private apiKey: string
  private instanceName: string
  private groupId: string

  constructor() {
    // Evolution API Configuration
    this.apiUrl = process.env['EVOLUTION_API_URL'] || 'https://evolution.axnexlabs.com.br'
    this.apiKey = process.env['EVOLUTION_API_KEY'] || '26746A818E00-41E3-AA49-C97770C00E0A'
    this.instanceName = process.env['EVOLUTION_INSTANCE_NAME'] || 'AxnexLabs'
    // Formato Evolution API para grupos: ID@g.us
    this.groupId = process.env['EVOLUTION_GROUP_ID'] || '120363420949294702@g.us'

    if (!this.apiUrl || !this.apiKey || !this.instanceName) {
      logger.error('[Evolution] Missing required configuration', {
        hasApiUrl: !!this.apiUrl,
        hasApiKey: !!this.apiKey,
        hasInstanceName: !!this.instanceName,
        hasGroupId: !!this.groupId
      })
    } else {
      logger.info('[Evolution] Service initialized successfully', {
        apiUrl: this.apiUrl,
        instanceName: this.instanceName,
        groupId: this.groupId,
        apiKeyPrefix: this.apiKey.substring(0, 20) + '...'
      })
    }
  }

  /**
   * Send message via Evolution API with retry logic
   */
  private async sendMessage(message: EvolutionMessage, retries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const endpoint = `${this.apiUrl}/message/sendText/${this.instanceName}`

        logger.debug(`[Evolution] Sending message attempt ${attempt}/${retries}`, {
          endpoint,
          recipient: message.number,
          textLength: message.text.length,
          apiKeyPrefix: this.apiKey.substring(0, 20) + '...'
        })

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            number: message.number,
            text: message.text,
            delay: message.delay || 0,
            linkPreview: message.linkPreview !== undefined ? message.linkPreview : true,
            ...(message.mentioned && { mentioned: message.mentioned })
          })
        })

        if (response.ok || response.status === 201) {
          const data = await response.json()
          logger.info('[Evolution] ✅ Message sent successfully', {
            messageId: data.key?.id,
            recipient: message.number,
            status: response.status,
            messageStatus: data.status
          })
          return true
        }

        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }

        logger.error(`[Evolution] ❌ Failed attempt ${attempt}/${retries}`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          recipient: message.number
        })

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      } catch (error) {
        logger.error(`[Evolution] Network error attempt ${attempt}/${retries}`, { error })
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      }
    }

    return false
  }

  /**
   * Send message with buttons via Evolution API with retry logic
   * DISABLED: Usando mensagem com link direto
   */
  // @ts-expect-error - Função mantida para referência futura
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async sendMessageWithButtons(message: EvolutionButtonMessage, retries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const endpoint = `${this.apiUrl}/message/sendButtons/${this.instanceName}`

        logger.debug(`[Evolution] Sending button message attempt ${attempt}/${retries}`, {
          endpoint,
          recipient: message.number,
          buttonCount: message.buttons.length,
          apiKeyPrefix: this.apiKey.substring(0, 20) + '...'
        })

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            number: message.number,
            title: message.title,
            description: message.description,
            footer: message.footer,
            buttons: message.buttons,
            delay: message.delay || 0
          })
        })

        if (response.ok || response.status === 201) {
          const data = await response.json()
          logger.info('[Evolution] ✅ Button message sent successfully', {
            messageId: data.key?.id,
            recipient: message.number,
            status: response.status,
            messageStatus: data.status,
            buttonCount: message.buttons.length
          })
          return true
        }

        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }

        logger.error(`[Evolution] ❌ Failed button message attempt ${attempt}/${retries}`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          recipient: message.number
        })

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      } catch (error) {
        logger.error(`[Evolution] Network error on button message attempt ${attempt}/${retries}`, { error })
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      }
    }

    return false
  }

  /**
   * Send new question notification to WhatsApp group
   */
  async sendQuestionNotification(data: QuestionNotification): Promise<boolean> {
    try {
      // 🎯 iOS Deep Linking: Link que abre PWA (se instalado) ou site, direto na pergunta
      const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'

      // URL personalizada: vai SEMPRE para /agente com a pergunta específica
      // Se approvalUrl foi passado (do N8N), usar ele; senão, construir URL direta
      const directLink = data.approvalUrl || (data.questionId
        ? `${baseUrl}/agente?questionId=${data.questionId}&source=whatsapp&utm_medium=notification`
        : `${baseUrl}/agente?source=whatsapp&utm_medium=notification`)

      // Usar o ID sequencial já salvo no banco (NUNCA gerar novo)
      const sequentialId = String(data.sequentialId || '00/0000')

      // Mensagem completa COM link direto (sem botões)
      const messageText = `*🔔 NOVA PERGUNTA - ${sequentialId}*
*Conta:* ${data.sellerName}

*Pergunta do Cliente:*
_${data.questionText}_

*Produto:* ${data.productTitle}
${data.productPrice ? `*Preço:* R$ ${data.productPrice.toFixed(2).replace('.', ',')}` : ''}

🚀 *Responder Agora:*
${directLink}`

      // Evolution API: Enviar mensagem simples com link preview
      return await this.sendMessage({
        number: this.groupId,
        text: messageText,
        linkPreview: true
      })

    } catch (error) {
      logger.error('[Evolution] Error sending question notification', { error })
      return false
    }
  }

  /**
   * Send approval confirmation to WhatsApp group
   */
  async sendApprovalConfirmation(data: ApprovalConfirmation): Promise<boolean> {
    try {
      // Usar o ID sequencial já salvo no banco (NUNCA gerar novo)
      const sequentialId = String(data.sequentialId || '00/0000')

      const message = `✅ *RESPOSTA ENVIADA - ${sequentialId}*
*Conta:* ${data.sellerName}

_Confirmado: Resposta entregue ao cliente no Mercado Livre_`

      return await this.sendMessage({
        number: this.groupId,
        text: message
      })

    } catch (error) {
      logger.error('[Evolution] Error sending approval confirmation', { error })
      return false
    }
  }

  /**
   * Send error notification to WhatsApp group
   */
  async sendErrorNotification(
    questionId: number,
    error: string,
    retryUrl?: string
  ): Promise<boolean> {
    try {
      let message = `⚠️ *ERRO NA PERGUNTA #${questionId}*

❌ *Erro:* ${error}`

      if (retryUrl) {
        message += `\n\n🔄 *Reprocessar:*\n${retryUrl}`
      }

      message += '\n\n_Por favor, verifique manualmente no Mercado Livre._'

      return await this.sendMessage({
        number: this.groupId,
        text: message
      })

    } catch (error) {
      logger.error('[Evolution] Error sending error notification', { error })
      return false
    }
  }

  /**
   * Send daily metrics summary to WhatsApp group
   */
  async sendDailyMetrics(metrics: {
    totalQuestions: number
    answeredQuestions: number
    responseTime: string
    approvalRate: number
  }): Promise<boolean> {
    try {
      const message = `📊 *RESUMO DIÁRIO - ML AGENT*

📈 *Métricas de Hoje:*
• Total de Perguntas: ${metrics.totalQuestions}
• Perguntas Respondidas: ${metrics.answeredQuestions}
• Tempo Médio de Resposta: ${metrics.responseTime}
• Taxa de Aprovação Automática: ${metrics.approvalRate}%

💪 Continue o excelente trabalho!`

      return await this.sendMessage({
        number: this.groupId,
        text: message
      })

    } catch (error) {
      logger.error('[Evolution] Error sending daily metrics', { error })
      return false
    }
  }

  /**
   * Test connection to Evolution API
   */
  async testConnection(): Promise<boolean> {
    try {
      const testMessage = `🔧 *TESTE DE CONEXÃO*

✅ Evolution API conectada com sucesso!
🤖 ML Agent está pronto para enviar notificações.

_Mensagem de teste enviada em ${new Date().toLocaleString('pt-BR')}_`

      return await this.sendMessage({
        number: this.groupId,
        text: testMessage
      })

    } catch (error) {
      logger.error('[Evolution] Connection test failed', { error })
      return false
    }
  }
}

// Export singleton instance
export const evolutionWhatsAppService = new EvolutionWhatsAppService()

// Generic WhatsApp notification function
export const sendWhatsAppNotification = async (data: {
  to?: string
  message: string
  imageUrl?: string
}): Promise<boolean> => {
  try {
    const instanceName = process.env['EVOLUTION_INSTANCE_NAME'] || 'AxnexLabs'
    const apiKey = process.env['EVOLUTION_API_KEY'] || 'Ev0lut10n@AxnexLabs2025!'
    const recipient = data.to || process.env['EVOLUTION_GROUP_ID'] || '120363420949294702@g.us'
    const apiUrl = process.env['EVOLUTION_API_URL'] || 'https://evolution.axnexlabs.com.br'

    if (!apiKey) {
      logger.error('[Evolution] Missing API key for WhatsApp notification')
      return false
    }

    const endpoint = `${apiUrl}/message/sendText/${instanceName}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: recipient,
        text: data.message,
        linkPreview: true
      })
    })

    const responseText = await response.text()

    if (!response.ok && response.status !== 201) {
      logger.error('[Evolution] Failed to send WhatsApp notification', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText
      })
      return false
    }

    logger.info('[Evolution] WhatsApp notification sent successfully', {
      recipient,
      messageLength: data.message.length
    })
    return true
  } catch (error) {
    logger.error('[Evolution] Error sending WhatsApp notification', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    return false
  }
}

// Export functions for backward compatibility
export const sendQuestionNotification = (data: QuestionNotification) =>
  evolutionWhatsAppService.sendQuestionNotification(data)

export const sendApprovalConfirmation = (data: ApprovalConfirmation) =>
  evolutionWhatsAppService.sendApprovalConfirmation(data)

export const sendErrorNotification = (questionId: number, error: string, retryUrl?: string) =>
  evolutionWhatsAppService.sendErrorNotification(questionId, error, retryUrl)

export const sendDailyMetrics = (metrics: any) =>
  evolutionWhatsAppService.sendDailyMetrics(metrics)

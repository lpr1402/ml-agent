/**
 * Zapster API Integration for WhatsApp Notifications
 * Production-ready implementation with retry logic
 */

import { logger } from '@/lib/logger'

interface ZapsterMessage {
  recipient: string
  text: string
  instance_id: string
  buttons?: Array<{
    id: string
    text: string
  }>
  footer?: string
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

class ZapsterWhatsAppService {
  private apiUrl: string
  private token: string
  private instanceId: string
  private groupId: string
  
  constructor() {
    this.apiUrl = process.env['ZAPSTER_API_URL'] || 'https://api.zapsterapi.com/v1/wa/messages'
    // Remove 'Bearer ' prefix if it exists in env var
    const tokenFromEnv = process.env['ZAPSTER_API_TOKEN'] || ''
    this.token = tokenFromEnv.replace(/^Bearer\s+/i, '')
    this.instanceId = process.env['ZAPSTER_INSTANCE_ID'] || '21iwlxlswck0m95497nzl'
    this.groupId = process.env['ZAPSTER_GROUP_ID'] || 'group:120363420949294702'

    if (!this.apiUrl || !this.token || !this.instanceId) {
      logger.error('[Zapster] Missing required configuration', {
        hasApiUrl: !!this.apiUrl,
        hasToken: !!this.token,
        hasInstanceId: !!this.instanceId,
        hasGroupId: !!this.groupId
      })
    } else {
      logger.info('[Zapster] Service initialized successfully', {
        apiUrl: this.apiUrl,
        instanceId: this.instanceId,
        groupId: this.groupId,
        tokenPrefix: this.token.substring(0, 20) + '...'
      })
    }
  }
  
  /**
   * Send message via Zapster API with retry logic
   */
  private async sendMessage(message: ZapsterMessage, retries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Sempre adicionar Bearer ao token (já removemos no constructor se veio duplicado)
        const authHeader = `Bearer ${this.token}`

        logger.debug(`[Zapster] Sending message attempt ${attempt}/${retries}`, {
          recipient: message.recipient,
          instanceId: message.instance_id,
          textLength: message.text.length,
          authHeaderPreview: authHeader.substring(0, 50) + '...'
        })

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        })
        
        if (response.ok) {
          const data = await response.json()
          logger.info('[Zapster] ✅ Message sent successfully', {
            messageId: data.id,
            recipient: message.recipient,
            status: response.status
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

        logger.error(`[Zapster] ❌ Failed attempt ${attempt}/${retries}`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          recipient: message.recipient
        })
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      } catch (error) {
        logger.error(`[Zapster] Network error attempt ${attempt}/${retries}`, { error })
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
      // 🎯 iOS Deep Linking: Link com query param para garantir abertura no PWA
      const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'
      const directLink = `${baseUrl}/agente?source=whatsapp&utm_medium=notification`

      // Usar o ID sequencial já salvo no banco (NUNCA gerar novo)
      const sequentialId = String(data.sequentialId || '00/0000')

      const message = `*PERGUNTA - ${sequentialId}*
*Conta:* ${data.sellerName}

*Pergunta do Cliente:*
_${data.questionText}_

*Produto:* ${data.productTitle}
${data.productPrice ? `*Preço:* R$ ${data.productPrice.toFixed(2).replace('.', ',')}` : ''}

*📱 Abrir ML Agent:*
${directLink}

_💡 Clique no link para abrir direto no app e responder todas as perguntas pendentes_`

      // Se tiver imagem do produto, enviar com a imagem
      if (data.productImage) {
        // Fazer download da imagem e converter para base64
        try {
          logger.info('[Zapster] Downloading product image', { url: data.productImage })
          const imageResponse = await fetch(data.productImage)

          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer()
            const base64Image = Buffer.from(imageBuffer).toString('base64')

            // Sempre adicionar Bearer ao token (já removemos no constructor se veio duplicado)
            const authHeader = `Bearer ${this.token}`

            // Preparar payload com imagem
            const payload = {
              recipient: this.groupId,
              text: message,
              instance_id: this.instanceId,
              'media.base64': base64Image
            }

            logger.debug('[Zapster] Sending message with image', {
              recipient: this.groupId,
              hasImage: true,
              imageSize: base64Image.length
            })

            // Enviar com imagem
            const response = await fetch(this.apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            })

            if (response.ok) {
              const data = await response.json()
              logger.info('[Zapster] ✅ Message with image sent successfully', {
                messageId: data.id,
                recipient: this.groupId
              })
              return true
            } else {
              const errorText = await response.text()
              logger.warn('[Zapster] Failed to send with image, will try text only', {
                status: response.status,
                error: errorText
              })
            }
          } else {
            logger.warn('[Zapster] Failed to download image, sending text only', {
              status: imageResponse.status
            })
          }
        } catch (err) {
          logger.warn('[Zapster] Error processing image, sending text only', { error: err })
        }
      }

      // Enviar sem imagem (fallback)
      return await this.sendMessage({
        recipient: this.groupId,
        text: message,
        instance_id: this.instanceId
      })
      
    } catch (error) {
      logger.error('[Zapster] Error sending question notification', { error })
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
        recipient: this.groupId,
        text: message,
        instance_id: this.instanceId
      })
      
    } catch (error) {
      logger.error('[Zapster] Error sending approval confirmation', { error })
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
        recipient: this.groupId,
        text: message,
        instance_id: this.instanceId
      })
      
    } catch (error) {
      logger.error('[Zapster] Error sending error notification', { error })
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
        recipient: this.groupId,
        text: message,
        instance_id: this.instanceId
      })
      
    } catch (error) {
      logger.error('[Zapster] Error sending daily metrics', { error })
      return false
    }
  }
  
  /**
   * Test connection to Zapster API
   */
  async testConnection(): Promise<boolean> {
    try {
      const testMessage = `🔧 *TESTE DE CONEXÃO*

✅ Zapster API conectada com sucesso!
🤖 ML Agent está pronto para enviar notificações.

_Mensagem de teste enviada em ${new Date().toLocaleString('pt-BR')}_`

      return await this.sendMessage({
        recipient: this.groupId,
        text: testMessage,
        instance_id: this.instanceId
      })
      
    } catch (error) {
      logger.error('[Zapster] Connection test failed', { error })
      return false
    }
  }
}

// Export singleton instance
export const zapsterService = new ZapsterWhatsAppService()

// Generic WhatsApp notification function
export const sendWhatsAppNotification = async (data: {
  to?: string
  message: string
  imageUrl?: string
}): Promise<boolean> => {
  try {
    const instance = process.env['ZAPSTER_INSTANCE_ID'] || '21iwlxlswck0m95497nzl'
    const tokenFromEnv = process.env['ZAPSTER_API_TOKEN'] || ''
    const token = tokenFromEnv.replace(/^Bearer\s+/i, '')
    const recipient = data.to || process.env['ZAPSTER_GROUP_ID'] || 'group:120363420949294702'
    const apiUrl = process.env['ZAPSTER_API_URL'] || 'https://api.zapsterapi.com/v1/wa/messages'

    if (!token) {
      logger.error('[Zapster] Missing API token for WhatsApp notification')
      return false
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        instance_id: instance,
        recipient: recipient,
        text: data.message
      })
    })

    const responseText = await response.text()

    if (!response.ok) {
      logger.error('[Zapster] Failed to send WhatsApp notification', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText
      })
      return false
    }

    logger.info('[Zapster] WhatsApp notification sent successfully', {
      recipient,
      messageLength: data.message.length
    })
    return true
  } catch (error) {
    logger.error('[Zapster] Error sending WhatsApp notification', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    return false
  }
}

// Export functions for backward compatibility
export const sendQuestionNotification = (data: QuestionNotification) =>
  zapsterService.sendQuestionNotification(data)

export const sendApprovalConfirmation = (data: ApprovalConfirmation) =>
  zapsterService.sendApprovalConfirmation(data)

export const sendErrorNotification = (questionId: number, error: string, retryUrl?: string) =>
  zapsterService.sendErrorNotification(questionId, error, retryUrl)

export const sendDailyMetrics = (metrics: any) =>
  zapsterService.sendDailyMetrics(metrics)
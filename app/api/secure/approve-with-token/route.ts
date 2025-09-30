/**
 * Endpoint SEGURO de aprovação com token único
 * Garante que apenas links válidos podem aprovar perguntas
 * Multi-tenant com isolamento total
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { approvalTokenService } from '@/lib/services/approval-token-service'
import { getValidMLToken } from '@/lib/ml-api/token-manager'
import { sanitizeAnswerText } from '@/lib/security/input-validator'
import { zapsterService } from '@/lib/services/zapster-whatsapp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, action, response: userResponse, feedback } = body
    
    // 1. VALIDAÇÃO DO TOKEN (crítico para segurança)
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
    }
    
    const validation = await approvalTokenService.validateToken(token)
    
    if (!validation.valid) {
      logger.warn('[SecureApprove] Invalid token attempt', { 
        token: token.substring(0, 8),
        error: validation.error 
      })
      return NextResponse.json({ 
        error: validation.error || 'Token inválido' 
      }, { status: 403 })
    }
    
    // 2. EXTRAIR DADOS VALIDADOS DO TOKEN
    const { question, mlAccount, organization } = validation
    
    logger.info('[SecureApprove] Processing approval', {
      questionId: question.id,
      mlAccountId: mlAccount.id,
      organizationId: organization.id,
      action
    })
    
    // 3. PROCESSAR AÇÃO
    if (action === 'approve') {
      // Validar e sanitizar resposta
      const finalResponse = userResponse || question.aiSuggestion
      
      if (!finalResponse) {
        return NextResponse.json({ 
          error: 'Nenhuma resposta disponível' 
        }, { status: 400 })
      }
      
      const sanitizedResponse = sanitizeAnswerText(finalResponse)
      
      if (sanitizedResponse.length > 2000) {
        return NextResponse.json({ 
          error: `Resposta muito longa: ${sanitizedResponse.length}/2000 caracteres` 
        }, { status: 400 })
      }
      
      // Obter token ML válido para a conta específica
      const accessToken = await getValidMLToken(mlAccount.id)
      
      if (!accessToken) {
        logger.error('[SecureApprove] No valid ML token', { 
          mlAccountId: mlAccount.id 
        })
        return NextResponse.json({ 
          error: 'Token ML expirado. Faça login novamente.' 
        }, { status: 401 })
      }
      
      // Enviar resposta ao Mercado Livre
      const mlResponse = await fetch('https://api.mercadolibre.com/answers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          question_id: question.mlQuestionId,
          text: sanitizedResponse
        })
      })
      
      const mlData = await mlResponse.json()
      
      if (!mlResponse.ok) {
        // Verificar se já foi respondida
        if (mlData.message?.includes('already answered') || 
            mlData.message?.includes('is not unanswered')) {
          logger.info('[SecureApprove] Question already answered on ML', {
            questionId: question.mlQuestionId
          })
        } else {
          logger.error('[SecureApprove] ML API error', {
            status: mlResponse.status,
            error: mlData
          })
          return NextResponse.json({ 
            error: 'Erro ao enviar para o Mercado Livre',
            details: mlData.message 
          }, { status: 500 })
        }
      }
      
      // Atualizar pergunta no banco
      await prisma.question.update({
        where: { id: question.id },
        data: {
          status: 'COMPLETED',
          answer: sanitizedResponse,
          answeredAt: new Date(),
          answeredBy: userResponse ? 'MANUAL' : 'AI_AUTO',
          approvalType: userResponse ? 'MANUAL' : 'QUICK',
          approvedAt: new Date(),
          sentToMLAt: new Date(),
          mlResponseCode: mlResponse.status,
          mlResponseData: mlData
        }
      })
      
      // MARCAR TOKEN COMO USADO (crítico!)
      await approvalTokenService.markAsUsed(token, 'APPROVED')
      
      // Invalidar outros tokens da mesma pergunta
      await approvalTokenService.invalidateQuestionTokens(question.id)
      
      // Enviar confirmação WhatsApp
      try {
        await zapsterService.sendApprovalConfirmation({
          sequentialId: parseInt(question.id.slice(-6), 16) || 0,
          questionText: question.text,
          finalAnswer: sanitizedResponse,
          productTitle: question.itemTitle || 'Produto',
          sellerName: mlAccount.nickname,
          approved: true
        })
      } catch (whatsappError) {
        logger.warn('[SecureApprove] WhatsApp notification failed', { 
          error: whatsappError 
        })
      }
      
      logger.info('[SecureApprove] Answer approved and sent to ML', {
        questionId: question.id,
        mlQuestionId: question.mlQuestionId
      })
      
      return NextResponse.json({
        success: true,
        message: 'Resposta enviada com sucesso ao Mercado Livre'
      })
      
    } else if (action === 'revise') {
      // Processar revisão
      if (!feedback && !userResponse) {
        return NextResponse.json({ 
          error: 'Feedback ou resposta editada obrigatória' 
        }, { status: 400 })
      }
      
      // Se tem resposta editada, salvar diretamente
      if (userResponse) {
        await prisma.question.update({
          where: { id: question.id },
          data: {
            aiSuggestion: sanitizeAnswerText(userResponse),
            status: 'AWAITING_APPROVAL'
          }
        })
        
        // Criar novo token para re-aprovação
        const newToken = await approvalTokenService.createToken({
          questionId: question.id,
          mlAccountId: mlAccount.id,
          organizationId: organization.id,
          expiresInHours: 24
        })
        
        const newApprovalUrl = approvalTokenService.generateApprovalUrl(newToken)
        
        logger.info('[SecureApprove] New approval URL generated for revision', { 
          url: newApprovalUrl,
          questionId: question.id 
        })
        
        // Enviar novo link via WhatsApp
        try {
          await zapsterService.sendApprovalConfirmation({
            sequentialId: parseInt(question.id.slice(-6), 16) || 0,
            questionText: question.text,
            finalAnswer: userResponse,
            productTitle: question.itemTitle || 'Produto',
            sellerName: mlAccount.nickname,
            approved: false
          })
        } catch (whatsappError) {
          logger.warn('[SecureApprove] WhatsApp revision notification failed', { 
            error: whatsappError 
          })
        }
      } else {
        // Enviar para N8N processar revisão com IA
        await prisma.question.update({
          where: { id: question.id },
          data: { status: 'REVISING' }
        })
        
        // Aqui você pode chamar N8N para processar a revisão
        // Por enquanto vou deixar comentado
        /*
        const n8nResponse = await fetch(process.env.N8N_REVISION_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.mlQuestionId,
            originalResponse: question.aiSuggestion,
            feedback,
            // ... outros dados
          })
        })
        */
      }
      
      // Marcar token como usado
      await approvalTokenService.markAsUsed(token, 'REVISED')
      
      // Criar registro de revisão
      await prisma.revision.create({
        data: {
          questionId: question.id,
          userFeedback: feedback || 'Editado manualmente',
          aiRevision: userResponse || ''
        }
      })
      
      return NextResponse.json({
        success: true,
        message: 'Revisão processada. Um novo link foi enviado.'
      })
      
    } else {
      return NextResponse.json({ 
        error: 'Ação inválida' 
      }, { status: 400 })
    }
    
  } catch (error) {
    logger.error('[SecureApprove] Unexpected error', { error })
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}

// GET - Validar token e retornar dados da pergunta
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json({ 
        error: 'Token obrigatório' 
      }, { status: 400 })
    }
    
    const validation = await approvalTokenService.validateToken(token)
    
    if (!validation.valid) {
      return NextResponse.json({ 
        error: validation.error || 'Token inválido',
        valid: false 
      }, { status: 403 })
    }
    
    const { question, mlAccount } = validation
    
    // Retornar dados da pergunta para exibição
    return NextResponse.json({
      valid: true,
      question: {
        id: question.id,
        text: question.text,
        aiSuggestion: question.aiSuggestion,
        itemTitle: question.itemTitle,
        itemPrice: question.itemPrice,
        itemPermalink: question.itemPermalink,
        status: question.status
      },
      seller: {
        nickname: mlAccount.nickname,
        mlUserId: mlAccount.mlUserId
      }
    })
    
  } catch (error) {
    logger.error('[SecureApprove] GET error', { error })
    return NextResponse.json({ 
      error: 'Erro ao validar token' 
    }, { status: 500 })
  }
}
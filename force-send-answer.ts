/**
 * Script para forçar envio de resposta ao Mercado Livre
 * Usa chamada direta à API do ML sem passar pela camada HTTP
 */

import { prisma } from './lib/prisma'
import { TokenManager } from './lib/ml-api/token-manager'
import { logger } from './lib/logger'

async function forceSendAnswer() {
  const questionId = 'cmggwd7ti0005csmcp97a5vgt'

  try {
    // 1. Buscar pergunta com dados da conta
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: true
      }
    })

    if (!question) {
      console.error('❌ Pergunta não encontrada')
      return
    }

    console.log('📝 Pergunta encontrada:')
    console.log('   Question ID:', question.mlQuestionId)
    console.log('   Item ID:', question.itemId)
    console.log('   Resposta:', question.answer || question.aiSuggestion)
    console.log('   Conta:', question.mlAccount.nickname)
    console.log('')

    // 2. Obter token válido
    console.log('🔐 Obtendo token...')
    const tokenManager = TokenManager.getInstance()
    const token = await tokenManager.getValidToken(question.mlAccount.id)

    if (!token) {
      console.error('❌ Não foi possível obter token válido')
      return
    }

    console.log('✅ Token obtido')
    console.log('')

    // 3. Enviar resposta ao ML
    console.log('📤 Enviando resposta ao Mercado Livre...')

    const answerText = question.answer || question.aiSuggestion
    if (!answerText) {
      console.error('❌ Sem resposta para enviar')
      return
    }

    const response = await fetch(
      `https://api.mercadolibre.com/answers?item_id=${question.itemId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          question_id: parseInt(question.mlQuestionId),
          text: answerText
        })
      }
    )

    const data = await response.json()

    console.log('📦 Resposta do ML:')
    console.log('   Status:', response.status)
    console.log('   Data:', JSON.stringify(data, null, 2))
    console.log('')

    if (response.ok && data.id) {
      // 4. Atualizar banco de dados
      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: 'RESPONDED',
          mlAnswerId: data.id.toString(),
          sentToMLAt: new Date(),
          mlResponseCode: response.status,
          mlResponseData: data,
          failureReason: null,
          failedAt: null
        }
      })

      console.log('✅ SUCESSO! Resposta enviada ao Mercado Livre')
      console.log('   ML Answer ID:', data.id)
      console.log('   Status atualizado para: RESPONDED')
    } else {
      // Erro
      const errorMsg = data.message || data.error || 'Erro desconhecido'

      await prisma.question.update({
        where: { id: questionId },
        data: {
          failureReason: errorMsg,
          failedAt: new Date(),
          mlResponseCode: response.status,
          mlResponseData: data
        }
      })

      console.log('❌ ERRO ao enviar resposta')
      console.log('   Mensagem:', errorMsg)
      console.log('   Status:', response.status)
    }

  } catch (error: any) {
    console.error('❌ Erro no processo:', error.message)
    logger.error('[Force Send] Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

forceSendAnswer()

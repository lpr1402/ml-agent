/**
 * Script simples para enviar resposta ao ML
 */

import { prisma } from './lib/prisma'
import { decryptToken } from './lib/security/encryption'

async function sendAnswer() {
  const questionId = 'cmggwd7ti0005csmcp97a5vgt'

  try {
    // Buscar pergunta + conta
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { mlAccount: true }
    })

    if (!question) {
      console.error('❌ Pergunta não encontrada')
      return
    }

    console.log('📝 Dados:')
    console.log('   Question:', question.mlQuestionId)
    console.log('   Item:', question.itemId)
    console.log('   Resposta:', question.answer || question.aiSuggestion)
    console.log('   Conta:', question.mlAccount.nickname)
    console.log('')

    // Decrypt token (o campo é um JSON string)
    const encryptedData = JSON.parse(question.mlAccount.encryptedAccessToken)
    const token = decryptToken(encryptedData)

    console.log('🔐 Token obtido (primeiros 20 chars):', token.substring(0, 20) + '...')
    console.log('')

    // Enviar ao ML
    console.log('📤 Enviando ao Mercado Livre...')

    const answerText = question.answer || question.aiSuggestion
    if (!answerText) {
      console.error('❌ Sem resposta')
      return
    }

    const url = `https://api.mercadolibre.com/answers?item_id=${question.itemId}`
    const payload = {
      question_id: parseInt(question.mlQuestionId),
      text: answerText
    }

    console.log('URL:', url)
    console.log('Payload:', JSON.stringify(payload, null, 2))
    console.log('')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    console.log('📦 Resposta ML (Status', response.status + '):')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    if (response.ok && data.id) {
      // Atualizar banco
      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: 'RESPONDED',
          mlAnswerId: data.id.toString(),
          sentToMLAt: new Date(),
          mlResponseCode: response.status,
          mlResponseData: data as any,
          failureReason: null,
          failedAt: null
        }
      })

      console.log('✅ SUCESSO!')
      console.log('   ML Answer ID:', data.id)
      console.log('   Status: RESPONDED')
    } else {
      const errorMsg = data.message || data.error || JSON.stringify(data)

      await prisma.question.update({
        where: { id: questionId },
        data: {
          failureReason: errorMsg,
          failedAt: new Date(),
          mlResponseCode: response.status,
          mlResponseData: data as any
        }
      })

      console.log('❌ ERRO')
      console.log('   Mensagem:', errorMsg)
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

sendAnswer()

/**
 * Enviar resposta ao ML usando tokens criptografados
 */

import { prisma } from './lib/prisma'
import { decryptToken } from './lib/security/encryption'

async function sendAnswer() {
  const questionId = 'cmggwd7ti0005csmcp97a5vgt'

  try {
    // Buscar pergunta + conta
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            id: true,
            nickname: true,
            mlUserId: true,
            siteId: true,
            accessToken: true,
            accessTokenIV: true,
            accessTokenTag: true,
            tokenExpiresAt: true
          }
        }
      }
    })

    if (!question) {
      console.error('❌ Pergunta não encontrada')
      return
    }

    console.log('📝 DADOS DA PERGUNTA:')
    console.log('═'.repeat(60))
    console.log('ID:', question.id)
    console.log('ML Question ID:', question.mlQuestionId)
    console.log('Item ID:', question.itemId)
    console.log('Resposta:', question.answer || question.aiSuggestion)
    console.log('Conta:', question.mlAccount.nickname)
    console.log('Status atual:', question.status)
    console.log('')

    // Verificar se tem token
    if (!question.mlAccount.accessToken || !question.mlAccount.accessTokenIV || !question.mlAccount.accessTokenTag) {
      console.error('❌ Conta sem token válido')
      return
    }

    // Verificar se token expirou
    if (question.mlAccount.tokenExpiresAt && question.mlAccount.tokenExpiresAt < new Date()) {
      console.error('❌ Token expirado em:', question.mlAccount.tokenExpiresAt.toISOString())
      return
    }

    console.log('🔐 Descriptografando token...')

    // Descriptografar token
    const token = decryptToken({
      encrypted: question.mlAccount.accessToken,
      iv: question.mlAccount.accessTokenIV,
      authTag: question.mlAccount.accessTokenTag
    })

    console.log('✅ Token obtido (primeiros 30 chars):', token.substring(0, 30) + '...')
    console.log('   Expira em:', question.mlAccount.tokenExpiresAt?.toISOString())
    console.log('')

    // Enviar ao ML
    console.log('📤 ENVIANDO RESPOSTA AO MERCADO LIVRE...')

    const answerText = question.answer || question.aiSuggestion
    if (!answerText) {
      console.error('❌ Sem resposta para enviar')
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

    console.log('📦 RESPOSTA DO MERCADO LIVRE:')
    console.log('═'.repeat(60))
    console.log('Status HTTP:', response.status)
    console.log('Dados:', JSON.stringify(data, null, 2))
    console.log('')

    if (response.ok && data.id) {
      // ✅ SUCESSO - Atualizar banco
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

      console.log('✅ ✅ ✅ SUCESSO! RESPOSTA ENVIADA AO MERCADO LIVRE ✅ ✅ ✅')
      console.log('')
      console.log('   ML Answer ID:', data.id)
      console.log('   Status atualizado:', 'RESPONDED')
      console.log('   Enviado em:', new Date().toISOString())
      console.log('')
      console.log('═'.repeat(60))
    } else {
      // ❌ ERRO - Salvar detalhes
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

      console.log('❌ ERRO AO ENVIAR RESPOSTA')
      console.log('   Status HTTP:', response.status)
      console.log('   Mensagem:', errorMsg)
      console.log('')
    }

  } catch (error: any) {
    console.error('❌ ERRO NO PROCESSO:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

sendAnswer()

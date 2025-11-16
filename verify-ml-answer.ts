/**
 * Verificar se a resposta está realmente no Mercado Livre
 */

import { prisma } from './lib/prisma'
import { decryptToken } from './lib/security/encryption'

async function verifyAnswer() {
  try {
    const account = await prisma.mLAccount.findFirst({
      where: { nickname: 'GS.ECOMMERCE' },
      select: {
        id: true,
        nickname: true,
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true
      }
    })

    if (!account || !account.accessToken) {
      console.error('❌ Conta ou token não encontrado')
      return
    }

    const token = decryptToken({
      encrypted: account.accessToken,
      iv: account.accessTokenIV!,
      authTag: account.accessTokenTag!
    })

    const questionId = '13441351958'
    const url = `https://api.mercadolibre.com/questions/${questionId}`

    console.log('🔍 Verificando pergunta no Mercado Livre...')
    console.log('   Question ID:', questionId)
    console.log('   URL:', url)
    console.log('')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })

    const data = await response.json()

    console.log('📦 DADOS DO MERCADO LIVRE:')
    console.log('═'.repeat(70))
    console.log(JSON.stringify(data, null, 2))
    console.log('═'.repeat(70))
    console.log('')

    if (data.answer) {
      console.log('✅ ✅ ✅ CONFIRMADO! Resposta está no Mercado Livre:')
      console.log('')
      console.log('   Pergunta:', data.text)
      console.log('   Resposta:', data.answer.text)
      console.log('   Status:', data.status)
      console.log('   Data resposta:', data.answer.date_created)
      console.log('   Status resposta:', data.answer.status)
      console.log('')
    } else {
      console.log('❌ Resposta não encontrada no ML')
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

verifyAnswer()

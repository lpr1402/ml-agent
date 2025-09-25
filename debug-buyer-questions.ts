import { PrismaClient } from '@prisma/client'
import { decryptToken } from './lib/security/encryption'

const prisma = new PrismaClient()

async function debugBuyerQuestions() {
  try {
    console.log('🔍 DEBUG: Verificando perguntas do comprador no sistema...\n')

    // 1. Buscar conta ELITESAUDEANIMAL
    const eliteAccount = await prisma.mLAccount.findFirst({
      where: {
        OR: [
          { nickname: { contains: 'ELITESAUDE' } },
          { mlUserId: '1377558007' }
        ],
        isActive: true
      },
      select: {
        id: true,
        mlUserId: true,
        nickname: true,
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true,
        organizationId: true
      }
    })

    if (!eliteAccount) {
      console.log('❌ Conta ELITESAUDEANIMAL não encontrada')
      await prisma.$disconnect()
      return
    }

    console.log('✅ Conta encontrada:')
    console.log(`   Nickname: ${eliteAccount.nickname}`)
    console.log(`   ML User ID: ${eliteAccount.mlUserId}`)
    console.log(`   Organization ID: ${eliteAccount.organizationId}\n`)

    // 2. Buscar TODAS as perguntas da conta no banco local
    const allQuestions = await prisma.question.findMany({
      where: {
        mlAccountId: eliteAccount.id
      },
      select: {
        id: true,
        mlQuestionId: true,
        customerId: true,
        text: true,
        answer: true,
        status: true,
        dateCreated: true,
        itemTitle: true
      },
      orderBy: { dateCreated: 'desc' },
      take: 20
    })

    console.log(`📊 Total de perguntas no banco local: ${allQuestions.length}\n`)

    // Agrupar por customerId
    const questionsByCustomer = allQuestions.reduce((acc: any, q) => {
      const custId = q.customerId || 'SEM_CUSTOMER_ID'
      if (!acc[custId]) acc[custId] = []
      acc[custId].push(q)
      return acc
    }, {})

    console.log('📝 Perguntas agrupadas por Customer ID:')
    for (const [customerId, questions] of Object.entries(questionsByCustomer)) {
      console.log(`\n   Customer ID: ${customerId} (${(questions as any).length} perguntas)`)
      for (const q of (questions as any).slice(0, 3)) {
        console.log(`      - ${q.text.substring(0, 50)}... (${q.status})`)
      }
    }

    // 3. Descriptografar token
    const token = decryptToken({
      encrypted: eliteAccount.accessToken,
      iv: eliteAccount.accessTokenIV!,
      authTag: eliteAccount.accessTokenTag!
    })

    if (!token) {
      console.log('❌ Falha ao descriptografar token')
      await prisma.$disconnect()
      return
    }

    console.log('\n✅ Token descriptografado\n')

    // 4. Para cada customerId único, buscar via API ML
    const uniqueCustomerIds = Object.keys(questionsByCustomer).filter(id => id !== 'SEM_CUSTOMER_ID')

    for (const customerId of uniqueCustomerIds.slice(0, 3)) { // Testar apenas os primeiros 3
      console.log(`\n🌐 Testando busca para Customer ID: ${customerId}`)

      const apiUrl = `https://api.mercadolibre.com/questions/search?seller_id=${eliteAccount.mlUserId}&from=${customerId}&api_version=4&limit=20&sort_fields=date_created&sort_types=DESC`

      console.log(`   URL: ${apiUrl}`)

      // Aguardar para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 1000))

      try {
        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`   ✅ Resposta da API:`)
          console.log(`      - Total: ${data.total || 0}`)
          console.log(`      - Retornadas: ${data.questions?.length || 0}`)

          if (data.questions && data.questions.length > 0) {
            console.log(`      - Primeira pergunta:`)
            console.log(`         ID: ${data.questions[0].id}`)
            console.log(`         From ID: ${data.questions[0].from?.id}`)
            console.log(`         Texto: ${data.questions[0].text?.substring(0, 50)}...`)

            // Verificar se from.id bate com customerId
            if (String(data.questions[0].from?.id) === customerId) {
              console.log(`         ✅ From.id CORRETO!`)
            } else {
              console.log(`         ❌ From.id NÃO BATE! (${data.questions[0].from?.id} !== ${customerId})`)
            }
          }
        } else {
          console.log(`   ❌ Erro: ${response.status} ${response.statusText}`)
          if (response.status === 429) {
            console.log(`      Rate limit atingido, aguardando...`)
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        }
      } catch (error) {
        console.log(`   ❌ Erro na requisição:`, error)
      }
    }

    // 5. Buscar TODAS as perguntas do vendedor (sem filtro de comprador)
    console.log('\n\n🔍 Buscando TODAS as perguntas do vendedor via API ML...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const allQuestionsUrl = `https://api.mercadolibre.com/questions/search?seller_id=${eliteAccount.mlUserId}&api_version=4&limit=50&sort_fields=date_created&sort_types=DESC`

    const allResponse = await fetch(allQuestionsUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (allResponse.ok) {
      const allData = await allResponse.json()
      console.log(`\n✅ Total de perguntas na API ML: ${allData.total || 0}`)
      console.log(`   Retornadas nesta chamada: ${allData.questions?.length || 0}`)

      if (allData.questions) {
        // Agrupar por from.id
        const byFromId = allData.questions.reduce((acc: any, q: any) => {
          const fromId = String(q.from?.id || 'SEM_FROM_ID')
          if (!acc[fromId]) acc[fromId] = 0
          acc[fromId]++
          return acc
        }, {})

        console.log('\n📊 Distribuição por comprador (from.id):')
        for (const [fromId, count] of Object.entries(byFromId).slice(0, 10)) {
          console.log(`   ${fromId}: ${count} perguntas`)

          // Verificar se esse ID está no nosso banco
          const existsInDB = uniqueCustomerIds.includes(fromId)
          if (existsInDB) {
            console.log(`      ✅ Este comprador está no banco local`)
          }
        }
      }
    } else {
      console.log(`❌ Erro ao buscar todas as perguntas: ${allResponse.status}`)
    }

    await prisma.$disconnect()
    console.log('\n\n✅ Debug concluído!')

  } catch (error) {
    console.error('❌ Erro durante debug:', error)
    await prisma.$disconnect()
  }
}

debugBuyerQuestions()
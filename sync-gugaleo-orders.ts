/**
 * SYNC GUGALEO ORDERS - Enterprise Grade
 * Busca Orders REAIS das 3 contas GUGALEO desde quarta-feira
 * Correlaciona com perguntas para identificar conversões
 */

import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'

async function syncGugaleoOrders() {
  console.log('\n🛒 SINCRONIZANDO ORDERS REAIS - ORGANIZAÇÃO GUGALEO\n')

  try {
    // 1. Buscar organização GUGALEO
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
          { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } }
        ]
      }
    })

    if (!org) {
      console.log('❌ Organização GUGALEO não encontrada')
      return
    }

    console.log('✅ Organização:', org.organizationName || org.primaryNickname)
    console.log('   ID:', org.id)
    console.log('')

    // 2. Buscar as 3 contas ML
    const accounts = await prisma.mLAccount.findMany({
      where: { organizationId: org.id, isActive: true },
      select: {
        id: true,
        nickname: true,
        siteId: true,
        mlUserId: true
      }
    })

    console.log(`📱 Contas ML encontradas: ${accounts.length}`)
    accounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.nickname} (${acc.siteId}) - User ID: ${acc.mlUserId}`)
    })
    console.log('')

    // 3. Data inicial: quarta-feira (3 de outubro)
    const dataInicial = new Date('2025-10-01T00:00:00.000-03:00')
    const dataFinal = new Date()

    console.log(`📅 Período de busca:`)
    console.log(`   De: ${dataInicial.toLocaleDateString('pt-BR')} ${dataInicial.toLocaleTimeString('pt-BR')}`)
    console.log(`   Até: ${dataFinal.toLocaleDateString('pt-BR')} ${dataFinal.toLocaleTimeString('pt-BR')}`)
    console.log('')

    let totalOrdersFound = 0
    let totalOrdersSaved = 0

    // 4. Buscar orders de cada conta
    for (const account of accounts) {
      console.log(`\n🔍 Buscando orders: ${account.nickname}...`)

      const token = await getValidMLToken(account.id)
      if (!token) {
        console.log(`   ❌ Token não disponível`)
        continue
      }

      try {
        // Buscar orders via API ML
        const dateFromFormatted = dataInicial.toISOString()
        const dateToFormatted = dataFinal.toISOString()

        const url = `https://api.mercadolibre.com/orders/search?seller=${account.mlUserId}&order.date_created.from=${dateFromFormatted}&order.date_created.to=${dateToFormatted}&sort=date_desc`

        console.log(`   API: GET /orders/search`)
        console.log(`   Seller: ${account.mlUserId}`)

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.log(`   ❌ Erro ${response.status}: ${await response.text()}`)
          continue
        }

        const data: any = await response.json()
        const orders = data.results || []

        console.log(`   ✅ Orders encontradas: ${orders.length}`)
        totalOrdersFound += orders.length

        // 5. Processar cada order
        for (const order of orders) {
          try {
            // Verificar se já existe no banco
            const exists = await prisma.order.findUnique({
              where: { mlOrderId: order.id.toString() }
            })

            if (exists) {
              console.log(`      ⏭️  Order ${order.id} já existe no banco`)
              continue
            }

            // Buscar detalhes completos da order
            const orderDetailUrl = `https://api.mercadolibre.com/orders/${order.id}`
            const orderDetailRes = await fetch(orderDetailUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })

            if (!orderDetailRes.ok) {
              console.log(`      ⚠️  Erro ao buscar detalhes da order ${order.id}`)
              continue
            }

            const orderDetail: any = await orderDetailRes.json()

            // Extrair informações
            const totalAmount = orderDetail.total_amount || 0
            const paidAmount = orderDetail.paid_amount || 0
            const currencyId = orderDetail.currency_id || 'BRL'
            const status = orderDetail.status
            const buyerId = orderDetail.buyer?.id?.toString() || 'unknown'
            const sellerId = orderDetail.seller?.id?.toString() || account.mlUserId

            // Salvar no banco (sem campo tags que não existe no schema)
            await prisma.order.create({
              data: {
                mlOrderId: order.id.toString(),
                mlAccountId: account.id,
                organizationId: org.id,
                sellerId,
                buyerId,
                totalAmount,
                paidAmount,
                currencyId,
                status,
                statusDetail: orderDetail.status_detail,
                orderItems: orderDetail.order_items || [],
                paymentMethod: orderDetail.payments?.[0]?.payment_method_id,
                paymentStatus: orderDetail.payments?.[0]?.status,
                shippingId: orderDetail.shipping?.id?.toString(),
                dateCreated: new Date(orderDetail.date_created),
                dateClosed: orderDetail.date_closed ? new Date(orderDetail.date_closed) : null,
                // packId removido - não existe no schema Prisma atual
                mlPayload: orderDetail // Salvar payload completo (inclui pack_id se existir)
              }
            })

            console.log(`      ✅ Order ${order.id} salva - R$ ${paidAmount.toFixed(2)} - Status: ${status}`)
            totalOrdersSaved++

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))

          } catch (orderError: any) {
            console.log(`      ❌ Erro ao processar order ${order.id}:`, orderError.message)
          }
        }

      } catch (error: any) {
        console.log(`   ❌ Erro ao buscar orders: ${error.message}`)
      }
    }

    console.log(`\n📊 RESULTADO FINAL:`)
    console.log(`   Orders encontradas: ${totalOrdersFound}`)
    console.log(`   Orders salvas no banco: ${totalOrdersSaved}`)
    console.log('')

    // 6. Buscar perguntas e tentar correlacionar
    console.log(`🔗 CORRELACIONANDO PERGUNTAS COM VENDAS...\n`)

    const allQuestions = await prisma.question.findMany({
      where: {
        mlAccountId: { in: accounts.map(a => a.id) },
        createdAt: { gte: dataInicial }
      },
      select: {
        id: true,
        itemId: true,
        customerId: true,
        mlAccountId: true,
        createdAt: true,
        answeredAt: true
      }
    })

    const allOrders = await prisma.order.findMany({
      where: {
        mlAccountId: { in: accounts.map(a => a.id) },
        dateCreated: { gte: dataInicial }
      }
    })

    console.log(`   Perguntas no período: ${allQuestions.length}`)
    console.log(`   Orders no período: ${allOrders.length}`)
    console.log('')

    let conversionsCreated = 0

    // Correlacionar: mesma conta + mesmo comprador + item da pergunta na order
    for (const question of allQuestions) {
      if (!question.customerId || !question.answeredAt) continue

      // Buscar orders do mesmo comprador na mesma conta
      const matchingOrders = allOrders.filter(order =>
        order.mlAccountId === question.mlAccountId &&
        order.buyerId === question.customerId &&
        order.dateCreated >= question.createdAt // Order após a pergunta
      )

      for (const order of matchingOrders) {
        // Verificar se algum item da order corresponde ao item da pergunta
        const orderItems: any[] = Array.isArray(order.orderItems) ? order.orderItems : []
        const hasMatchingItem = orderItems.some((item: any) =>
          item.item?.id === question.itemId
        )

        if (hasMatchingItem) {
          // Verificar se conversão já existe
          const existingConversion = await prisma.orderConversion.findUnique({
            where: {
              questionId_orderId: {
                questionId: question.id,
                orderId: order.id
              }
            }
          })

          if (!existingConversion) {
            const timeToConversion = Math.floor(
              (order.dateCreated.getTime() - question.createdAt.getTime()) / 1000 / 60
            ) // Minutos

            await prisma.orderConversion.create({
              data: {
                questionId: question.id,
                orderId: order.id,
                conversionValue: order.paidAmount || order.totalAmount,
                timeToConversion
              }
            })

            console.log(`   ✅ CONVERSÃO! Pergunta → Order ${order.mlOrderId}`)
            console.log(`      Item: ${question.itemId}`)
            console.log(`      Tempo: ${timeToConversion} minutos`)
            console.log(`      Valor: R$ ${(order.paidAmount || order.totalAmount).toFixed(2)}`)
            console.log('')

            conversionsCreated++
          }
        }
      }
    }

    console.log(`\n🎯 CONVERSÕES IDENTIFICADAS: ${conversionsCreated}`)
    console.log('')

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

syncGugaleoOrders()

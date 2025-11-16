/**
 * DIAGNÓSTICO DE ESTOQUE FULL - GUGALEO
 * Script para identificar por que apenas 20+ items aparecem ao invés de 39
 * Analisa TODOS os items ativos e identifica quais têm Full
 */

import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'

async function diagnoseFullStock() {
  console.log('\n🔍 DIAGNÓSTICO DE ESTOQUE FULL - GUGALEO\n')

  try {
    // 1. Buscar conta GUGALEO
    const gugaleoAccount = await prisma.mLAccount.findFirst({
      where: {
        OR: [
          { nickname: { contains: 'gugaleo', mode: 'insensitive' } },
          { nickname: { contains: 'guga', mode: 'insensitive' } }
        ],
        isActive: true
      },
      select: {
        id: true,
        nickname: true,
        mlUserId: true,
        siteId: true,
        organizationId: true
      }
    })

    if (!gugaleoAccount) {
      console.error('❌ Conta GUGALEO não encontrada!')
      return
    }

    console.log('✅ Conta encontrada:', gugaleoAccount.nickname)
    console.log('   User ID:', gugaleoAccount.mlUserId)
    console.log('   Site ID:', gugaleoAccount.siteId)
    console.log('')

    // 2. Obter token
    const token = await getValidMLToken(gugaleoAccount.id)
    if (!token) {
      console.error('❌ Token não disponível!')
      return
    }

    console.log('✅ Token obtido com sucesso\n')

    // 3. Buscar TODOS os items ativos
    console.log('📦 Buscando TODOS os items ativos...\n')

    let allItemIds: string[] = []
    let offset = 0
    const limit = 50

    while (true) {
      const url = `https://api.mercadolibre.com/users/${gugaleoAccount.mlUserId}/items/search?status=active&offset=${offset}&limit=${limit}`

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!res.ok) {
        console.error(`❌ Erro ao buscar items: ${res.status}`)
        break
      }

      const data: any = await res.json()

      if (!data.results || data.results.length === 0) {
        break
      }

      allItemIds.push(...data.results)

      console.log(`   Batch ${Math.floor(offset / limit) + 1}: ${data.results.length} items (total: ${allItemIds.length})`)

      if (offset + limit >= data.paging.total) {
        break
      }

      offset += limit
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`\n✅ Total de items ativos: ${allItemIds.length}\n`)

    // 4. Analisar cada item
    console.log('🔬 Analisando detalhes de cada item...\n')

    let fullPuroCount = 0
    let fullFlexCount = 0
    let flexOnlyCount = 0
    let otherCount = 0

    const fullItems: any[] = []

    for (let i = 0; i < allItemIds.length; i++) {
      const itemId = allItemIds[i]

      try {
        const itemUrl = `https://api.mercadolibre.com/items/${itemId}`
        const itemRes = await fetch(itemUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!itemRes.ok) {
          console.log(`   ⚠️  ${itemId}: Erro ${itemRes.status}`)
          continue
        }

        const item: any = await itemRes.json()

        // Analisar logística
        const logisticType = item.shipping?.logistic_type
        const hasInventoryId = !!item.inventory_id
        const hasUserProductId = !!item.user_product_id
        const tags = item.tags || []
        const selfServiceIn = tags.includes('self_service_in')

        let category = 'OTHER'
        let status = '❓'

        if (logisticType === 'fulfillment' && hasInventoryId) {
          category = 'FULL_PURO'
          status = '✅'
          fullPuroCount++
          fullItems.push({
            itemId,
            title: item.title,
            type: 'Full Puro',
            inventoryId: item.inventory_id,
            logisticType
          })
        } else if (selfServiceIn && hasInventoryId) {
          category = 'FULL_FLEX'
          status = '✅'
          fullFlexCount++
          fullItems.push({
            itemId,
            title: item.title,
            type: 'Full+Flex',
            inventoryId: item.inventory_id,
            userProductId: item.user_product_id,
            logisticType
          })
        } else if (hasUserProductId && !hasInventoryId) {
          category = 'USER_PRODUCT'
          status = '🟡'
          // Pode ter Full dentro, precisa verificar
          fullItems.push({
            itemId,
            title: item.title,
            type: 'User Product (verificar)',
            userProductId: item.user_product_id,
            logisticType
          })
        } else if (selfServiceIn) {
          category = 'FLEX_ONLY'
          status = '⚪'
          flexOnlyCount++
        } else {
          category = 'OTHER'
          status = '⚫'
          otherCount++
        }

        console.log(`   ${status} ${itemId}: ${category} | logistic=${logisticType} | inv=${hasInventoryId} | up=${hasUserProductId}`)

        // Rate limiting
        if (i % 20 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error: any) {
        console.log(`   ❌ ${itemId}: ${error.message}`)
      }
    }

    // 5. Resultado final
    console.log('\n📊 RESULTADO DA ANÁLISE:\n')
    console.log(`   Total de items ativos: ${allItemIds.length}`)
    console.log(`   ✅ Full Puro (inventory_id + fulfillment): ${fullPuroCount}`)
    console.log(`   ✅ Full+Flex (inventory_id + self_service_in): ${fullFlexCount}`)
    console.log(`   🟡 User Products (user_product_id): ${fullItems.filter(i => i.type.includes('User Product')).length}`)
    console.log(`   ⚪ Flex Only: ${flexOnlyCount}`)
    console.log(`   ⚫ Outros: ${otherCount}`)
    console.log(`\n   🎯 TOTAL ITEMS FULL: ${fullPuroCount + fullFlexCount}`)

    // 6. Comparar com banco
    const dbCount = await prisma.fullStockSnapshot.count({
      where: {
        mlAccountId: gugaleoAccount.id
      }
    })

    console.log(`\n   💾 Items no banco de dados: ${dbCount}`)
    console.log(`   📉 Diferença: ${(fullPuroCount + fullFlexCount) - dbCount} items faltando\n`)

    if (dbCount < (fullPuroCount + fullFlexCount)) {
      console.log('⚠️  PROBLEMA IDENTIFICADO: O banco tem menos items do que deveria!')
      console.log('   Possíveis causas:')
      console.log('   1. Sync não está pegando items com self_service_in')
      console.log('   2. Sync está filtrando apenas logistic_type=fulfillment')
      console.log('   3. Items User Product não estão sendo processados')
      console.log('')
    }

    // 7. Listar items Full encontrados
    console.log('📋 ITEMS FULL ENCONTRADOS:\n')
    fullItems.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.itemId}`)
      console.log(`      Título: ${item.title.substring(0, 60)}...`)
      console.log(`      Tipo: ${item.type}`)
      if (item.inventoryId) console.log(`      Inventory ID: ${item.inventoryId}`)
      if (item.userProductId) console.log(`      User Product ID: ${item.userProductId}`)
      console.log('')
    })

  } catch (error: any) {
    console.error('❌ Erro no diagnóstico:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
diagnoseFullStock()

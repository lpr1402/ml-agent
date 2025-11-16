/**
 * DIAGNÓSTICO DETALHADO - Quantos items FULL existem realmente?
 * Verifica item por item qual tem inventory_id (Full) ou não
 *
 * IMPORTANTE: Aguarde 1 hora se receber erro 429
 */

import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'

async function diagnoseFullItems() {
  console.log('🔍 DIAGNÓSTICO DETALHADO - ITEMS FULL')
  console.log('=' .repeat(70))

  // Buscar organização GUGALEO
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { username: { contains: 'gugaleo', mode: 'insensitive' } }
      ]
    },
    include: {
      mlAccounts: {
        where: { isActive: true }
      }
    }
  })

  if (!org) {
    console.log('❌ Organização não encontrada')
    process.exit(1)
  }

  console.log(`\n✅ Organização: ${org.organizationName}`)
  console.log(`📊 Contas ML: ${org.mlAccounts.length}\n`)

  let grandTotalItems = 0
  let grandTotalFull = 0
  let grandTotalNonFull = 0

  for (const account of org.mlAccounts) {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`🏪 CONTA: ${account.nickname} (${account.siteId})`)
    console.log(`${'='.repeat(70)}`)

    try {
      const token = await getValidMLToken(account.id)
      if (!token) {
        console.log('  ❌ Token inválido\n')
        continue
      }

      // Buscar TODOS os items ativos
      let allItemIds: string[] = []
      let offset = 0
      const limit = 50

      console.log('  🔄 Buscando items ativos...')

      while (true) {
        try {
          // IMPORTANTE: Aguardar 3 segundos entre chamadas
          if (offset > 0) {
            await new Promise(r => setTimeout(r, 3000))
          }

          const url = `https://api.mercadolibre.com/users/${account.mlUserId}/items/search?status=active&offset=${offset}&limit=${limit}`
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (res.status === 429) {
            console.log('  ⚠️ Rate limit atingido (429)')
            console.log('  ℹ️  Aguarde 1 hora e execute novamente')
            break
          }

          if (!res.ok) {
            console.log(`  ❌ Erro ${res.status}: ${await res.text()}`)
            break
          }

          const data = await res.json()

          if (!data.results || data.results.length === 0) {
            break
          }

          allItemIds.push(...data.results)
          console.log(`     - Buscou ${data.results.length} items (offset ${offset})`)

          if (offset + limit >= data.paging.total) {
            break
          }

          offset += limit
        } catch (error: any) {
          console.log(`  ❌ Erro ao buscar: ${error.message}`)
          break
        }
      }

      console.log(`  ✅ Total de items ativos: ${allItemIds.length}`)
      grandTotalItems += allItemIds.length

      // Buscar detalhes e verificar quais têm inventory_id
      console.log(`  🔍 Verificando quais são Full (têm inventory_id)...\n`)

      let fullCount = 0
      let nonFullCount = 0
      const fullItems: any[] = []
      const nonFullItems: string[] = []

      for (const itemId of allItemIds) {
        try {
          await new Promise(r => setTimeout(r, 3000)) // 3s entre chamadas

          const url = `https://api.mercadolibre.com/items/${itemId}`
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })

          if (res.status === 429) {
            console.log(`  ⚠️ Rate limit atingido ao verificar ${itemId}`)
            console.log(`  ℹ️  Use os dados dos snapshots já sincronizados`)
            break
          }

          if (!res.ok) {
            console.log(`  ⚠️ Erro ao buscar ${itemId}: ${res.status}`)
            continue
          }

          const item = await res.json()

          // Verificar se tem inventory_id
          if (item.inventory_id) {
            fullCount++
            fullItems.push({
              id: item.id,
              title: item.title.substring(0, 60),
              inventoryId: item.inventory_id
            })
            console.log(`  ✅ ${item.id} - FULL (${item.inventory_id})`)
          } else if (item.variations?.some((v: any) => v.inventory_id)) {
            const varsWithInv = item.variations.filter((v: any) => v.inventory_id)
            fullCount += varsWithInv.length
            varsWithInv.forEach((v: any) => {
              fullItems.push({
                id: item.id,
                variationId: v.id,
                title: item.title.substring(0, 60),
                inventoryId: v.inventory_id
              })
            })
            console.log(`  ✅ ${item.id} - FULL (${varsWithInv.length} variações)`)
          } else {
            nonFullCount++
            nonFullItems.push(item.id)
            console.log(`  ⚪ ${item.id} - NÃO Full (Flex/Coleta)`)
          }

        } catch (error: any) {
          console.log(`  ⚠️ Erro ao verificar ${itemId}: ${error.message}`)
        }
      }

      console.log(`\n  📊 RESULTADO DA CONTA:`)
      console.log(`     Total items: ${allItemIds.length}`)
      console.log(`     ✅ Full: ${fullCount}`)
      console.log(`     ⚪ Não Full: ${nonFullCount}`)

      grandTotalFull += fullCount
      grandTotalNonFull += nonFullCount

    } catch (error: any) {
      console.log(`  ❌ Erro na conta: ${error.message}`)
    }
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log('🎯 RESULTADO FINAL - TODAS AS CONTAS')
  console.log('='.repeat(70))
  console.log(`📦 Total de items ativos: ${grandTotalItems}`)
  console.log(`✅ Items Full (inventory_id): ${grandTotalFull}`)
  console.log(`⚪ Items Não Full (Flex/Coleta): ${grandTotalNonFull}`)
  console.log(`\n📊 Snapshots no banco: 25`)
  console.log(`${grandTotalFull === 25 ? '✅' : '⚠️'} ${grandTotalFull === 25 ? 'CORRETO!' : 'FALTAM ' + (grandTotalFull - 25)}`)

  if (grandTotalFull !== 39) {
    console.log(`\n⚠️  ATENÇÃO: Você mencionou 39 items Full, mas encontramos ${grandTotalFull}`)
    console.log(`   Possíveis razões:`)
    console.log(`   - Alguns items podem ser Flex ou Coleta (não Full)`)
    console.log(`   - Alguns items podem estar inativos`)
    console.log(`   - Alguns items podem ter sido removidos`)
  }

  await prisma.$disconnect()
}

diagnoseFullItems()

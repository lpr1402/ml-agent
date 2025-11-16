import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'

async function main() {
  const account = await prisma.mLAccount.findFirst({
    where: { nickname: 'GUGALEO COMÉRCIO' }
  })

  if (!account) throw new Error('Conta não encontrada')

  const token = await getValidMLToken(account.id)
  if (!token) throw new Error('Token não obtido')
  console.log('✅ Token obtido:', token.substring(0, 20) + '...')

  // Buscar items
  const searchUrl = `https://api.mercadolibre.com/users/${account.mlUserId}/items/search?status=active&limit=5`
  console.log('\n📡 Buscando items:', searchUrl)
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  })

  console.log('Status:', searchRes.status)
  console.log('Headers:', Object.fromEntries(searchRes.headers.entries()))

  if (!searchRes.ok) {
    const text = await searchRes.text()
    console.log('❌ Erro:', text)
    await prisma.$disconnect()
    return
  }

  const search: any = await searchRes.json()
  console.log('📊 Total items:', search.paging.total)
  console.log('Items retornados:', search.results.length)
  console.log('IDs:', search.results.slice(0, 3))

  if (search.results.length === 0) {
    console.log('❌ Nenhum item ativo')
    await prisma.$disconnect()
    return
  }

  // Buscar detalhes do primeiro item
  const itemId = search.results[0]
  console.log('\n🔬 Buscando detalhes:', itemId)

  const itemUrl = `https://api.mercadolibre.com/items/${itemId}`
  console.log('URL:', itemUrl)

  const itemRes = await fetch(itemUrl, {
    headers: { Authorization: `Bearer ${token}` }
  })

  console.log('Status:', itemRes.status)

  if (!itemRes.ok) {
    console.log('❌ Erro ao buscar item')
    const text = await itemRes.text()
    console.log('Response:', text.substring(0, 200))
    await prisma.$disconnect()
    return
  }

  const item: any = await itemRes.json()
  
  console.log('\n📦 ITEM DETALHES:')
  console.log('─'.repeat(60))
  console.log('Title:', item.title)
  console.log('inventory_id:', item.inventory_id || '❌ VAZIO')
  console.log('shipping.logistic_type:', item.shipping?.logistic_type || 'N/A')
  console.log('shipping.mode:', item.shipping?.mode || 'N/A')
  console.log('shipping.tags:', item.shipping?.tags || [])
  console.log('tags:', item.tags || [])
  console.log('variations:', item.variations?.length || 0)
  
  if (item.variations) {
    console.log('\n📦 VARIAÇÕES:')
    item.variations.slice(0, 3).forEach((v: any, i: number) => {
      console.log(`   ${i+1}. ID: ${v.id}`)
      console.log(`      inventory_id: ${v.inventory_id || '❌ VAZIO'}`)
      console.log(`      attributes: ${v.attribute_combinations?.map((a: any) => a.name).join(', ') || 'N/A'}`)
    })
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('❌ Erro:', err)
  process.exit(1)
})

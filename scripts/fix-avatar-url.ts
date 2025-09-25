import { prisma } from '@/lib/prisma'

async function fixProfileImages() {
  // Buscar a conta
  const account = await prisma.mLAccount.findFirst({
    where: {
      nickname: 'ELITESAUDEANIMAL'
    }
  })

  if (!account) {
    console.log('Account not found')
    return
  }

  console.log('Account:', account.nickname)
  console.log('ML User ID:', account.mlUserId)
  console.log('Site ID:', account.siteId)
  console.log('Current thumbnail:', account.thumbnail)

  // Para o Brasil (MLB) o padrão de avatar é diferente
  // Vamos construir a URL padrão do avatar do ML
  const userId = account.mlUserId

  // Tentar várias URLs de avatar do ML
  const possibleUrls = [
    `https://http2.mlstatic.com/storage/users-avatar-shrine/v1/user_${userId}.jpg`,
    `https://mla-s2-p.mlstatic.com/${userId}-R-original.jpg`,
    `https://http2.mlstatic.com/D_${userId}_100X100.jpg`,
    `https://perfil.mercadolivre.com.br/api/user_picture/${userId}`,
    `https://http2.mlstatic.com/static/users-avatar/${userId}.jpg`
  ]

  console.log('\n🔍 Testing avatar URLs...')

  for (const url of possibleUrls) {
    try {
      console.log('\nTrying:', url)
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      })
      console.log('Response:', response.status)

      if (response.ok || response.status === 200) {
        console.log('✅ Found working avatar URL!')

        // Atualizar no banco
        await prisma.mLAccount.update({
          where: { id: account.id },
          data: {
            thumbnail: url
          }
        })

        console.log('✅ Updated thumbnail in database!')
        break
      }
    } catch (error: any) {
      console.log('❌ Failed:', error.message)
    }
  }

  // Se nenhuma URL funcionou, deixar sem imagem por enquanto
  const updated = await prisma.mLAccount.findUnique({
    where: { id: account.id },
    select: { thumbnail: true }
  })

  if (!updated?.thumbnail || updated.thumbnail === account.thumbnail) {
    console.log('\n⚠️ No working avatar URL found')
    console.log('Setting thumbnail to null for now')

    await prisma.mLAccount.update({
      where: { id: account.id },
      data: {
        thumbnail: null
      }
    })
  }

  await prisma.$disconnect()
}

fixProfileImages()
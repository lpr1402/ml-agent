import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/security/encryption'

async function checkUserLogo() {
  const account = await prisma.mLAccount.findFirst({
    where: {
      nickname: 'ELITESAUDEANIMAL'
    }
  })

  if (!account) {
    console.log('Account not found')
    return
  }

  console.log('\n🔍 DADOS DA CONTA:')
  console.log('Nickname:', account.nickname)
  console.log('ML User ID:', account.mlUserId)
  console.log('Site ID:', account.siteId)
  console.log('Thumbnail atual no banco:', account.thumbnail)
  console.log('Permalink:', account.permalink)

  // Descriptografar token
  const accessToken = decryptToken({
    encrypted: account.accessToken,
    iv: account.accessTokenIV,
    authTag: account.accessTokenTag
  })

  console.log('\n📡 BUSCANDO DADOS ATUALIZADOS DO MERCADO LIVRE...')

  // Buscar dados do usuário direto da API do ML
  const response = await fetch(`https://api.mercadolibre.com/users/${account.mlUserId}`, {
    headers: {
      'Authorization': 'Bearer ' + accessToken
    }
  })

  if (response.ok) {
    const userData = await response.json()

    console.log('\n✅ RESPOSTA DA API DO MERCADO LIVRE:')
    console.log('ID:', userData.id)
    console.log('Nickname:', userData.nickname)
    console.log('Thumbnail:', userData.thumbnail)
    console.log('Logo:', userData.logo)
    console.log('Permalink:', userData.permalink)

    // Se tem thumbnail diferente, atualizar
    if (userData.thumbnail && userData.thumbnail !== account.thumbnail) {
      console.log('\n🔄 ATUALIZANDO THUMBNAIL NO BANCO...')
      await prisma.mLAccount.update({
        where: { id: account.id },
        data: {
          thumbnail: userData.thumbnail,
          permalink: userData.permalink || account.permalink
        }
      })
      console.log('✅ Thumbnail atualizado!')
    }

    // Testar se a URL do thumbnail funciona
    if (userData.thumbnail) {
      console.log('\n🌐 TESTANDO URL DO THUMBNAIL...')
      const imgResponse = await fetch(userData.thumbnail, { method: 'HEAD' })
      console.log('Status da imagem:', imgResponse.status)
      if (imgResponse.ok) {
        console.log('✅ URL do thumbnail está acessível!')
      } else {
        console.log('❌ URL do thumbnail não está acessível')
      }
    } else {
      console.log('\n⚠️ USUÁRIO NÃO TEM THUMBNAIL/LOGO NO MERCADO LIVRE')
    }
  } else {
    console.log('❌ Erro ao buscar dados:', response.status, response.statusText)
    const errorText = await response.text()
    console.log('Resposta de erro:', errorText)
  }

  await prisma.$disconnect()
}

checkUserLogo()
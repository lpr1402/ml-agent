import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/security/encryption'

async function updateMLProfileImage() {
  try {
    // Buscar conta
    const account = await prisma.mLAccount.findFirst({
      where: {
        nickname: 'ELITESAUDEANIMAL'
      }
    })

    if (!account) {
      console.log('❌ Account not found')
      return
    }

    console.log('📋 Account:', account.nickname, '- ID:', account.mlUserId)

    // Descriptografar token
    const accessToken = decryptToken({
      encrypted: account.accessToken,
      iv: account.accessTokenIV,
      authTag: account.accessTokenTag
    })

    // Aguardar 1 segundo para evitar rate limit
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Buscar dados do usuário seguindo a documentação oficial
    // Usar o endpoint /users/{User_id} conforme documentação
    const response = await fetch(`https://api.mercadolibre.com/users/${account.mlUserId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    console.log('📡 Response status:', response.status)

    if (!response.ok) {
      const text = await response.text()
      console.log('❌ Error response:', text)

      // Se for rate limit, aguardar e tentar novamente
      if (response.status === 429) {
        console.log('⏳ Rate limit hit, waiting 5 seconds...')
        await new Promise(resolve => setTimeout(resolve, 5000))

        // Tentar com /users/me que tem menos restrições
        const meResponse = await fetch('https://api.mercadolibre.com/users/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (meResponse.ok) {
          const meData = await meResponse.json()
          console.log('✅ Got data from /users/me')
          console.log('User ID:', meData.id)
          console.log('Nickname:', meData.nickname)

          // Buscar dados completos do usuário
          await new Promise(resolve => setTimeout(resolve, 2000))
          const userResponse = await fetch(`https://api.mercadolibre.com/users/${meData.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          })

          if (userResponse.ok) {
            const userData = await userResponse.json()
            processUserData(userData, account.id)
          }
        }
      }
      return
    }

    const userData = await response.json()
    await processUserData(userData, account.id)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function processUserData(userData: any, accountId: string) {
  console.log('\n📊 User Data Analysis:')
  console.log('- Nickname:', userData.nickname)
  console.log('- ID:', userData.id)
  console.log('- Site ID:', userData.site_id)
  console.log('- Logo:', userData.logo)
  console.log('- Permalink:', userData.permalink)

  // Verificar se tem seller_reputation com level_id
  if (userData.seller_reputation?.level_id) {
    console.log('- Seller Level:', userData.seller_reputation.level_id)
  }

  // Procurar por qualquer campo de imagem
  const possibleImageFields = ['logo', 'thumbnail', 'picture', 'avatar', 'image']
  let imageUrl = null

  for (const field of possibleImageFields) {
    if (userData[field]) {
      console.log(`- Found ${field}:`, userData[field])
      if (typeof userData[field] === 'string' && userData[field].includes('http')) {
        imageUrl = userData[field]
        break
      }
    }
  }

  // Se não encontrou imagem mas tem ID, construir URL padrão do ML
  if (!imageUrl && userData.id) {
    // Mercado Livre usa um padrão de URL para avatares baseado no ID
    const userId = userData.id.toString()

    // URL padrão de avatar do ML
    imageUrl = `https://http2.mlstatic.com/storage/users-avatar-shrine/v1/user_${userId}.jpg`
    console.log('\n🔍 Trying default avatar URL:', imageUrl)

    // Verificar se a URL existe
    try {
      const checkResponse = await fetch(imageUrl, { method: 'HEAD' })
      if (!checkResponse.ok) {
        console.log('❌ Default avatar not found')
        imageUrl = null
      } else {
        console.log('✅ Default avatar exists!')
      }
    } catch {
      imageUrl = null
    }
  }

  // Atualizar no banco
  const updates: any = {
    permalink: userData.permalink || undefined
  }

  if (imageUrl) {
    updates.thumbnail = imageUrl
    console.log('\n✅ Updating profile with image:', imageUrl)
  } else {
    console.log('\n⚠️ No image found for this user')
  }

  if (Object.keys(updates).length > 0) {
    await prisma.mLAccount.update({
      where: { id: accountId },
      data: updates
    })
    console.log('✅ Profile updated successfully!')
  }
}

// Executar
updateMLProfileImage()
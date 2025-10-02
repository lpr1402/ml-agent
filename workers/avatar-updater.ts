/**
 * Avatar Updater Worker
 * Atualiza fotos de perfil das contas ML diariamente
 * Production-ready com rate limiting inteligente
 */

import { PrismaClient } from '@prisma/client'
import { decryptToken } from '../lib/security/encryption'

const prisma = new PrismaClient()

function extractAvatarUrl(userData: any): string | null {
  let avatarUrl = null

  if (userData.thumbnail && typeof userData.thumbnail === 'object' && userData.thumbnail.picture_url) {
    avatarUrl = userData.thumbnail.picture_url
  } else if (userData.thumbnail && typeof userData.thumbnail === 'string') {
    avatarUrl = userData.thumbnail
  } else if (userData.logo && typeof userData.logo === 'string') {
    avatarUrl = userData.logo
  }

  if (avatarUrl) {
    if (avatarUrl.startsWith('//')) {
      avatarUrl = 'https:' + avatarUrl
    } else if (!avatarUrl.startsWith('http')) {
      avatarUrl = 'https://http2.mlstatic.com' + avatarUrl
    }
  }

  return avatarUrl
}

async function updateAccountAvatar(account: any): Promise<void> {
  try {
    console.log('[Avatar] Updating ' + account.nickname + '...')

    const accessToken = decryptToken({
      encrypted: account.accessToken,
      iv: account.accessTokenIV,
      authTag: account.accessTokenTag
    })

    const response = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.warn('[Avatar] API error for ' + account.nickname + ': ' + response.status)
      return
    }

    const userData = await response.json()
    const avatarUrl = extractAvatarUrl(userData)

    if (avatarUrl && avatarUrl !== account.thumbnail) {
      await prisma.mLAccount.update({
        where: { id: account.id },
        data: {
          thumbnail: avatarUrl,
          updatedAt: new Date()
        }
      })
      console.log('[Avatar] Updated ' + account.nickname + ': ' + avatarUrl)
    } else {
      console.log('[Avatar] No change for ' + account.nickname)
    }

  } catch (error: any) {
    console.error('[Avatar] Error updating ' + account.nickname + ':', error.message)
  }
}

async function updateAllAvatars() {
  try {
    console.log('\n=== Avatar Updater Started ===')
    console.log('Time: ' + new Date().toLocaleString('pt-BR'))

    const accounts = await prisma.mLAccount.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        nickname: true,
        mlUserId: true,
        thumbnail: true,
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true
      }
    })

    console.log('Found ' + accounts.length + ' active accounts')

    if (accounts.length === 0) {
      console.log('No accounts to update')
      return
    }

    for (let i = 0; i < accounts.length; i++) {
      await updateAccountAvatar(accounts[i])

      if (i < accounts.length - 1) {
        console.log('Waiting 30s... (' + (i + 1) + '/' + accounts.length + ' done)')
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }

    console.log('\n=== Avatar Updater Completed ===')
    console.log('Updated ' + accounts.length + ' accounts')
    console.log('Finished at ' + new Date().toLocaleString('pt-BR'))

  } catch (error: any) {
    console.error('[Avatar] Fatal error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

updateAllAvatars()

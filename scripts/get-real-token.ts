/**
 * Script para obter token real do Mercado Livre
 * Descriptografa o token armazenado no banco
 */

import { PrismaClient } from '@prisma/client'
import { decryptToken } from '../lib/security/encryption'

const prisma = new PrismaClient()

async function getRealToken() {
  try {
    // Buscar conta ML ativa
    const account = await prisma.mLAccount.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        nickname: true,
        mlUserId: true,
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true,
        refreshToken: true,
        refreshTokenIV: true,
        refreshTokenTag: true,
        tokenExpiresAt: true
      }
    })

    if (!account) {
      console.log('❌ Nenhuma conta ML ativa encontrada')
      console.log('Por favor, faça login em: https://gugaleo.axnexlabs.com.br')
      return null
    }

    console.log('📊 Conta encontrada:', account.nickname)
    console.log('🆔 ML User ID:', account.mlUserId)
    console.log('⏰ Token expira em:', account.tokenExpiresAt)

    // Verificar se tem dados de criptografia
    if (!account.accessToken || !account.accessTokenIV || !account.accessTokenTag) {
      console.log('❌ Token não está criptografado corretamente')
      return null
    }

    try {
      // Descriptografar token
      const accessToken = decryptToken({
        encrypted: account.accessToken,
        iv: account.accessTokenIV,
        authTag: account.accessTokenTag
      })

      console.log('\n✅ TOKEN DESCRIPTOGRAFADO COM SUCESSO!')
      console.log('=' .repeat(80))
      console.log('Access Token:', accessToken)
      console.log('=' .repeat(80))

      // Verificar se o token é válido testando com a API do ML
      const response = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        console.log('\n✅ Token válido! Usuário:', userData.nickname)
        console.log('Site ID:', userData.site_id)
        return accessToken
      } else {
        console.log('\n⚠️ Token pode estar expirado. Status:', response.status)
        console.log('Faça login novamente em: https://gugaleo.axnexlabs.com.br')
        return null
      }

    } catch (error) {
      console.error('❌ Erro ao descriptografar token:', error)
      console.log('\nPossíveis causas:')
      console.log('1. Token foi criptografado com chave diferente')
      console.log('2. Dados corrompidos no banco')
      console.log('3. Faça login novamente em: https://gugaleo.axnexlabs.com.br')
      return null
    }

  } catch (error) {
    console.error('Erro:', error)
    return null
  } finally {
    await prisma.$disconnect()
  }
}

getRealToken()
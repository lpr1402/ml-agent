#!/usr/bin/env node
/**
 * Script para validar configuração OAuth do Mercado Livre
 */

import * as dotenv from 'dotenv'

// Carrega variáveis de ambiente
dotenv.config({ path: '.env.production' })

async function validateOAuthConfig() {
  console.log('\n🔍 Validando configuração OAuth do Mercado Livre...\n')

  const clientId = process.env['ML_CLIENT_ID']
  const clientSecret = process.env['ML_CLIENT_SECRET']
  const redirectUri = process.env['ML_REDIRECT_URI']
  const encryptionKey = process.env['ENCRYPTION_KEY']

  let hasErrors = false

  // Validar CLIENT_ID
  if (!clientId) {
    console.error('❌ ML_CLIENT_ID não está definido')
    hasErrors = true
  } else if (clientId !== '8077330788571096') {
    console.error(`❌ ML_CLIENT_ID incorreto: ${clientId}`)
    console.log('   Correto: 8077330788571096')
    hasErrors = true
  } else {
    console.log('✅ ML_CLIENT_ID está correto')
  }

  // Validar CLIENT_SECRET
  if (!clientSecret) {
    console.error('❌ ML_CLIENT_SECRET não está definido')
    hasErrors = true
  } else if (clientSecret !== 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha') {
    console.error(`❌ ML_CLIENT_SECRET incorreto`)
    console.log('   Correto: jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha')
    hasErrors = true
  } else {
    console.log('✅ ML_CLIENT_SECRET está correto')
  }

  // Validar REDIRECT_URI
  if (!redirectUri) {
    console.error('❌ ML_REDIRECT_URI não está definido')
    hasErrors = true
  } else if (redirectUri !== 'https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre') {
    console.error(`❌ ML_REDIRECT_URI incorreto: ${redirectUri}`)
    console.log('   Correto: https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre')
    hasErrors = true
  } else {
    console.log('✅ ML_REDIRECT_URI está correto')
  }

  // Validar ENCRYPTION_KEY
  if (!encryptionKey) {
    console.error('❌ ENCRYPTION_KEY não está definido (necessário para criptografia de tokens)')
    hasErrors = true
  } else if (encryptionKey.length !== 64) {
    console.error(`❌ ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes), atual: ${encryptionKey.length}`)
    hasErrors = true
  } else {
    console.log('✅ ENCRYPTION_KEY está configurado')
  }

  console.log('\n' + '='.repeat(50) + '\n')

  if (hasErrors) {
    console.error('❌ Configuração OAuth tem problemas. Corrija as variáveis no arquivo .env.production')
    console.log('\n📋 Configuração correta:')
    console.log('ML_CLIENT_ID=8077330788571096')
    console.log('ML_CLIENT_SECRET=jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha')
    console.log('ML_REDIRECT_URI=https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre')
    console.log('ENCRYPTION_KEY=[gere com: openssl rand -hex 32]')
  } else {
    console.log('✅ Configuração OAuth está correta!')

    // Teste adicional: verifica se as credenciais funcionam
    console.log('\n🧪 Testando conexão com API do Mercado Livre...')

    try {
      const response = await fetch('https://api.mercadolibre.com/sites/MLB', {
        headers: {
          'User-Agent': 'ML-Agent/1.0'
        }
      })

      if (response.ok) {
        console.log('✅ API do Mercado Livre está acessível')
      } else {
        console.log(`⚠️  API retornou status ${response.status}`)
      }
    } catch (error) {
      console.error('❌ Erro ao conectar com API do ML:', error)
    }
  }

  console.log('\n')
}

validateOAuthConfig().catch(console.error)
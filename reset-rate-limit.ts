#!/usr/bin/env npx tsx
/**
 * Reset Rate Limiter State
 * Use este script para limpar o estado do rate limiter quando estiver bloqueado
 */

import { resetEndpointState, getEndpointState } from './lib/api/smart-rate-limiter'

// Limpar estado do oauth/token
console.log('🔄 Resetando estado do Rate Limiter...\n')

// Verificar estado atual
const currentState = getEndpointState('oauth/token')
if (currentState) {
  console.log('Estado atual do oauth/token:')
  console.log('- Retry Count:', currentState.retryCount)
  console.log('- Last Error:', currentState.lastError ? new Date(currentState.lastError) : 'N/A')
  console.log('- Backoff Until:', currentState.backoffUntil ? new Date(currentState.backoffUntil) : 'N/A')
  console.log()
}

// Resetar
resetEndpointState('oauth/token')
resetEndpointState('users/me')

console.log('✅ Rate limiter resetado com sucesso!')
console.log('📝 Você já pode tentar fazer login novamente.')
console.log()
console.log('⚠️  IMPORTANTE: Para evitar este problema novamente:')
console.log('   1. Não faça múltiplas tentativas de login rapidamente')
console.log('   2. Aguarde pelo menos 5 segundos entre tentativas')
console.log('   3. Se houver erro, aguarde 1 minuto antes de tentar novamente')
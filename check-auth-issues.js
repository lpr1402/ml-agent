const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkAuthIssues() {
  console.log('🔍 ANÁLISE DE PROBLEMAS DE AUTENTICAÇÃO\n')
  console.log('=' .repeat(50))
  
  try {
    // 1. Verificar sessões ativas
    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      }
    })
    
    console.log(`\n✅ Sessões ativas: ${sessions.length}`)
    
    // 2. Verificar OAuth states pendentes
    const oauthStates = await prisma.oAuthState.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      }
    })
    
    console.log(`✅ OAuth States pendentes: ${oauthStates.length}`)
    
    if (oauthStates.length > 0) {
      console.log('\n⚠️ OAuth States encontrados:')
      oauthStates.forEach(state => {
        const age = Math.round((Date.now() - state.createdAt.getTime()) / 1000)
        console.log(`  - Criado há ${age}s, expira em: ${state.expiresAt}`)
      })
    }
    
    // 3. Verificar estados expirados que não foram limpos
    const expiredStates = await prisma.oAuthState.findMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    
    if (expiredStates.length > 0) {
      console.log(`\n❌ OAuth States EXPIRADOS não limpos: ${expiredStates.length}`)
      console.log('  Limpando estados expirados...')
      const deleted = await prisma.oAuthState.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })
      console.log(`  ✅ ${deleted.count} estados expirados removidos`)
    }
    
    // 4. Verificar sessões expiradas
    const expiredSessions = await prisma.session.findMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    
    if (expiredSessions.length > 0) {
      console.log(`\n❌ Sessões EXPIRADAS não limpas: ${expiredSessions.length}`)
      const deleted = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })
      console.log(`  ✅ ${deleted.count} sessões expiradas removidas`)
    }
    
    // 5. Verificar ML Accounts
    const mlAccounts = await prisma.mLAccount.count({
      where: {
        isActive: true
      }
    })
    
    console.log(`\n✅ ML Accounts ativas: ${mlAccounts}`)
    
    // 6. Verificar rate limiting no Redis
    const Redis = require('ioredis')
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    
    const rateLimitKeys = await redis.keys('oauth:lock:*')
    if (rateLimitKeys.length > 0) {
      console.log(`\n⚠️ Rate limit locks ativos: ${rateLimitKeys.length}`)
      for (const key of rateLimitKeys) {
        const ttl = await redis.ttl(key)
        console.log(`  - ${key}: TTL ${ttl}s`)
      }
    }
    
    await redis.quit()
    
  } catch (error) {
    console.error('\n❌ Erro na análise:', error.message)
  } finally {
    await prisma.$disconnect()
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('\n📋 DIAGNÓSTICO:')
  console.log('1. Se há OAuth states pendentes, pode haver tentativas de login incompletas')
  console.log('2. Estados expirados foram limpos automaticamente')
  console.log('3. Verifique se há rate limiting ativo impedindo login')
}

checkAuthIssues()

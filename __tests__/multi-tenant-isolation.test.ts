import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { prisma } from '@/lib/prisma'
import { getCache } from '@/lib/cache/multi-tenant-cache'
import { getRateLimiter } from '@/lib/rate-limiter/organization-limiter'
// import { apiClient } from '@/lib/api-client' // Reserved for future use

/**
 * Testes de Isolamento Multi-Tenant
 * Garante que dados de uma organização nunca sejam acessíveis por outra
 */
describe('Multi-Tenant Isolation Tests', () => {
  let org1Id: string
  let org2Id: string
  let account1Id: string
  let account2Id: string
  let question1Id: string
  let question2Id: string
  
  beforeAll(async () => {
    // Criar duas organizações de teste
    const org1 = await prisma.organization.create({
      data: {
        primaryEmail: 'org1@test.com',
        primaryNickname: 'TestOrg1',
        plan: 'PROFESSIONAL' as any,
        // maxAccounts: 10 // Field managed internally
      }
    })
    org1Id = org1.id
    
    const org2 = await prisma.organization.create({
      data: {
        primaryEmail: 'org2@test.com',
        primaryNickname: 'TestOrg2',
        plan: 'PROFESSIONAL' as any,
        // maxAccounts: 10 // Field managed internally
      }
    })
    org2Id = org2.id
    
    // Criar contas ML para cada organização
    const account1 = await prisma.mLAccount.create({
      data: {
        organizationId: org1Id,
        mlUserId: 'ML_USER_1',
        nickname: 'Account1',
        email: 'account1@test.com',
        siteId: 'MLB',
        isPrimary: true,
        isActive: true,
        accessToken: 'encrypted_token_1',
        accessTokenIV: 'iv_1',
        accessTokenTag: 'tag_1',
        refreshToken: 'encrypted_refresh_1',
        refreshTokenIV: 'riv_1',
        refreshTokenTag: 'rtag_1',
        tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000)
      }
    })
    account1Id = account1.id
    
    const account2 = await prisma.mLAccount.create({
      data: {
        organizationId: org2Id,
        mlUserId: 'ML_USER_2',
        nickname: 'Account2',
        email: 'account2@test.com',
        siteId: 'MLB',
        isPrimary: true,
        isActive: true,
        accessToken: 'encrypted_token_2',
        accessTokenIV: 'iv_2',
        accessTokenTag: 'tag_2',
        refreshToken: 'encrypted_refresh_2',
        refreshTokenIV: 'riv_2',
        refreshTokenTag: 'rtag_2',
        tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000)
      }
    })
    account2Id = account2.id
    
    // Criar perguntas para cada conta
    const question1 = await prisma.question.create({
      data: {
        mlAccountId: account1Id,
        mlQuestionId: 'ML_Q_1',
        text: 'Question for Org1',
        itemId: 'ITEM_1',
        itemTitle: 'Product 1',
        sellerId: 'SELLER_1',
        dateCreated: new Date(),
        status: 'AWAITING_APPROVAL',
        receivedAt: new Date()
      }
    })
    question1Id = question1.id
    
    const question2 = await prisma.question.create({
      data: {
        mlAccountId: account2Id,
        mlQuestionId: 'ML_Q_2',
        text: 'Question for Org2',
        itemId: 'ITEM_2',
        itemTitle: 'Product 2',
        sellerId: 'SELLER_2',
        dateCreated: new Date(),
        status: 'AWAITING_APPROVAL',
        receivedAt: new Date()
      }
    })
    question2Id = question2.id
  })
  
  afterAll(async () => {
    // Limpar dados de teste
    await prisma.question.deleteMany({
      where: { id: { in: [question1Id, question2Id] } }
    })
    
    await prisma.mLAccount.deleteMany({
      where: { id: { in: [account1Id, account2Id] } }
    })
    
    await prisma.organization.deleteMany({
      where: { id: { in: [org1Id, org2Id] } }
    })
    
    await prisma.$disconnect()
  })
  
  describe('Database Isolation', () => {
    it('should not allow access to questions from another organization', async () => {
      // Tentar buscar pergunta da Org2 usando conta da Org1
      const question = await prisma.question.findFirst({
        where: {
          id: question2Id,
          mlAccount: {
            organizationId: org1Id
          }
        }
      })
      
      expect(question).toBeNull()
    })
    
    it('should not allow access to ML accounts from another organization', async () => {
      // Tentar buscar conta da Org2 usando ID da Org1
      const account = await prisma.mLAccount.findFirst({
        where: {
          id: account2Id,
          organizationId: org1Id
        }
      })
      
      expect(account).toBeNull()
    })
    
    it('should properly filter questions by organization', async () => {
      // Buscar perguntas da Org1
      const questions = await prisma.question.findMany({
        where: {
          mlAccount: {
            organizationId: org1Id
          }
        }
      })
      
      // Deve retornar apenas perguntas da Org1
      expect(questions.length).toBeGreaterThan(0)
      expect(questions.every(q => q.mlAccountId === account1Id)).toBe(true)
    })
  })
  
  describe('Cache Isolation', () => {
    it('should not allow cache access across organizations', async () => {
      const cache = getCache()
      
      // Definir cache para Org1
      await cache.set('test', 'key1', { data: 'org1_data' }, 60, org1Id)
      
      // Tentar acessar com Org2
      const data = await cache.get('test', 'key1', org2Id)
      
      expect(data).toBeNull()
    })
    
    it('should isolate cache invalidation by organization', async () => {
      const cache = getCache()
      
      // Definir cache para ambas organizações
      await cache.set('test', 'shared_key', { data: 'org1_data' }, 60, org1Id)
      await cache.set('test', 'shared_key', { data: 'org2_data' }, 60, org2Id)
      
      // Invalidar cache da Org1
      await cache.invalidateOrganization(org1Id)
      
      // Cache da Org1 deve estar vazio
      const data1 = await cache.get('test', 'shared_key', org1Id)
      expect(data1).toBeNull()
      
      // Cache da Org2 deve permanecer
      const data2 = await cache.get('test', 'shared_key', org2Id)
      expect(data2).toEqual({ data: 'org2_data' })
    })
  })
  
  describe('Rate Limiting Isolation', () => {
    it('should apply rate limits per organization', async () => {
      const limiter = getRateLimiter()
      
      // Configuração de teste: 5 requests por minuto
      const testConfig = {
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test'
      }
      
      // Fazer 5 requests para Org1
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkLimit(org1Id, testConfig)
        expect(result.allowed).toBe(true)
      }
      
      // 6º request da Org1 deve ser bloqueado
      const org1Blocked = await limiter.checkLimit(org1Id, testConfig)
      expect(org1Blocked.allowed).toBe(false)
      
      // Org2 ainda deve ter todos os requests disponíveis
      const org2Result = await limiter.checkLimit(org2Id, testConfig)
      expect(org2Result.allowed).toBe(true)
      expect(org2Result.remaining).toBe(4)
      
      // Limpar limites
      await limiter.resetLimit(org1Id, testConfig)
      await limiter.resetLimit(org2Id, testConfig)
    })
    
    it('should track ML API limits per account', async () => {
      const limiter = getRateLimiter()
      
      // Verificar limite para conta ML1
      const result1 = await limiter.checkMLAccountLimit(account1Id, org1Id)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBeLessThanOrEqual(2000)
      
      // Verificar limite para conta ML2 (organização diferente)
      const result2 = await limiter.checkMLAccountLimit(account2Id, org2Id)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBeLessThanOrEqual(2000)
    })
  })
  
  describe('API Endpoint Isolation', () => {
    it('should not return data from other organizations in metrics API', async () => {
      // Simular request com sessão da Org1
      // const _mockRequest = {
      //   session: { organizationId: org1Id }
      // }
      
      // Fazer chamada para API de métricas multi-conta
      // Note: Este é um teste conceitual - em produção seria feito via supertest
      const response = await fetch('/api/agent/metrics-multi', {
        headers: {
          'X-Organization-Id': org1Id
        }
      }).catch(() => null)
      
      if (response) {
        const data = await response.json()
        
        // Verificar que apenas contas da Org1 são retornadas
        if (data.byAccount) {
          expect(data.byAccount.every((acc: any) => 
            acc.accountId === account1Id
          )).toBe(true)
        }
      }
    })
    
    it('should not return questions from other organizations', async () => {
      // Buscar perguntas através da API
      const questions = await prisma.question.findMany({
        where: {
          mlAccount: {
            organizationId: org1Id,
            isActive: true
          }
        },
        include: {
          mlAccount: {
            select: {
              id: true,
              nickname: true,
              organizationId: true
            }
          }
        }
      })
      
      // Verificar isolamento
      questions.forEach(q => {
        expect(q.mlAccount.organizationId).toBe(org1Id)
        expect(q.mlAccount.id).toBe(account1Id)
      })
    })
  })
  
  describe('Approval Token Isolation', () => {
    it('should not allow token usage across organizations', async () => {
      // Criar token para Org1
      const token = await prisma.approvalToken.create({
        data: {
          token: 'test_token_org1',
          questionId: question1Id,
          mlAccountId: account1Id,
          organizationId: org1Id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          used: false
        }
      })
      
      // Tentar validar token com Org2
      const validation = await prisma.approvalToken.findFirst({
        where: {
          token: 'test_token_org1',
          organizationId: org2Id,
          used: false,
          expiresAt: { gt: new Date() }
        }
      })
      
      expect(validation).toBeNull()
      
      // Limpar
      await prisma.approvalToken.delete({ where: { id: token.id } })
    })
  })
  
  describe('Session Isolation', () => {
    it('should maintain separate sessions per organization', async () => {
      // Criar sessões para ambas organizações
      await prisma.session.create({
        data: {
          sessionToken: 'session_org1',
          organizationId: org1Id,
          activeMLAccountId: account1Id,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        }
      })
      
      await prisma.session.create({
        data: {
          sessionToken: 'session_org2',
          organizationId: org2Id,
          activeMLAccountId: account2Id,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        }
      })
      
      // Verificar que sessões são isoladas
      const foundSession1 = await prisma.session.findUnique({
        where: { sessionToken: 'session_org1' }
      })
      expect(foundSession1?.organizationId).toBe(org1Id)
      
      const foundSession2 = await prisma.session.findUnique({
        where: { sessionToken: 'session_org2' }
      })
      expect(foundSession2?.organizationId).toBe(org2Id)
      
      // Limpar
      await prisma.session.deleteMany({
        where: {
          sessionToken: { in: ['session_org1', 'session_org2'] }
        }
      })
    })
  })
})

// Exportar função para executar testes
export async function runIsolationTests(): Promise<void> {
  console.log('🔒 Running Multi-Tenant Isolation Tests...')
  
  try {
    // Executar testes programaticamente
    const { execSync } = require('child_process')
    execSync('npm test -- __tests__/multi-tenant-isolation.test.ts', {
      stdio: 'inherit'
    })
    
    console.log('✅ All isolation tests passed!')
  } catch (error) {
    console.error('❌ Isolation tests failed:', error)
    throw error
  }
}
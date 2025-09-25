/**
 * Script de diagnóstico completo do sistema ML Agent
 * Testa todos os componentes críticos e identifica problemas
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'
import { decryptToken } from './lib/security/encryption'

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '.env.production') })

const prisma = new PrismaClient()

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow
  }[type]

  const emoji = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type]

  console.log(`${color}${emoji} ${message}${colors.reset}`)
}

async function diagnose() {
  console.log('\n🔍 === DIAGNÓSTICO DO SISTEMA ML AGENT ===\n')

  // 1. Verificar configurações de ambiente
  log('1. VERIFICANDO CONFIGURAÇÕES DE AMBIENTE', 'info')
  const requiredEnvVars = [
    'DATABASE_URL',
    'ML_CLIENT_ID',
    'ML_CLIENT_SECRET',
    'ML_REDIRECT_URI',
    'NEXTAUTH_URL',
    'ENCRYPTION_KEY',
    'ZAPSTER_API_URL',
    'ZAPSTER_API_TOKEN',
    'ZAPSTER_INSTANCE_ID',
    'ZAPSTER_GROUP_ID'
  ]

  let envOk = true
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log(`  ${envVar}: Configurado`, 'success')
    } else {
      log(`  ${envVar}: NÃO CONFIGURADO`, 'error')
      envOk = false
    }
  }

  // 2. Testar conexão com banco de dados
  log('\n2. TESTANDO CONEXÃO COM BANCO DE DADOS', 'info')
  try {
    await prisma.$connect()
    log('  Conexão com PostgreSQL: OK', 'success')

    // Verificar tabelas
    const questionCount = await prisma.question.count()
    const accountCount = await prisma.mLAccount.count()
    const webhookCount = await prisma.webhookEvent.count()

    log(`  Total de perguntas: ${questionCount}`, 'info')
    log(`  Total de contas ML: ${accountCount}`, 'info')
    log(`  Total de eventos webhook: ${webhookCount}`, 'info')
  } catch (error) {
    log(`  Erro ao conectar com banco: ${error}`, 'error')
  }

  // 3. Verificar contas ML ativas
  log('\n3. VERIFICANDO CONTAS ML ATIVAS', 'info')
  try {
    const accounts = await prisma.mLAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nickname: true,
        mlUserId: true,
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true,
        tokenExpiresAt: true
      }
    })

    if (accounts.length === 0) {
      log('  Nenhuma conta ML ativa encontrada', 'error')
    } else {
      for (const account of accounts) {
        log(`  Conta: ${account.nickname} (${account.mlUserId})`, 'info')

        // Verificar token
        if (account.accessToken && account.accessTokenIV && account.accessTokenTag) {
          try {
            const token = decryptToken({
              encrypted: account.accessToken,
              iv: account.accessTokenIV,
              authTag: account.accessTokenTag
            })

            const isExpired = account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()
            if (isExpired) {
              log(`    Token: EXPIRADO (expirou em ${account.tokenExpiresAt})`, 'error')
            } else {
              log(`    Token: Válido até ${account.tokenExpiresAt}`, 'success')
            }

            // Testar token com API do ML
            const response = await fetch('https://api.mercadolibre.com/users/me', {
              headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
              const userData = await response.json()
              log(`    API ML: OK - ${userData.nickname}`, 'success')
            } else {
              log(`    API ML: Erro ${response.status}`, 'error')
            }
          } catch (err) {
            log(`    Erro ao descriptografar token: ${err}`, 'error')
          }
        } else {
          log(`    Token: NÃO CONFIGURADO`, 'error')
        }
      }
    }
  } catch (error) {
    log(`  Erro ao buscar contas: ${error}`, 'error')
  }

  // 4. Verificar últimas perguntas
  log('\n4. VERIFICANDO ÚLTIMAS PERGUNTAS', 'info')
  try {
    const recentQuestions = await prisma.question.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        mlAccount: {
          select: { nickname: true }
        }
      }
    })

    if (recentQuestions.length === 0) {
      log('  Nenhuma pergunta encontrada', 'warning')
    } else {
      for (const q of recentQuestions) {
        const timeSince = Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 1000 / 60)
        log(`  [${q.status}] ${q.mlAccount?.nickname} - ${timeSince}min atrás`, 'info')

        // Verificar problemas
        if (q.status === 'FAILED' || q.status === 'TOKEN_ERROR') {
          log(`    ⚠️ Erro: ${q.failureReason || 'Sem detalhes'}`, 'error')
        }
        if (q.status === 'PROCESSING' && timeSince > 10) {
          log(`    ⚠️ Preso em PROCESSING há ${timeSince} minutos`, 'warning')
        }
      }
    }
  } catch (error) {
    log(`  Erro ao buscar perguntas: ${error}`, 'error')
  }

  // 5. Testar webhook endpoint
  log('\n5. TESTANDO WEBHOOK ENDPOINT', 'info')
  try {
    const webhookUrl = `${process.env['NEXTAUTH_URL']}/api/ml-webhook/handler`
    const testPayload = {
      topic: "questions",
      resource: "/questions/TEST123",
      user_id: "test",
      application_id: "test"
    }

    log(`  URL: ${webhookUrl}`, 'info')

    // Fazer chamada simulada (vai falhar mas mostra se endpoint responde)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    })

    if (response.status === 200) {
      log('  Webhook respondeu com 200 OK', 'success')
    } else {
      log(`  Webhook respondeu com status ${response.status}`, 'warning')
    }
  } catch (error) {
    log(`  Erro ao testar webhook: ${error}`, 'error')
  }

  // 6. Verificar conectividade N8N
  log('\n6. TESTANDO CONECTIVIDADE N8N', 'info')
  try {
    const n8nUrl = 'https://n8n.mercadopreciso.com/webhook/9e3797d2-9de8-4be2-b8e7-69ba983c60f8'

    // Fazer GET para verificar se endpoint existe
    const response = await fetch(n8nUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })

    // N8N geralmente retorna 405 para GET em webhook POST
    if (response.status === 405 || response.status === 200) {
      log('  N8N webhook acessível', 'success')
    } else {
      log(`  N8N respondeu com status ${response.status}`, 'warning')
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      log('  N8N timeout (pode estar com rate limit)', 'warning')
    } else {
      log(`  Erro ao conectar com N8N: ${error.message}`, 'error')
    }
  }

  // 7. Verificar SSE endpoint
  log('\n7. TESTANDO SSE ENDPOINT', 'info')
  try {
    const sseUrl = `${process.env['NEXTAUTH_URL']}/api/agent/events-multi`
    const response = await fetch(sseUrl, {
      signal: AbortSignal.timeout(3000)
    })

    if (response.status === 401) {
      log('  SSE endpoint acessível (requer autenticação)', 'success')
    } else if (response.ok) {
      log('  SSE endpoint respondendo', 'success')
    } else {
      log(`  SSE respondeu com status ${response.status}`, 'warning')
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      log('  SSE timeout (normal para streaming)', 'success')
    } else {
      log(`  Erro ao testar SSE: ${error.message}`, 'error')
    }
  }

  // 8. Verificar Zapster API
  log('\n8. TESTANDO ZAPSTER API', 'info')
  if (process.env['ZAPSTER_API_TOKEN']) {
    try {
      const response = await fetch('https://api.zapsterapi.com/v1/wa/messages', {
        method: 'GET',
        headers: {
          'Authorization': process.env['ZAPSTER_API_TOKEN'].startsWith('Bearer ')
            ? process.env['ZAPSTER_API_TOKEN']
            : `Bearer ${process.env['ZAPSTER_API_TOKEN']}`
        }
      })

      // Zapster retorna 405 para GET
      if (response.status === 405) {
        log('  Zapster API acessível (método não permitido é esperado)', 'success')
      } else if (response.status === 401) {
        log('  Zapster API: Token inválido', 'error')
      } else {
        log(`  Zapster API respondeu com status ${response.status}`, 'warning')
      }
    } catch (error) {
      log(`  Erro ao testar Zapster: ${error}`, 'error')
    }
  } else {
    log('  Zapster não configurado', 'warning')
  }

  // 9. Análise de problemas comuns
  log('\n9. ANÁLISE DE PROBLEMAS COMUNS', 'info')

  // Verificar perguntas presas
  const stuckQuestions = await prisma.question.count({
    where: {
      status: 'PROCESSING',
      createdAt: {
        lt: new Date(Date.now() - 10 * 60 * 1000) // Mais de 10 minutos
      }
    }
  })

  if (stuckQuestions > 0) {
    log(`  ⚠️ ${stuckQuestions} perguntas presas em PROCESSING`, 'warning')
  }

  // Verificar falhas recentes
  const recentFailures = await prisma.question.count({
    where: {
      status: { in: ['FAILED', 'TOKEN_ERROR'] },
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000) // Última hora
      }
    }
  })

  if (recentFailures > 0) {
    log(`  ⚠️ ${recentFailures} falhas na última hora`, 'warning')
  }

  // Verificar eventos webhook não processados
  const unprocessedWebhooks = await prisma.webhookEvent.count({
    where: {
      processed: false,
      createdAt: {
        lt: new Date(Date.now() - 5 * 60 * 1000) // Mais de 5 minutos
      }
    }
  })

  if (unprocessedWebhooks > 0) {
    log(`  ⚠️ ${unprocessedWebhooks} webhooks não processados`, 'warning')
  }

  log('\n📊 === RESUMO DO DIAGNÓSTICO ===\n', 'info')

  const problems = []

  if (!envOk) problems.push('Variáveis de ambiente faltando')
  if (stuckQuestions > 0) problems.push(`${stuckQuestions} perguntas travadas`)
  if (recentFailures > 0) problems.push(`${recentFailures} falhas recentes`)
  if (unprocessedWebhooks > 0) problems.push(`${unprocessedWebhooks} webhooks pendentes`)

  if (problems.length === 0) {
    log('Sistema aparentemente funcionando corretamente!', 'success')
  } else {
    log('PROBLEMAS DETECTADOS:', 'error')
    problems.forEach(p => log(`  - ${p}`, 'error'))
  }

  await prisma.$disconnect()
}

// Executar diagnóstico
diagnose().catch(console.error)
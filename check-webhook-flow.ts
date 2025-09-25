/**
 * Diagnóstico completo do fluxo webhook -> processamento -> SSE -> interface
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env.production') })

const prisma = new PrismaClient()

async function checkWebhookFlow() {
  console.log('\n🔍 === DIAGNÓSTICO DO FLUXO WEBHOOK -> INTERFACE ===\n')

  // 1. Verificar webhooks recebidos recentemente
  console.log('1️⃣ WEBHOOKS RECEBIDOS (últimos 30 min):')
  const recentWebhooks = await prisma.webhookEvent.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      eventType: true,
      topic: true,
      processed: true,
      status: true,
      createdAt: true,
      processingError: true,
      mlAccount: {
        select: {
          nickname: true
        }
      }
    }
  })

  if (recentWebhooks.length === 0) {
    console.log('  ❌ NENHUM webhook recebido nos últimos 30 minutos!')
    console.log('  ⚠️  Possíveis problemas:')
    console.log('     - Webhook não configurado no ML')
    console.log('     - URL do webhook incorreta')
    console.log('     - Firewall/proxy bloqueando')
    console.log('     - Validação rejeitando webhooks')
  } else {
    for (const wh of recentWebhooks) {
      const minAgo = Math.floor((Date.now() - new Date(wh.createdAt).getTime()) / 1000 / 60)
      console.log(`  📦 ${wh.eventType}/${wh.topic} - ${minAgo}min atrás`)
      console.log(`     Status: ${wh.status} | Processado: ${wh.processed}`)
      if (wh.processingError) {
        console.log(`     ❌ Erro: ${wh.processingError}`)
      }
    }
  }

  // 2. Verificar webhooks não processados
  console.log('\n2️⃣ WEBHOOKS NÃO PROCESSADOS:')
  const unprocessed = await prisma.webhookEvent.count({
    where: {
      processed: false,
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000) // última hora
      }
    }
  })

  if (unprocessed > 0) {
    console.log(`  ⚠️  ${unprocessed} webhooks não processados na última hora`)

    // Mostrar detalhes dos não processados
    const unprocessedDetails = await prisma.webhookEvent.findMany({
      where: {
        processed: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        eventId: true,
        topic: true,
        status: true,
        error: true,
        createdAt: true
      }
    })

    for (const wh of unprocessedDetails) {
      console.log(`     - ${wh.topic}/${wh.eventId} - Status: ${wh.status}`)
      if (wh.error) {
        console.log(`       Erro: ${wh.error}`)
      }
    }
  } else {
    console.log('  ✅ Todos os webhooks foram processados')
  }

  // 3. Verificar perguntas criadas recentemente
  console.log('\n3️⃣ PERGUNTAS CRIADAS (últimos 30 min):')
  const recentQuestions = await prisma.question.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      mlQuestionId: true,
      status: true,
      text: true,
      createdAt: true,
      mlAccount: {
        select: {
          nickname: true
        }
      }
    }
  })

  if (recentQuestions.length === 0) {
    console.log('  ❌ NENHUMA pergunta criada nos últimos 30 minutos!')
  } else {
    for (const q of recentQuestions) {
      const minAgo = Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 1000 / 60)
      console.log(`  📝 ${q.mlQuestionId} - ${q.status} - ${minAgo}min atrás`)
      console.log(`     ${q.text?.substring(0, 50)}...`)
    }
  }

  // 4. Verificar URL do webhook configurada
  console.log('\n4️⃣ CONFIGURAÇÃO DO WEBHOOK:')
  console.log(`  URL Base: ${process.env['NEXTAUTH_URL'] || 'NÃO CONFIGURADO'}`)
  console.log(`  Endpoint: /api/ml-webhook/handler`)
  console.log(`  URL Completa: ${process.env['NEXTAUTH_URL']}/api/ml-webhook/handler`)

  // 5. Verificar conta ML ativa
  console.log('\n5️⃣ CONTA ML ATIVA:')
  const activeAccount = await prisma.mLAccount.findFirst({
    where: { isActive: true },
    select: {
      nickname: true,
      mlUserId: true,
      tokenExpiresAt: true
    }
  })

  if (activeAccount) {
    console.log(`  ✅ Conta: ${activeAccount.nickname} (${activeAccount.mlUserId})`)
    const tokenExpired = activeAccount.tokenExpiresAt && new Date(activeAccount.tokenExpiresAt) < new Date()
    if (tokenExpired) {
      console.log('  ❌ Token EXPIRADO!')
    } else {
      console.log(`  ✅ Token válido até: ${activeAccount.tokenExpiresAt}`)
    }
  } else {
    console.log('  ❌ Nenhuma conta ML ativa!')
  }

  // 6. Testar webhook manualmente
  console.log('\n6️⃣ TESTE DE WEBHOOK MANUAL:')
  console.log('  Para testar manualmente o webhook:')
  console.log('  curl -X POST \\')
  console.log(`    ${process.env['NEXTAUTH_URL']}/api/ml-webhook/handler \\`)
  console.log('    -H "Content-Type: application/json" \\')
  console.log('    -d \'{"topic":"questions","resource":"/questions/TEST123","user_id":"1377558007"}\'')

  // 7. Verificar processamento assíncrono
  console.log('\n7️⃣ PROCESSAMENTO ASSÍNCRONO:')

  // Buscar webhook event mais recente
  const lastWebhook = await prisma.webhookEvent.findFirst({
    where: { topic: 'questions' },
    orderBy: { createdAt: 'desc' },
    select: {
      eventId: true,
      processed: true,
      processingError: true,
      createdAt: true
    }
  })

  if (lastWebhook) {
    console.log(`  Último webhook de pergunta: ${lastWebhook.eventId}`)
    console.log(`  Processado: ${lastWebhook.processed ? '✅' : '❌'}`)
    if (lastWebhook.processingError) {
      console.log(`  Erro: ${lastWebhook.processingError}`)
    }

    // Verificar se existe pergunta correspondente
    const question = await prisma.question.findUnique({
      where: { mlQuestionId: lastWebhook.eventId || '' }
    })

    if (question) {
      console.log('  ✅ Pergunta criada no banco')
    } else {
      console.log('  ❌ Pergunta NÃO foi criada no banco!')
    }
  }

  console.log('\n📊 === RESUMO DO DIAGNÓSTICO ===\n')

  const problems = []
  if (recentWebhooks.length === 0) problems.push('Nenhum webhook recebido recentemente')
  if (unprocessed > 0) problems.push(`${unprocessed} webhooks não processados`)
  if (recentQuestions.length === 0) problems.push('Nenhuma pergunta criada recentemente')
  if (!activeAccount) problems.push('Nenhuma conta ML ativa')

  if (problems.length === 0) {
    console.log('✅ Sistema aparentemente OK (mas pode haver problemas de SSE/real-time)')
  } else {
    console.log('❌ PROBLEMAS DETECTADOS:')
    problems.forEach(p => console.log(`   - ${p}`))
  }

  await prisma.$disconnect()
}

checkWebhookFlow().catch(console.error)
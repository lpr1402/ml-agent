/**
 * 🔍 DIAGNÓSTICO: Tempo de Processamento ML Agent
 * Verificar por que está mostrando 9min ao invés de 10-30s
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnose() {
  try {
    console.log('🔍 Verificando últimas 10 perguntas processadas...\n')

    // Query exata que está sendo usada na API
    const processingTimeResult = await prisma.$queryRaw<Array<{ avg: number | null }>>(
      Prisma.sql`
        SELECT AVG(processing_time) as avg
        FROM (
          SELECT EXTRACT(EPOCH FROM ("aiProcessedAt" - "sentToAIAt")) as processing_time
          FROM "Question"
          WHERE "aiProcessedAt" IS NOT NULL
          AND "sentToAIAt" IS NOT NULL
          AND "status" IN ('RESPONDED', 'APPROVED', 'COMPLETED', 'AWAITING_APPROVAL')
          ORDER BY "aiProcessedAt" DESC
          LIMIT 10
        ) recent_questions
      `
    )

    console.log('📊 Média calculada pela query:', processingTimeResult[0]?.avg, 'segundos')
    console.log('📊 Em minutos:', (processingTimeResult[0]?.avg || 0) / 60, 'min\n')

    // Buscar as 10 perguntas individualmente para debug
    const questions = await prisma.question.findMany({
      where: {
        aiProcessedAt: { not: null },
        sentToAIAt: { not: null },
        status: { in: ['RESPONDED', 'APPROVED', 'COMPLETED', 'AWAITING_APPROVAL'] }
      },
      orderBy: { aiProcessedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        sentToAIAt: true,
        aiProcessedAt: true,
        status: true,
        mlAccount: {
          select: {
            nickname: true
          }
        }
      }
    })

    console.log('📋 Detalhes das últimas 10 perguntas:\n')

    questions.forEach((q, index) => {
      if (q.sentToAIAt && q.aiProcessedAt) {
        const diff = q.aiProcessedAt.getTime() - q.sentToAIAt.getTime()
        const seconds = diff / 1000

        console.log(`${index + 1}. Pergunta ${q.id}`)
        console.log(`   Conta: ${q.mlAccount.nickname}`)
        console.log(`   Enviado IA: ${q.sentToAIAt.toISOString()}`)
        console.log(`   Processado: ${q.aiProcessedAt.toISOString()}`)
        console.log(`   Tempo: ${seconds.toFixed(2)}s`)
        console.log(`   Status: ${q.status}`)
        console.log('')
      }
    })

    // Calcular média manual para comparar
    const times = questions
      .filter(q => q.sentToAIAt && q.aiProcessedAt)
      .map(q => {
        const diff = q.aiProcessedAt!.getTime() - q.sentToAIAt!.getTime()
        return diff / 1000
      })

    const manualAvg = times.reduce((sum, t) => sum + t, 0) / times.length

    console.log('✅ Média manual:', manualAvg.toFixed(2), 'segundos')
    console.log('✅ Média SQL:', processingTimeResult[0]?.avg, 'segundos')
    console.log('')

    // Verificar se há perguntas com tempos muito altos (outliers)
    const outliers = times.filter(t => t > 60)
    if (outliers.length > 0) {
      console.log('⚠️ OUTLIERS DETECTADOS (>60s):', outliers)
    } else {
      console.log('✅ Nenhum outlier detectado')
    }

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

diagnose()

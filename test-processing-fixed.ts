/**
 * 🔍 TESTE: Tempo de Processamento CORRIGIDO
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  try {
    console.log('🔍 Testando query CORRIGIDA (últimas 10 válidas)...\n')

    // Query CORRIGIDA
    const processingTimeResult = await prisma.$queryRaw<Array<{ avg: number | null, count: bigint }>>(
      Prisma.sql`
        SELECT
          AVG(processing_time) as avg,
          COUNT(*) as count
        FROM (
          SELECT EXTRACT(EPOCH FROM ("aiProcessedAt" - "sentToAIAt")) as processing_time
          FROM "Question"
          WHERE "aiProcessedAt" IS NOT NULL
          AND "sentToAIAt" IS NOT NULL
          AND "aiProcessedAt" > "sentToAIAt"
          AND EXTRACT(EPOCH FROM ("aiProcessedAt" - "sentToAIAt")) > 0
          AND EXTRACT(EPOCH FROM ("aiProcessedAt" - "sentToAIAt")) < 120
          AND "status" IN ('RESPONDED', 'APPROVED', 'COMPLETED', 'AWAITING_APPROVAL')
          ORDER BY "aiProcessedAt" DESC
          LIMIT 10
        ) recent_questions
      `
    )

    const avgSeconds = processingTimeResult[0]?.avg || 0
    const count = Number(processingTimeResult[0]?.count || 0)

    console.log('✅ Média CORRIGIDA:', avgSeconds.toFixed(2), 'segundos')
    console.log('✅ Perguntas analisadas:', count)
    console.log('')

    // Buscar as perguntas individuais
    const questions = await prisma.$queryRaw<Array<{
      id: string,
      processing_time: number,
      sent: Date,
      processed: Date
    }>>(
      Prisma.sql`
        SELECT
          id,
          EXTRACT(EPOCH FROM ("aiProcessedAt" - "sentToAIAt")) as processing_time,
          "sentToAIAt" as sent,
          "aiProcessedAt" as processed
        FROM "Question"
        WHERE "aiProcessedAt" IS NOT NULL
        AND "sentToAIAt" IS NOT NULL
        AND "aiProcessedAt" > "sentToAIAt"
        AND EXTRACT(EPOCH FROM ("aiProcessedAt" - "sentToAIAt")) > 0
        AND EXTRACT(EPOCH FROM ("aiProcessedAt" - "sentToAIAt")) < 120
        AND "status" IN ('RESPONDED', 'APPROVED', 'COMPLETED', 'AWAITING_APPROVAL')
        ORDER BY "aiProcessedAt" DESC
        LIMIT 10
      `
    )

    console.log('📋 Últimas 10 perguntas VÁLIDAS:\n')
    questions.forEach((q, i) => {
      console.log(`${i + 1}. ID: ${q.id}`)
      console.log(`   Tempo: ${q.processing_time.toFixed(2)}s`)
      console.log(`   Enviado: ${q.sent.toISOString()}`)
      console.log(`   Processado: ${q.processed.toISOString()}`)
      console.log('')
    })

    if (count > 0 && avgSeconds >= 10 && avgSeconds <= 30) {
      console.log('✅ SUCESSO! Média está dentro do esperado (10-30s)')
    } else if (count === 0) {
      console.log('⚠️ Nenhuma pergunta válida encontrada')
    } else {
      console.log(`⚠️ Média fora do esperado: ${avgSeconds.toFixed(2)}s`)
    }

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

test()

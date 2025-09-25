#!/usr/bin/env npx tsx

import { prisma } from '@/lib/prisma'

async function deleteProcessingQuestions() {
  try {
    console.log('🔍 Buscando perguntas com status PROCESSING...')

    // Primeiro listar as perguntas que serão removidas
    const questions = await prisma.question.findMany({
      where: {
        status: 'PROCESSING'
      },
      select: {
        id: true,
        mlQuestionId: true,
        status: true
      }
    })

    if (questions.length > 0) {
      console.log(`📋 Encontradas ${questions.length} perguntas com status PROCESSING:`)
      questions.forEach(q => {
        console.log(`  - ID: ${q.id}, ML Question ID: ${q.mlQuestionId}`)
      })

      // Deletar as perguntas
      const result = await prisma.question.deleteMany({
        where: {
          status: 'PROCESSING'
        }
      })

      console.log(`✅ Removidas ${result.count} perguntas com status PROCESSING`)
    } else {
      console.log('✅ Nenhuma pergunta com status PROCESSING encontrada')
    }

  } catch (error) {
    console.error('❌ Erro ao deletar perguntas:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteProcessingQuestions()
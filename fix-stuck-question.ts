import { prisma } from './lib/prisma'

async function reprocessStuckQuestion() {
  try {
    // Buscar a pergunta travada
    const question = await prisma.question.findFirst({
      where: {
        mlQuestionId: '13431695547',
        status: 'PROCESSING'
      },
      include: {
        mlAccount: true
      }
    })

    if (!question) {
      console.log('Pergunta não encontrada ou já processada')
      return
    }

    console.log('Enviando pergunta para N8N...')
    console.log('Pergunta:', question.text)
    console.log('Produto:', question.itemTitle)
    console.log('ID:', question.mlQuestionId)

    // Enviar para N8N
    const n8nPayload = {
      'question-id': question.mlQuestionId,
      'question': question.text,
      'product': question.itemTitle || 'Produto',
      'seller': question.mlAccount.nickname,
      'customer': 'Cliente',
      'context': `Pergunta sobre ${question.itemTitle || 'produto'}`
    }

    const response = await fetch('http://52.52.157.194:5678/webhook/perguntas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(n8nPayload)
    })

    if (response.ok) {
      console.log('✅ Pergunta enviada para N8N com sucesso!')
      const result = await response.text()
      console.log('Resposta do N8N:', result)
    } else {
      console.log('❌ Erro ao enviar para N8N:', response.status, response.statusText)
      const errorText = await response.text()
      console.log('Detalhes do erro:', errorText)
    }

  } catch (error) {
    console.error('Erro ao processar:', error)
  } finally {
    await prisma.$disconnect()
  }
}

reprocessStuckQuestion()
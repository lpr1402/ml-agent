/**
 * Script para testar o envio de notificações WhatsApp via Zapster
 */

import dotenv from 'dotenv'
import path from 'path'

// Carregar variáveis de ambiente de produção
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') })

import { zapsterService } from '../lib/services/zapster-whatsapp'

async function testZapsterNotifications() {
  console.log('🚀 Iniciando teste de notificações Zapster WhatsApp...\n')
  
  // 1. Teste de conexão
  console.log('1️⃣ Testando conexão com Zapster API...')
  const connectionOk = await zapsterService.testConnection()
  if (connectionOk) {
    console.log('✅ Conexão com Zapster estabelecida!\n')
  } else {
    console.log('❌ Falha na conexão com Zapster\n')
    return
  }
  
  // 2. Teste de notificação de nova pergunta
  console.log('2️⃣ Testando notificação de nova pergunta...')
  const questionNotification = await zapsterService.sendQuestionNotification({
    sequentialId: 12345,
    questionText: 'Este produto está disponível para entrega imediata?',
    productTitle: 'iPhone 15 Pro Max 256GB',
    productPrice: 8999.90,
    productImage: 'https://http2.mlstatic.com/D_NQ_NP_2X_715237-MLM71782897253_092023-F.webp',
    suggestedAnswer: 'Olá! Sim, este produto está disponível para pronta entrega. Após a confirmação do pagamento, enviaremos em até 24 horas úteis. Qualquer dúvida, estou à disposição!',
    approvalUrl: 'https://gugaleo.axnexlabs.com.br/approve/test-123',
    customerName: 'João Silva',
    sellerName: 'ELITESAUDEANIMAL',
    organizationName: 'Elite Saúde Animal'
  })
  
  if (questionNotification) {
    console.log('✅ Notificação de pergunta enviada com sucesso!\n')
  } else {
    console.log('❌ Falha ao enviar notificação de pergunta\n')
  }
  
  // Aguardar 3 segundos antes do próximo teste
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  // 3. Teste de notificação de confirmação
  console.log('3️⃣ Testando notificação de confirmação de resposta...')
  const confirmationNotification = await zapsterService.sendApprovalConfirmation({
    sequentialId: 12345,
    questionText: 'Este produto está disponível para entrega imediata?',
    finalAnswer: 'Olá! Sim, temos o produto em estoque. Enviamos em 24h após o pagamento. Abraços!',
    productTitle: 'iPhone 15 Pro Max 256GB',
    sellerName: 'ELITESAUDEANIMAL',
    approved: true
  })
  
  if (confirmationNotification) {
    console.log('✅ Notificação de confirmação enviada com sucesso!\n')
  } else {
    console.log('❌ Falha ao enviar notificação de confirmação\n')
  }
  
  // 4. Teste de notificação de erro
  console.log('4️⃣ Testando notificação de erro...')
  const errorNotification = await zapsterService.sendErrorNotification(
    12346,
    'Erro ao enviar resposta: Token expirado',
    'https://gugaleo.axnexlabs.com.br/retry/test-456'
  )
  
  if (errorNotification) {
    console.log('✅ Notificação de erro enviada com sucesso!\n')
  } else {
    console.log('❌ Falha ao enviar notificação de erro\n')
  }
  
  // 5. Teste de métricas diárias
  console.log('5️⃣ Testando notificação de métricas diárias...')
  const metricsNotification = await zapsterService.sendDailyMetrics({
    totalQuestions: 150,
    answeredQuestions: 148,
    responseTime: '12 minutos',
    approvalRate: 95.5
  })
  
  if (metricsNotification) {
    console.log('✅ Notificação de métricas enviada com sucesso!\n')
  } else {
    console.log('❌ Falha ao enviar notificação de métricas\n')
  }
  
  console.log('🎉 Teste completo! Verifique o grupo do WhatsApp para ver as mensagens.')
}

// Executar teste
testZapsterNotifications().catch(console.error)
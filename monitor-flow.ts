#!/usr/bin/env npx tsx

/**
 * Script de Monitoramento em Tempo Real do Fluxo Completo
 * Desde o webhook do ML até a aprovação e envio da resposta
 */

import { prisma } from './lib/prisma'
import { Redis } from 'ioredis'
import chalk from 'chalk'
import ora from 'ora'

// Configuração
const redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379')
const CHECK_INTERVAL = 1000 // 1 segundo

interface FlowState {
  webhookReceived: boolean
  questionProcessed: boolean
  questionSaved: boolean
  sentToN8N: boolean
  aiResponseReceived: boolean
  whatsappSent: boolean
  awaitingApproval: boolean
  approved: boolean
  sentToML: boolean
  completed: boolean
}

class FlowMonitor {
  private mlQuestionId: string | null = null
  private questionId: string | null = null
  private startTime: number = Date.now()
  private state: FlowState = {
    webhookReceived: false,
    questionProcessed: false,
    questionSaved: false,
    sentToN8N: false,
    aiResponseReceived: false,
    whatsappSent: false,
    awaitingApproval: false,
    approved: false,
    sentToML: false,
    completed: false
  }
  private spinner: any = null
  private redisSubscriber: Redis | null = null
  private checkInterval: NodeJS.Timeout | null = null

  async start() {
    console.clear()
    console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════════════════╗
║     🚀 ML AGENT - MONITOR DE FLUXO EM TEMPO REAL 🚀     ║
╚══════════════════════════════════════════════════════════╝
`))

    console.log(chalk.yellow('📋 Instruções:'))
    console.log(chalk.white('1. Faça uma pergunta em um anúncio no Mercado Livre'))
    console.log(chalk.white('2. O monitor irá detectar e acompanhar todo o fluxo'))
    console.log(chalk.white('3. Aprove a resposta quando chegar'))
    console.log(chalk.white('4. Veja o fluxo completo até o envio ao ML\n'))

    this.spinner = ora({
      text: 'Aguardando nova pergunta do Mercado Livre...',
      spinner: 'dots'
    }).start()

    // Conectar ao Redis para monitorar eventos
    this.redisSubscriber = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379')

    // Inscrever em todos os canais relevantes
    await this.redisSubscriber.psubscribe('sse:events', 'webhook:*', 'question:*')

    this.redisSubscriber.on('pmessage', (_pattern, channel, message) => {
      try {
        const data = JSON.parse(message)
        this.handleRedisEvent(channel, data)
      } catch (err) {
        // Ignorar erros de parse
      }
    })

    // Iniciar monitoramento do banco
    this.startDatabaseMonitoring()

    // Monitorar logs de webhook
    this.monitorWebhookEvents()

    // Aguardar Ctrl+C
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
  }

  private handleRedisEvent(_channel: string, data: any) {
    // Detectar nova pergunta
    if (data.type === 'question:new' && !this.mlQuestionId) {
      this.mlQuestionId = data.data?.mlQuestionId
      this.questionId = data.data?.id || data.data?.questionId
      this.state.webhookReceived = true
      this.state.questionProcessed = true
      this.state.questionSaved = true
      this.updateDisplay(`Nova pergunta detectada: ${this.mlQuestionId}`)
    }

    // Detectar resposta da IA
    if (data.type === 'question:answered' && data.data?.mlQuestionId === this.mlQuestionId) {
      this.state.aiResponseReceived = true
      this.state.awaitingApproval = true
      this.updateDisplay(`Resposta da IA recebida!`)
    }
  }

  private async startDatabaseMonitoring() {
    this.checkInterval = setInterval(async () => {
      if (!this.mlQuestionId && !this.questionId) {
        // Buscar última pergunta criada nos últimos 10 segundos
        const latestQuestion = await prisma.question.findFirst({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 10000)
            }
          },
          orderBy: { createdAt: 'desc' },
          include: { mlAccount: true }
        })

        if (latestQuestion) {
          this.mlQuestionId = latestQuestion.mlQuestionId
          this.questionId = latestQuestion.id
          this.state.webhookReceived = true
          this.state.questionProcessed = true
          this.state.questionSaved = true
          this.updateDisplay(`Nova pergunta detectada: ${this.mlQuestionId}`)
        }
      }

      // Monitorar status da pergunta
      if (this.mlQuestionId) {
        const question = await prisma.question.findUnique({
          where: { mlQuestionId: this.mlQuestionId },
          include: { mlAccount: true }
        })

        if (question) {
          // Verificar cada etapa
          if (question.status === 'PROCESSING' && !this.state.sentToN8N) {
            this.state.sentToN8N = true
            this.updateDisplay('Pergunta enviada para processamento N8N')
          }

          if (question.aiSuggestion && !this.state.aiResponseReceived) {
            this.state.aiResponseReceived = true
            this.updateDisplay(`IA respondeu: "${question.aiSuggestion.substring(0, 50)}..."`)
          }

          if (question.status === 'AWAITING_APPROVAL' && !this.state.awaitingApproval) {
            this.state.awaitingApproval = true
            this.state.whatsappSent = true
            this.updateDisplay('Aguardando aprovação humana')
          }

          if (question.status === 'COMPLETED' && !this.state.approved) {
            this.state.approved = true
            this.updateDisplay('Pergunta aprovada!')
          }

          if (question.sentToMLAt && !this.state.sentToML) {
            this.state.sentToML = true
            this.state.completed = true
            this.updateDisplay('Resposta enviada ao Mercado Livre!')
            this.showCompletionSummary(question)
          }

          if (question.status === 'FAILED') {
            this.updateDisplay(`❌ Erro: ${question.failureReason}`)
          }
        }
      }
    }, CHECK_INTERVAL)
  }

  private async monitorWebhookEvents() {
    // Monitorar tabela WebhookEvent
    setInterval(async () => {
      if (!this.mlQuestionId) {
        const latestWebhook = await prisma.webhookEvent.findFirst({
          where: {
            eventType: 'questions',
            createdAt: {
              gte: new Date(Date.now() - 10000)
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        if (latestWebhook && !this.state.webhookReceived) {
          this.state.webhookReceived = true
          this.updateDisplay(`Webhook recebido: ${latestWebhook.resourceId}`)
        }
      }
    }, 500)
  }

  private updateDisplay(message: string) {
    if (this.spinner) {
      this.spinner.stop()
    }

    console.clear()
    console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════════════════╗
║     🚀 ML AGENT - MONITOR DE FLUXO EM TEMPO REAL 🚀     ║
╚══════════════════════════════════════════════════════════╝
`))

    // Mostrar progresso
    console.log(chalk.white.bold('\n📊 Progresso do Fluxo:\n'))

    const steps = [
      { name: '📥 Webhook Recebido', done: this.state.webhookReceived },
      { name: '🔍 Pergunta Processada', done: this.state.questionProcessed },
      { name: '💬 Pergunta Salva', done: this.state.questionSaved },
      { name: '📤 Enviado para N8N', done: this.state.sentToN8N },
      { name: '🤖 Resposta da IA', done: this.state.aiResponseReceived },
      { name: '📱 WhatsApp Enviado', done: this.state.whatsappSent },
      { name: '👀 Aguardando Aprovação', done: this.state.awaitingApproval },
      { name: '✅ Aprovado', done: this.state.approved },
      { name: '📬 Enviado ao ML', done: this.state.sentToML },
      { name: '🎯 Completo!', done: this.state.completed }
    ]

    steps.forEach((step) => {
      const prefix = step.done ? chalk.green('✓') : chalk.gray('○')
      const text = step.done ? chalk.green(step.name) : chalk.gray(step.name)
      console.log(`  ${prefix} ${text}`)
    })

    // Mostrar IDs
    if (this.mlQuestionId) {
      console.log(chalk.white.bold('\n📋 Informações:\n'))
      console.log(`  ${chalk.cyan('ML Question ID:')} ${this.mlQuestionId}`)
      if (this.questionId) {
        console.log(`  ${chalk.cyan('Internal ID:')} ${this.questionId}`)
      }
    }

    // Tempo decorrido
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    console.log(`\n  ${chalk.yellow('⏱️ Tempo decorrido:')} ${minutes}m ${seconds}s`)

    // Última mensagem
    console.log(`\n  ${chalk.magenta('📝 Última atualização:')} ${message}\n`)

    // Reiniciar spinner se não completou
    if (!this.state.completed) {
      this.spinner = ora({
        text: 'Monitorando fluxo...',
        spinner: 'dots'
      }).start()
    }
  }

  private async showCompletionSummary(question: any) {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60

    console.log(chalk.green.bold(`
╔══════════════════════════════════════════════════════════╗
║                   ✅ FLUXO COMPLETO! ✅                  ║
╚══════════════════════════════════════════════════════════╝
`))

    console.log(chalk.white.bold('📊 Resumo do Fluxo:\n'))
    console.log(`  ${chalk.cyan('Pergunta:')} ${question.text.substring(0, 60)}...`)
    console.log(`  ${chalk.cyan('Resposta:')} ${question.answer?.substring(0, 60)}...`)
    console.log(`  ${chalk.cyan('Produto:')} ${question.itemTitle}`)
    console.log(`  ${chalk.cyan('Preço:')} R$ ${question.itemPrice}`)
    console.log(`  ${chalk.cyan('Conta ML:')} ${question.mlAccount?.nickname}`)
    console.log(`  ${chalk.cyan('Status:')} ${chalk.green('COMPLETED')}`)
    console.log(`  ${chalk.cyan('Tempo total:')} ${chalk.yellow(`${minutes}m ${seconds}s`)}`)

    console.log(chalk.green.bold('\n🎉 Parabéns! Fluxo executado com sucesso!\n'))

    // Limpar e sair
    setTimeout(() => this.cleanup(), 5000)
  }

  private async cleanup() {
    console.log(chalk.yellow('\n\n👋 Encerrando monitor...'))

    if (this.spinner) {
      this.spinner.stop()
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    if (this.redisSubscriber) {
      await this.redisSubscriber.quit()
    }

    await redis.quit()
    await prisma.$disconnect()

    process.exit(0)
  }
}

// Iniciar monitor
const monitor = new FlowMonitor()
monitor.start().catch(error => {
  console.error(chalk.red('❌ Erro ao iniciar monitor:'), error)
  process.exit(1)
})
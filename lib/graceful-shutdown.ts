/**
 * Graceful Shutdown Handler
 * Garante que todas as conexões sejam fechadas corretamente
 */

import { logger } from './logger'
import { prisma } from './prisma'
import { Redis } from 'ioredis'

type ShutdownHandler = () => Promise<void>

class GracefulShutdownManager {
  private static instance: GracefulShutdownManager
  private handlers: Map<string, ShutdownHandler> = new Map()
  private isShuttingDown = false
  private shutdownTimeout = 30000 // 30 segundos máximo
  private server: any = null
  private redisClient: Redis | null = null

  private constructor() {
    this.setupSignalHandlers()
  }

  static getInstance(): GracefulShutdownManager {
    if (!GracefulShutdownManager.instance) {
      GracefulShutdownManager.instance = new GracefulShutdownManager()
    }
    return GracefulShutdownManager.instance
  }

  /**
   * Registra um handler de shutdown
   */
  register(name: string, handler: ShutdownHandler): void {
    this.handlers.set(name, handler)
    logger.info(`[Shutdown] Registered handler: ${name}`)
  }

  /**
   * Remove um handler de shutdown
   */
  unregister(name: string): void {
    this.handlers.delete(name)
  }

  /**
   * Define o servidor HTTP para shutdown gracioso
   */
  setServer(server: any): void {
    this.server = server
  }

  /**
   * Define o cliente Redis para shutdown
   */
  setRedisClient(client: Redis): void {
    this.redisClient = client
  }

  /**
   * Configura os signal handlers
   */
  private setupSignalHandlers(): void {
    // Graceful shutdown on SIGTERM (Kubernetes, PM2)
    process.on('SIGTERM', () => {
      logger.info('[Shutdown] SIGTERM received')
      this.shutdown('SIGTERM')
    })

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('[Shutdown] SIGINT received')
      this.shutdown('SIGINT')
    })

    // Graceful shutdown on SIGUSR2 (PM2 reload)
    process.on('SIGUSR2', () => {
      logger.info('[Shutdown] SIGUSR2 received (PM2 reload)')
      this.shutdown('SIGUSR2')
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('[Shutdown] Uncaught exception', { error })
      this.shutdown('UNCAUGHT_EXCEPTION', 1)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('[Shutdown] Unhandled rejection', { reason, promise })
      // Don't exit immediately for rejections, just log
    })

    // PM2 specific shutdown message
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        logger.info('[Shutdown] PM2 shutdown message received')
        this.shutdown('PM2_SHUTDOWN')
      }
    })
  }

  /**
   * Executa o shutdown gracioso
   */
  async shutdown(signal: string, exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('[Shutdown] Already shutting down, ignoring signal')
      return
    }

    this.isShuttingDown = true
    logger.info(`[Shutdown] Starting graceful shutdown (signal: ${signal})`)

    // Timeout forçado se o shutdown demorar muito
    const forceExitTimeout = setTimeout(() => {
      logger.error('[Shutdown] Forced exit after timeout')
      process.exit(exitCode)
    }, this.shutdownTimeout)

    try {
      // 1. Para de aceitar novas conexões HTTP
      if (this.server) {
        logger.info('[Shutdown] Closing HTTP server...')
        await new Promise<void>((resolve, reject) => {
          this.server.close((err?: Error) => {
            if (err) {
              logger.error('[Shutdown] Error closing HTTP server', { error: err })
              reject(err)
            } else {
              logger.info('[Shutdown] HTTP server closed')
              resolve()
            }
          })
        })
      }

      // 2. Executa handlers customizados em paralelo
      const handlerPromises = Array.from(this.handlers.entries()).map(
        async ([name, handler]) => {
          try {
            logger.info(`[Shutdown] Running handler: ${name}`)
            await handler()
            logger.info(`[Shutdown] Handler completed: ${name}`)
          } catch (_error) {
            logger.error(`[Shutdown] Handler failed: ${name}`, { error: _error })
          }
        }
      )

      await Promise.all(handlerPromises)

      // 3. Fecha conexão com banco de dados
      logger.info('[Shutdown] Closing database connections...')
      try {
        await prisma.$disconnect()
        logger.info('[Shutdown] Database disconnected')
      } catch (_error) {
        logger.error('[Shutdown] Error disconnecting database', { error: _error })
      }

      // 4. Fecha conexão Redis se existir
      if (this.redisClient) {
        logger.info('[Shutdown] Closing Redis connection...')
        try {
          await this.redisClient.quit()
          logger.info('[Shutdown] Redis disconnected')
        } catch (_error) {
          logger.error('[Shutdown] Error disconnecting Redis', { error: _error })
        }
      }

      // 5. Finaliza processos pendentes
      logger.info('[Shutdown] Waiting for pending operations...')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 6. Notifica PM2 que o processo está pronto para morrer
      if (process.send) {
        process.send('ready')
      }

      clearTimeout(forceExitTimeout)
      logger.info('[Shutdown] Graceful shutdown completed')
      process.exit(exitCode)

    } catch (_error) {
      logger.error('[Shutdown] Error during shutdown', { error: _error })
      clearTimeout(forceExitTimeout)
      process.exit(1)
    }
  }

  /**
   * Registra handlers padrão para recursos comuns
   */
  async registerDefaultHandlers(): Promise<void> {
    // Handler para fechar workers/jobs
    this.register('workers', async () => {
      // Implementar parada de workers se existirem
      logger.info('[Shutdown] Stopping background workers...')
      // await stopAllWorkers()
    })

    // Handler para flush de logs
    this.register('logs', async () => {
      logger.info('[Shutdown] Flushing logs...')
      // Garante que todos os logs sejam escritos
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    // Handler para limpar cache temporário
    this.register('cache', async () => {
      logger.info('[Shutdown] Clearing temporary cache...')
      // await clearTempCache()
    })

    // Handler para salvar métricas pendentes
    this.register('metrics', async () => {
      logger.info('[Shutdown] Saving pending metrics...')
      // await saveMetrics()
    })
  }
}

// Exporta singleton
export const shutdownManager = GracefulShutdownManager.getInstance()

// Registra handlers padrão automaticamente
shutdownManager.registerDefaultHandlers()

// Função helper para registrar um handler rapidamente
export function onShutdown(name: string, handler: ShutdownHandler): void {
  shutdownManager.register(name, handler)
}

// Função helper para remover um handler
export function offShutdown(name: string): void {
  shutdownManager.unregister(name)
}

export default shutdownManager
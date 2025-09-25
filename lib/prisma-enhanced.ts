/**
 * Prisma Enhanced Client - Production-Ready
 * Setembro 2025
 *
 * Solução definitiva para problemas de conexão e build
 */

import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

// Configuração de produção otimizada
const prismaClientSingleton = () => {
  // Durante build, retornar cliente minimal
  if (process.env['NEXT_PHASE'] === 'phase-production-build') {
    return new PrismaClient({
      datasources: {
        db: {
          url: process.env['DATABASE_URL'] || 'postgresql://user:pass@localhost:5432/db'
        }
      }
    })
  }

  // Em produção, configuração completa
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env['DATABASE_URL'] || 'postgresql://user:pass@localhost:5432/db'
      }
    },
    log: process.env['NODE_ENV'] === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error', 'warn'],
    errorFormat: 'minimal'
  })
}

// Type declaration for global
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// Singleton pattern
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

// Em desenvolvimento, preservar instância
if (process.env['NODE_ENV'] !== 'production') {
  globalThis.prismaGlobal = prisma
}

// Conectar apenas em runtime (não durante build)
if (process.env['NEXT_PHASE'] !== 'phase-production-build' &&
    process.env['NODE_ENV'] !== 'test') {

  // Conectar com retry
  const connectWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        await prisma.$connect()
        logger.info('[Prisma] Connected successfully')
        return
      } catch (error) {
        if (i === retries - 1) {
          logger.error('[Prisma] Failed to connect after retries:', { error })
          // Não lançar erro para não quebrar o build
          return
        }
        logger.warn(`[Prisma] Connection attempt ${i + 1} failed, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }

  connectWithRetry().catch(() => {
    // Ignorar erros de conexão durante build
  })
}

// Graceful shutdown
if (typeof process !== 'undefined' && process.env['NEXT_PHASE'] !== 'phase-production-build') {
  const gracefulShutdown = async () => {
    try {
      await prisma.$disconnect()
      logger.info('[Prisma] Disconnected gracefully')
    } catch (_error) {
      // Ignorar erros durante shutdown
    }
  }

  process.once('SIGINT', gracefulShutdown)
  process.once('SIGTERM', gracefulShutdown)
}

export { prisma }
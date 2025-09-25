/**
 * Prisma Client Singleton Otimizado
 * Production-ready com connection pooling
 * 100% compatível com código existente
 */

import { logger } from './logger'
import { PrismaClient, Prisma } from '@prisma/client'
import { ConnectionPoolOptimizer } from './database/connection-pool'

// Tipos globais para singleton
declare global {
  var __prisma: PrismaClient | undefined
  var __prismaPromise: Promise<PrismaClient> | undefined
}

// Configuração otimizada de connection pooling
const getDatabaseUrl = () => {
  const baseUrl = (typeof process !== 'undefined' ? process.env['DATABASE_URL'] : undefined) ||
                  "postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public"

  // Otimizar URL em produção
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return ConnectionPoolOptimizer.optimizeConnectionUrl(baseUrl)
  }

  return baseUrl
}

const prismaClientOptions: Prisma.PrismaClientOptions = {
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  },
  log: (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')
    ? ['query' as Prisma.LogLevel, 'error' as Prisma.LogLevel, 'warn' as Prisma.LogLevel]
    : ['error' as Prisma.LogLevel],
}

// Factory function para criar o cliente
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient(prismaClientOptions)
  
  // NOTA: RLS será ativado via secure-prisma.ts com transações
  // Remover logs durante inicialização para evitar problemas no build
  
  // Configurar event handlers apenas em ambiente Node.js
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.once) {
    const globalWithPrisma = global as typeof globalThis & {
      __prisma?: PrismaClient
    }
    
    if (!globalWithPrisma.__prisma) {
      // Inicialização silenciosa durante build
      
      // Graceful shutdown
      const shutdownHandlers = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const
      shutdownHandlers.forEach(signal => {
        process.once(signal, async () => {
          if (process.env['NODE_ENV'] !== 'test' && process.env['NEXT_PHASE'] !== 'phase-production-build') {
            logger.info(`[Prisma Singleton] Received ${signal}, disconnecting...`)
          }
          await client.$disconnect().catch(() => {})
        })
      })
      
      // Cleanup on process exit
      process.once('beforeExit', async () => {
        await client.$disconnect()
      })
    }
  }
  
  return client
}

// Singleton instance com lazy loading mais seguro
let prismaInstance: PrismaClient | undefined

// Export principal - lazy mas sem Proxy complexo
export const prisma = (() => {
  if (typeof window !== 'undefined') {
    throw new Error('Prisma Client cannot be used in the browser')
  }

  // Durante build, criar cliente básico sem conectar
  if (typeof process !== 'undefined' &&
      (process.env['NEXT_PHASE'] === 'phase-production-build' ||
       process.env['BUILDING'] === 'true')) {
    // Retornar cliente sem conexão para build
    return new PrismaClient({
      datasources: {
        db: {
          url: process.env['DATABASE_URL'] || 'postgresql://user:pass@localhost:5432/db'
        }
      },
      log: [] // Sem logs durante build
    })
  }

  // Produção e desenvolvimento
  if (!prismaInstance) {
    if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production') {
      // Development: usa global para hot reload
      const globalWithPrisma = global as typeof globalThis & {
        __prisma?: PrismaClient
      }

      if (!globalWithPrisma.__prisma) {
        globalWithPrisma.__prisma = createPrismaClient()
      }
      prismaInstance = globalWithPrisma.__prisma
    } else {
      // Production: cria singleton
      prismaInstance = createPrismaClient()
    }
  }

  return prismaInstance
})()

// Função helper para garantir conexão
export async function ensurePrismaConnection(): Promise<void> {
  try {
    await prisma.$connect()
    if (process.env['NODE_ENV'] !== 'test' && process.env['NEXT_PHASE'] !== 'phase-production-build') {
      logger.info('[Prisma Singleton] Database connected successfully')
    }
  } catch (_error) {
    if (process.env['NODE_ENV'] !== 'test' && process.env['NEXT_PHASE'] !== 'phase-production-build') {
      logger.error('[Prisma Singleton] Failed to connect to database:', { error: _error })
    }
    throw _error
  }
}

// Função para obter métricas (útil para monitoring)
export async function getPrismaMetrics() {
  try {
    // Por enquanto, retornar métricas básicas
    // $metrics não está disponível no Prisma 5+
    return {
      success: true,
      metrics: {
        connections: 'active',
        status: 'healthy'
      }
    }
  } catch (_error) {
    return {
      success: false,
      error: 'Metrics not available'
    }
  }
}

// Função helper para health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

// Re-export types para compatibilidade
export type { PrismaClient } from '@prisma/client'
export { Prisma } from '@prisma/client'

// Singleton stats para debug - apenas em Node.js
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  setInterval(async () => {
    const metrics = await getPrismaMetrics()
    if (metrics.success) {
      logger.debug('[Prisma Singleton] Metrics:', metrics.metrics)
    }
  }, 60000) // A cada 1 minuto em dev
}
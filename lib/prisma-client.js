/**
 * Prisma Client for Queue Worker
 * Simple client for JavaScript workers
 */

const { PrismaClient } = require('@prisma/client')

// Create a singleton instance
let prismaInstance = null

function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || "postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public"
        }
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    })
  }
  return prismaInstance
}

// Export the singleton
const prisma = getPrismaClient()

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    if (prismaInstance) {
      await prismaInstance.$disconnect()
      console.log('[Prisma] Connection closed')
    }
  })

  process.on('SIGINT', async () => {
    if (prismaInstance) {
      await prismaInstance.$disconnect()
      console.log('[Prisma] Connection closed')
    }
  })
}

module.exports = { prisma }
import { PrismaClient } from "@prisma/client"

// FORCE correct database URL - fixing authentication issue
const DATABASE_URL = "postgresql://mlagent:nandao10@localhost:5432/mlagent_db?schema=public"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Debug log
if (typeof window === 'undefined') {
  console.log('[Prisma] Initialized with database:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'))
}
/**
 * Prisma Client Export
 * Usa o singleton otimizado para evitar múltiplas conexões
 * Mantém compatibilidade com imports existentes
 */

// Re-export do singleton para manter compatibilidade
export { prisma, Prisma, type PrismaClient } from './prisma-singleton'
export { ensurePrismaConnection, checkDatabaseHealth, getPrismaMetrics } from './prisma-singleton'
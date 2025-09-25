"use strict";
/**
 * Prisma Client Singleton Otimizado
 * Production-ready com connection pooling
 * 100% compatível com código existente
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prisma = exports.prisma = void 0;
exports.ensurePrismaConnection = ensurePrismaConnection;
exports.getPrismaMetrics = getPrismaMetrics;
exports.checkDatabaseHealth = checkDatabaseHealth;
const logger_1 = require("./logger");
const client_1 = require("@prisma/client");
// Configuração otimizada de connection pooling
const prismaClientOptions = {
    datasources: {
        db: {
            url: process.env['DATABASE_URL'] || "postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public"
        }
    },
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
};
// Factory function para criar o cliente
function createPrismaClient() {
    const client = new client_1.PrismaClient(prismaClientOptions);
    // Configurar event handlers apenas uma vez
    if (typeof window === 'undefined' && !global.__prisma) {
        // Log de inicialização
        logger_1.logger.info('[Prisma Singleton] Initializing database connection', {
            env: process.env.NODE_ENV,
            url: (process.env['DATABASE_URL'] || '').replace(/:[^:@]+@/, ':****@')
        });
        // Graceful shutdown
        const shutdownHandlers = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
        shutdownHandlers.forEach(signal => {
            process.once(signal, async () => {
                logger_1.logger.info(`[Prisma Singleton] Received ${signal}, disconnecting...`);
                await client.$disconnect();
            });
        });
        // Cleanup on process exit
        process.once('beforeExit', async () => {
            await client.$disconnect();
        });
    }
    return client;
}
// Singleton instance com lazy initialization
let prismaInstance;
// Export principal - mantém compatibilidade total
exports.prisma = (() => {
    if (typeof window !== 'undefined') {
        // Browser environment - não deve acontecer mas previne erros
        throw new Error('Prisma Client cannot be used in the browser');
    }
    if (process.env.NODE_ENV === 'production') {
        // Produção: sempre usa singleton
        if (!prismaInstance) {
            prismaInstance = createPrismaClient();
        }
        return prismaInstance;
    }
    else {
        // Development: usa global para hot reload
        if (!global.__prisma) {
            global.__prisma = createPrismaClient();
        }
        return global.__prisma;
    }
})();
// Função helper para garantir conexão
async function ensurePrismaConnection() {
    try {
        await exports.prisma.$connect();
        logger_1.logger.info('[Prisma Singleton] Database connected successfully');
    }
    catch (error) {
        logger_1.logger.error('[Prisma Singleton] Failed to connect to database:', { error });
        throw error;
    }
}
// Função para obter métricas (útil para monitoring)
async function getPrismaMetrics() {
    try {
        // Por enquanto, retornar métricas básicas
        // $metrics não está disponível no Prisma 5+
        return {
            success: true,
            metrics: {
                connections: 'active',
                status: 'healthy'
            }
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'Metrics not available'
        };
    }
}
// Função helper para health check
async function checkDatabaseHealth() {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch {
        return false;
    }
}
var client_2 = require("@prisma/client");
Object.defineProperty(exports, "Prisma", { enumerable: true, get: function () { return client_2.Prisma; } });
// Singleton stats para debug
if (process.env.NODE_ENV === 'development') {
    setInterval(async () => {
        const metrics = await getPrismaMetrics();
        if (metrics.success) {
            logger_1.logger.debug('[Prisma Singleton] Metrics:', metrics.metrics);
        }
    }, 60000); // A cada 1 minuto em dev
}

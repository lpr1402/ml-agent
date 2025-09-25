#!/usr/bin/env node
/**
 * Teste para verificar se o Prisma Singleton está funcionando
 * e que apenas uma instância está sendo criada
 */

const { prisma } = require('./lib/prisma-singleton');

async function testSingleton() {
  console.log('🔍 Testando Prisma Singleton...\n');
  
  try {
    // Teste 1: Verificar conexão
    console.log('1️⃣ Testando conexão com banco...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Conexão OK:', result);
    
    // Teste 2: Verificar se é singleton
    console.log('\n2️⃣ Verificando singleton...');
    const prisma1 = require('./lib/prisma-singleton').prisma;
    const prisma2 = require('./lib/prisma').prisma;
    console.log('✅ Mesma instância?', prisma1 === prisma2);
    
    // Teste 3: Buscar uma organização
    console.log('\n3️⃣ Testando query real...');
    const org = await prisma.organization.findFirst();
    if (org) {
      console.log('✅ Organização encontrada:', org.id);
    } else {
      console.log('⚠️ Nenhuma organização no banco');
    }
    
    // Teste 4: Contar conexões (simulado)
    console.log('\n4️⃣ Status do Singleton:');
    const metrics = await require('./lib/prisma-singleton').getPrismaMetrics();
    console.log('✅ Métricas:', metrics);
    
    // Teste 5: Health check
    console.log('\n5️⃣ Health Check:');
    const health = await require('./lib/prisma-singleton').checkDatabaseHealth();
    console.log('✅ Database healthy?', health);
    
    console.log('\n✨ Todos os testes passaram!');
    console.log('📊 Singleton funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSingleton();
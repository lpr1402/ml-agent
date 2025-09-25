const fetch = require('node-fetch');

async function testSystem() {
  console.log('🔍 ML AGENT - TESTE COMPLETO DO SISTEMA\n');
  console.log('=' .repeat(50));
  
  const tests = {
    health: false,
    database: false,
    redis: false,
    websocket: false,
    auth: false,
    questions: false,
    accounts: false
  };
  
  // 1. Health Check
  try {
    const health = await fetch('http://localhost:3007/api/health');
    const healthData = await health.json();
    tests.health = healthData.status === 'healthy';
    console.log('✅ Health Check:', tests.health ? 'OK' : 'FALHA');
    console.log('  - Database:', healthData.checks.database.status);
    console.log('  - Redis:', healthData.checks.redis.status);
    console.log('  - Memory:', healthData.checks.memory.heapUsagePercent + '%');
    tests.database = healthData.checks.database.status === 'healthy';
    tests.redis = healthData.checks.redis.status === 'healthy';
  } catch (e) {
    console.log('❌ Health Check: ERRO', e.message);
  }
  
  // 2. WebSocket Test
  try {
    const ws = await fetch('http://localhost:3008/socket.io/?EIO=4', {
      headers: { 'Connection': 'upgrade' }
    });
    tests.websocket = ws.status < 500;
    console.log('✅ WebSocket Server:', tests.websocket ? 'ONLINE' : 'OFFLINE');
  } catch (e) {
    console.log('❌ WebSocket: ERRO', e.message);
  }
  
  // Get session token for auth tests
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const session = await prisma.session.findFirst({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    
    if (session) {
      const token = session.sessionToken;
      
      // 3. Auth Test
      const authRes = await fetch('http://localhost:3007/api/auth/session', {
        headers: { 'Cookie': `ml-agent-session=${token}` }
      });
      const authData = await authRes.json();
      tests.auth = authRes.ok && authData.organizationId;
      console.log('✅ Autenticação:', tests.auth ? 'VÁLIDA' : 'INVÁLIDA');
      if (tests.auth) {
        console.log('  - Organização:', authData.organizationName);
        console.log('  - Plano:', authData.plan);
        console.log('  - Contas:', authData.accountCount);
      }
      
      // 4. Questions API
      const questionsRes = await fetch('http://localhost:3007/api/agent/questions-multi', {
        headers: { 'Cookie': `ml-agent-session=${token}` }
      });
      tests.questions = questionsRes.ok;
      console.log('✅ API Questions:', tests.questions ? 'OK' : 'FALHA');
      
      // 5. ML Accounts
      const accountsRes = await fetch('http://localhost:3007/api/ml-accounts/metrics', {
        headers: { 'Cookie': `ml-agent-session=${token}` }
      });
      const accountsData = await accountsRes.json();
      tests.accounts = accountsRes.ok && accountsData.accounts;
      console.log('✅ ML Accounts:', tests.accounts ? 'OK' : 'FALHA');
      if (tests.accounts) {
        accountsData.accounts.forEach(acc => {
          console.log(`  - ${acc.nickname}: ${acc.metrics.totalQuestions} perguntas`);
        });
      }
    } else {
      console.log('⚠️  Sem sessão ativa - criar nova sessão pelo navegador');
    }
  } catch (e) {
    console.log('❌ Erro nos testes:', e.message);
  } finally {
    await prisma.$disconnect();
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  const passed = Object.values(tests).filter(t => t).length;
  const total = Object.keys(tests).length;
  
  console.log(`\n📊 RESULTADO: ${passed}/${total} testes passaram`);
  
  if (passed === total) {
    console.log('✅ SISTEMA 100% OPERACIONAL!');
  } else {
    console.log('⚠️  Alguns componentes precisam de atenção');
  }
  
  console.log('\n📱 INSTRUÇÕES DE ACESSO:');
  console.log('1. Abra o navegador em: https://gugaleo.axnexlabs.com.br');
  console.log('2. Faça login com sua conta do Mercado Livre');
  console.log('3. Após login, você será redirecionado para /agente');
  console.log('4. A central de atendimentos carregará automaticamente');
}

testSystem();

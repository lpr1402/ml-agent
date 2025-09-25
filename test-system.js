/**
 * Script de teste do sistema ML Agent
 * Verifica se todas as funcionalidades estão operacionais
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testSystem() {
  console.log('🔍 INICIANDO TESTES DO SISTEMA ML AGENT\n')
  
  const results = {
    database: false,
    schema: false,
    organization: false,
    questions: false,
    total: 0
  }
  
  try {
    // 1. Testar conexão com banco
    console.log('1️⃣ Testando conexão com banco de dados...')
    await prisma.$connect()
    results.database = true
    console.log('✅ Banco de dados conectado\n')
    
    // 2. Verificar schema
    console.log('2️⃣ Verificando schema do Prisma...')
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
    
    const requiredTables = ['Organization', 'MLAccount', 'Question', 'Session']
    // Prisma pode criar em minúsculas
    const requiredTablesLower = ['organization', 'mlaccount', 'question', 'session']
    const tableNames = tables.map(t => t.table_name)
    const hasAllTables = requiredTables.every(t => tableNames.includes(t))
    
    if (hasAllTables) {
      results.schema = true
      console.log('✅ Schema está correto')
      console.log(`   Tabelas encontradas: ${tableNames.length}`)
    } else {
      console.log('❌ Schema incompleto')
      console.log(`   Faltando: ${requiredTables.filter(t => !tableNames.includes(t))}`)
    }
    console.log()
    
    // 3. Verificar campos da tabela Question
    console.log('3️⃣ Verificando campos da tabela Question...')
    const questionColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Question'
    `
    
    const requiredFields = [
      'receivedAt', 'sentToMLAt', 'aiProcessedAt', 
      'approvalType', 'failedAt', 'itemPrice', 'itemPermalink'
    ]
    
    const columnNames = questionColumns.map(c => c.column_name)
    const hasAllFields = requiredFields.every(f => columnNames.includes(f))
    
    if (hasAllFields) {
      results.questions = true
      console.log('✅ Todos os campos necessários existem')
      console.log(`   Total de campos: ${columnNames.length}`)
    } else {
      const missing = requiredFields.filter(f => !columnNames.includes(f))
      console.log('❌ Campos faltando:', missing)
    }
    console.log()
    
    // 4. Criar organização de teste
    console.log('4️⃣ Testando criação de organização...')
    try {
      const org = await prisma.organization.create({
        data: {
          subscriptionStatus: 'TRIAL'
        }
      })
      results.organization = true
      console.log('✅ Organização criada:', org.id)
      
      // Limpar teste
      await prisma.organization.delete({ where: { id: org.id } })
      console.log('   Organização de teste removida')
    } catch (error) {
      console.log('❌ Erro ao criar organização:', error.message)
    }
    console.log()
    
  } catch (error) {
    console.error('❌ Erro no teste:', error)
  } finally {
    await prisma.$disconnect()
  }
  
  // Calcular pontuação
  const passed = Object.values(results).filter(r => r === true).length
  const total = Object.keys(results).length - 1 // -1 para excluir 'total'
  const score = Math.round((passed / total) * 100)
  
  console.log('═══════════════════════════════════════')
  console.log('📊 RESULTADO DOS TESTES')
  console.log('═══════════════════════════════════════')
  console.log(`Database:      ${results.database ? '✅' : '❌'}`)
  console.log(`Schema:        ${results.schema ? '✅' : '❌'}`)
  console.log(`Questions:     ${results.questions ? '✅' : '❌'}`)
  console.log(`Organization:  ${results.organization ? '✅' : '❌'}`)
  console.log('═══════════════════════════════════════')
  console.log(`PONTUAÇÃO FINAL: ${score}/100`)
  
  if (score === 100) {
    console.log('\n🎉 SISTEMA 100% FUNCIONAL!')
  } else if (score >= 75) {
    console.log('\n⚠️ Sistema funcional mas precisa ajustes')
  } else {
    console.log('\n❌ Sistema precisa correções críticas')
  }
}

// Executar teste
testSystem().catch(console.error)
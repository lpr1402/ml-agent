/**
 * Testar TODOS os períodos do gráfico
 */

import { prisma } from './lib/prisma'

async function testAllPeriods() {
  console.log('🔍 TESTANDO TODOS OS PERÍODOS DO GRÁFICO\n')

  const now = new Date()

  // Test 24h
  console.log('📊 PERÍODO: 24h (Últimas 24 horas)')
  let total = 0
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now)
    hourStart.setHours(now.getHours() - i, 0, 0, 0)
    const hourEnd = new Date(hourStart)
    hourEnd.setHours(hourStart.getHours() + 1, 0, 0, 0)

    const count = await prisma.question.count({
      where: {
        receivedAt: { gte: hourStart, lt: hourEnd }
      }
    })
    if (count > 0) {
      console.log(`  ${hourStart.getHours()}h: ${count} perguntas`)
      total += count
    }
  }
  console.log(`✅ Total 24h: ${total} perguntas\n`)

  // Test 30d
  console.log('📊 PERÍODO: 30d (Últimos 30 dias)')
  total = 0
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now)
    dayStart.setDate(now.getDate() - i)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayStart.getDate() + 1)

    const count = await prisma.question.count({
      where: {
        receivedAt: { gte: dayStart, lt: dayEnd }
      }
    })
    if (count > 0) {
      console.log(`  ${dayStart.getDate()}/${dayStart.getMonth() + 1}: ${count} perguntas`)
      total += count
    }
  }
  console.log(`✅ Total 30d: ${total} perguntas\n`)

  // Test ALL
  console.log('📊 PERÍODO: ALL (Desde a criação)')
  const firstQuestion = await prisma.question.findFirst({
    orderBy: { receivedAt: 'asc' },
    select: { receivedAt: true }
  })

  if (firstQuestion) {
    const firstDate = new Date(firstQuestion.receivedAt)
    console.log(`  Primeira pergunta: ${firstDate.toLocaleDateString('pt-BR')}`)

    const firstMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    let monthsCount = 0
    let tempDate = new Date(firstMonth)
    while (tempDate <= currentMonth) {
      monthsCount++
      tempDate.setMonth(tempDate.getMonth() + 1)
    }

    console.log(`  Meses de história: ${monthsCount}`)
    console.log(`  Dados por mês:`)

    total = 0
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    tempDate = new Date(firstMonth)

    for (let i = 0; i < monthsCount; i++) {
      const monthStart = new Date(tempDate)
      monthStart.setHours(0, 0, 0, 0)
      const monthEnd = new Date(tempDate)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(0)
      monthEnd.setHours(23, 59, 59, 999)

      const count = await prisma.question.count({
        where: {
          receivedAt: { gte: monthStart, lte: monthEnd }
        }
      })

      if (count > 0) {
        console.log(`    ${months[monthStart.getMonth()]} ${monthStart.getFullYear()}: ${count} perguntas`)
        total += count
      }

      tempDate.setMonth(tempDate.getMonth() + 1)
    }

    console.log(`✅ Total ALL: ${total} perguntas`)
  } else {
    console.log('  ⚠️ Nenhuma pergunta no sistema ainda')
  }

  await prisma.$disconnect()
}

testAllPeriods().catch(console.error)

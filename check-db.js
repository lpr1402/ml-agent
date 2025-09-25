const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    // Check organizations
    const orgs = await prisma.organization.findMany({
      include: {
        mlAccounts: true
      }
    })
    
    console.log('Organizations:', orgs.length)
    
    if (orgs.length > 0) {
      const org = orgs[0]
      console.log('\nFirst Organization:')
      console.log('- ID:', org.id)
      console.log('- Name:', org.primaryNickname)
      console.log('- Plan:', org.plan)
      console.log('- ML Accounts:', org.mlAccounts.length)
      
      if (org.mlAccounts.length > 0) {
        console.log('\nML Accounts:')
        org.mlAccounts.forEach(acc => {
          console.log(`  - ${acc.nickname} (${acc.mlUserId}) - Active: ${acc.isActive}`)
        })
      }
    }
    
    // Check active sessions
    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      }
    })
    
    console.log('\nActive Sessions:', sessions.length)
    
  } catch (error) {
    console.error('Database check error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()

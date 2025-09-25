const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getSession() {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    })
    
    if (sessions.length > 0) {
      const session = sessions[0]
      console.log('Session Token:', session.sessionToken)
      console.log('Expires At:', session.expiresAt)
      console.log('Organization ID:', session.organizationId)
    } else {
      console.log('No active sessions found')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

getSession()

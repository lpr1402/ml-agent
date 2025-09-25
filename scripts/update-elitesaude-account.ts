/**
 * Script para atualizar a conta ELITESAUDEANIMAL para status ACTIVE
 * Permitindo adicionar até 10 contas ML
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateEliteSaudeAccount() {
  try {
    // Buscar organização pela conta principal ELITESAUDEANIMAL
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { primaryNickname: { contains: 'ELITESAUDEANIMAL', mode: 'insensitive' } },
          { 
            mlAccounts: {
              some: { 
                nickname: { contains: 'ELITESAUDEANIMAL', mode: 'insensitive' },
                isPrimary: true
              }
            }
          }
        ]
      },
      include: {
        mlAccounts: {
          select: {
            id: true,
            nickname: true,
            isPrimary: true
          }
        }
      }
    })

    if (!organization) {
      console.log('❌ Organização ELITESAUDEANIMAL não encontrada')
      
      // Listar todas as organizações para debug
      const allOrgs = await prisma.organization.findMany({
        include: {
          mlAccounts: {
            select: {
              nickname: true,
              isPrimary: true
            }
          }
        }
      })
      
      console.log('\n📋 Organizações existentes:')
      allOrgs.forEach(org => {
        console.log(`- ID: ${org.id}`)
        console.log(`  Primary: ${org.primaryNickname || 'N/A'}`)
        console.log(`  Status: ${org.subscriptionStatus}`)
        console.log(`  Contas ML:`)
        org.mlAccounts.forEach(acc => {
          console.log(`    - ${acc.nickname} ${acc.isPrimary ? '(Principal)' : ''}`)
        })
      })
      
      return
    }

    console.log('✅ Organização encontrada:')
    console.log(`  ID: ${organization.id}`)
    console.log(`  Primary Nickname: ${organization.primaryNickname}`)
    console.log(`  Status Atual: ${organization.subscriptionStatus}`)
    console.log(`  Total de contas ML: ${organization.mlAccounts.length}`)

    // Atualizar para status ACTIVE
    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        plan: 'PRO',
        // Estender prazo de subscription
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
        updatedAt: new Date()
      }
    })

    console.log('\n✅ Organização atualizada com sucesso!')
    console.log(`  Novo Status: ${updated.subscriptionStatus}`)
    console.log(`  Plano: ${updated.plan}`)
    console.log(`  Limite de contas: 10`)
    console.log(`  Subscription válida até: ${updated.subscriptionEndsAt?.toLocaleDateString('pt-BR')}`)

    // Criar log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'subscription.upgraded',
        entityType: 'organization',
        entityId: organization.id,
        organizationId: organization.id,
        metadata: {
          previousStatus: organization.subscriptionStatus,
          newStatus: 'ACTIVE',
          previousPlan: organization.plan,
          newPlan: 'PRO',
          maxAccounts: 10,
          updatedBy: 'system_admin'
        }
      }
    })

    console.log('✅ Log de auditoria criado')

  } catch (error) {
    console.error('❌ Erro ao atualizar organização:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
console.log('🚀 Iniciando atualização da conta ELITESAUDEANIMAL...\n')
updateEliteSaudeAccount()
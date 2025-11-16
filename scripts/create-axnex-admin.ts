/**
 * Script para criar organização AXNEX SUPER_ADMIN
 * Username: AXNEX
 * PIN: 911
 * Role: SUPER_ADMIN
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Creating AXNEX Super Admin organization...\n')

  try {
    // Verificar se já existe
    const existing = await prisma.organization.findUnique({
      where: { username: 'AXNEX' }
    })

    if (existing) {
      console.log('⚠️  AXNEX organization already exists!')
      console.log('ID:', existing.id)
      console.log('Role:', existing.role)
      console.log('Created:', existing.createdAt)

      // Verificar se já é SUPER_ADMIN
      if (existing.role === 'SUPER_ADMIN') {
        console.log('\n✅ AXNEX is already SUPER_ADMIN')
        return existing
      }

      // Atualizar para SUPER_ADMIN
      const updated = await prisma.organization.update({
        where: { id: existing.id },
        data: { role: 'SUPER_ADMIN' }
      })

      console.log('\n✅ Updated AXNEX to SUPER_ADMIN role')
      return updated
    }

    // Hash do PIN 911
    const pinHash = await bcrypt.hash('911', 10)

    // Criar organização AXNEX
    const axnexOrg = await prisma.organization.create({
      data: {
        username: 'AXNEX',
        pinHash: pinHash,
        organizationName: 'AXNEX Admin',
        role: 'SUPER_ADMIN',
        plan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: new Date('2099-12-31'), // Nunca expira
        trialEndsAt: new Date('2099-12-31')
      }
    })

    console.log('\n✅ AXNEX Super Admin created successfully!\n')
    console.log('📋 Details:')
    console.log('  - ID:', axnexOrg.id)
    console.log('  - Username: AXNEX')
    console.log('  - PIN: 911')
    console.log('  - Role: SUPER_ADMIN')
    console.log('  - Plan: PRO')
    console.log('  - Status: ACTIVE')
    console.log('\n🔐 Login at: /api/auth/login-pin')
    console.log('  Username: AXNEX')
    console.log('  PIN: 911')
    console.log('\n📊 Admin Dashboard: /admin/dashboard')

    return axnexOrg

  } catch (error: any) {
    console.error('\n❌ Error creating AXNEX:', error.message)
    throw error
  }
}

main()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

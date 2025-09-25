/**
 * Wrapper Seguro para Operações Prisma com RLS
 * Garante isolamento multi-tenant em todas as operações
 */

import { prisma } from './prisma'
import { withRLSTransaction, secureWhere, validateOwnership } from './prisma-rls-middleware'
import { getCurrentSession } from './auth/ml-auth'

/**
 * Cliente Prisma seguro com organizationId automático
 * Usa o contexto da sessão atual para garantir isolamento
 */
export class SecurePrisma {
  private organizationId: string | null = null
  
  constructor(organizationId?: string) {
    this.organizationId = organizationId || null
  }
  
  /**
   * Obtém o organizationId do contexto atual
   */
  private async getOrganizationId(): Promise<string> {
    if (this.organizationId) {
      return this.organizationId
    }
    
    const session = await getCurrentSession()
    if (!session?.organizationId) {
      throw new Error('No organization context available')
    }
    
    return session.organizationId
  }
  
  /**
   * MLAccount com isolamento garantido
   */
  get mlAccount() {
    return {
      findMany: async (args?: any) => {
        const orgId = await this.getOrganizationId()
        return prisma.mLAccount.findMany({
          ...args,
          where: secureWhere(orgId, args?.where)
        })
      },
      
      findFirst: async (args?: any) => {
        const orgId = await this.getOrganizationId()
        return prisma.mLAccount.findFirst({
          ...args,
          where: secureWhere(orgId, args?.where)
        })
      },
      
      create: async (args: any) => {
        const orgId = await this.getOrganizationId()
        return prisma.mLAccount.create({
          ...args,
          data: {
            ...args.data,
            organizationId: orgId
          }
        })
      },
      
      update: async (args: any) => {
        const orgId = await this.getOrganizationId()
        // Valida ownership antes de atualizar
        if (args.where?.id) {
          const isOwner = await validateOwnership(prisma, 'mLAccount', args.where.id, orgId)
          if (!isOwner) {
            throw new Error('Unauthorized: Resource does not belong to organization')
          }
        }
        return prisma.mLAccount.update(args)
      },
      
      delete: async (args: any) => {
        const orgId = await this.getOrganizationId()
        // Valida ownership antes de deletar
        if (args.where?.id) {
          const isOwner = await validateOwnership(prisma, 'mLAccount', args.where.id, orgId)
          if (!isOwner) {
            throw new Error('Unauthorized: Resource does not belong to organization')
          }
        }
        return prisma.mLAccount.delete(args)
      }
    }
  }
  
  /**
   * Question com isolamento garantido
   */
  get question() {
    return {
      findMany: async (args?: any) => {
        const orgId = await this.getOrganizationId()
        // Questions são vinculadas via MLAccount
        const mlAccounts = await prisma.mLAccount.findMany({
          where: { organizationId: orgId },
          select: { id: true }
        })
        const mlAccountIds = mlAccounts.map(a => a.id)
        
        return prisma.question.findMany({
          ...args,
          where: {
            ...args?.where,
            mlAccountId: { in: mlAccountIds }
          }
        })
      },
      
      findFirst: async (args?: any) => {
        const orgId = await this.getOrganizationId()
        const mlAccounts = await prisma.mLAccount.findMany({
          where: { organizationId: orgId },
          select: { id: true }
        })
        const mlAccountIds = mlAccounts.map(a => a.id)
        
        return prisma.question.findFirst({
          ...args,
          where: {
            ...args?.where,
            mlAccountId: { in: mlAccountIds }
          }
        })
      },
      
      create: async (args: any) => {
        const orgId = await this.getOrganizationId()
        // Valida que o mlAccountId pertence à organização
        if (args.data?.mlAccountId) {
          const isOwner = await validateOwnership(prisma, 'mLAccount', args.data.mlAccountId, orgId)
          if (!isOwner) {
            throw new Error('Unauthorized: MLAccount does not belong to organization')
          }
        }
        return prisma.question.create(args)
      }
    }
  }
  
  /**
   * Session com isolamento garantido
   */
  get session() {
    return {
      findUnique: async (args: any) => {
        // Sessions podem ser buscadas por token único
        return prisma.session.findUnique(args)
      },
      
      findMany: async (args?: any) => {
        const orgId = await this.getOrganizationId()
        return prisma.session.findMany({
          ...args,
          where: secureWhere(orgId, args?.where)
        })
      },
      
      create: async (args: any) => {
        const orgId = await this.getOrganizationId()
        return prisma.session.create({
          ...args,
          data: {
            ...args.data,
            organizationId: orgId
          }
        })
      },
      
      update: async (args: any) => {
        const orgId = await this.getOrganizationId()
        if (args.where?.id) {
          const isOwner = await validateOwnership(prisma, 'session', args.where.id, orgId)
          if (!isOwner) {
            throw new Error('Unauthorized: Session does not belong to organization')
          }
        }
        return prisma.session.update(args)
      }
    }
  }
  
  /**
   * WebhookEvent com isolamento garantido
   */
  get webhookEvent() {
    return {
      findMany: async (args?: any) => {
        const orgId = await this.getOrganizationId()
        return prisma.webhookEvent.findMany({
          ...args,
          where: secureWhere(orgId, args?.where)
        })
      },
      
      create: async (args: any) => {
        const orgId = await this.getOrganizationId()
        return prisma.webhookEvent.create({
          ...args,
          data: {
            ...args.data,
            organizationId: orgId
          }
        })
      }
    }
  }
  
  /**
   * Transação segura com RLS
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const orgId = await this.getOrganizationId()
    return withRLSTransaction(prisma, orgId, callback)
  }
}

/**
 * Factory function para criar cliente seguro
 */
export function createSecurePrisma(organizationId?: string): SecurePrisma {
  return new SecurePrisma(organizationId)
}

/**
 * Cliente seguro padrão (usa sessão atual)
 */
export const securePrisma = new SecurePrisma()
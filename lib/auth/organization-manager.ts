/**
 * Gerenciador Atômico de Organizações
 * Previne race conditions e duplicações
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { encryptToken } from '@/lib/security/encryption'
import { auditLog, AUDIT_ACTIONS } from '@/lib/audit/audit-logger'

interface CreateOrganizationParams {
  mlUserId: string
  nickname: string
  email: string | null
  siteId: string
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
  }
}

export class OrganizationManager {
  /**
   * Cria ou obtém organização de forma atômica
   * Previne race conditions usando transação e UPSERT
   */
  static async createOrGetOrganization(params: CreateOrganizationParams) {
    const { mlUserId, nickname, email, siteId, tokens } = params

    try {
      // Usa transação isolada para garantir atomicidade
      const result = await prisma.$transaction(async (tx) => {
        // Tenta buscar organização existente com lock
        const existingOrg = await tx.organization.findUnique({
          where: { primaryMLUserId: mlUserId }
        })

        if (existingOrg) {
          logger.info('[OrgManager] Organization already exists', {
            orgId: existingOrg.id,
            mlUserId
          })

          // Atualiza informações se necessário
          const updatedOrg = await tx.organization.update({
            where: { id: existingOrg.id },
            data: {
              primaryNickname: nickname,
              primaryEmail: email,
              primarySiteId: siteId,
              updatedAt: new Date()
            }
          })

          // Atualiza ou cria conta ML principal
          const mlAccount = await this.upsertPrimaryMLAccount(tx, {
            organizationId: updatedOrg.id,
            mlUserId,
            nickname,
            email,
            siteId,
            tokens
          })

          return { organization: updatedOrg, mlAccount, isNew: false }
        }

        // Cria nova organização
        const newOrg = await tx.organization.create({
          data: {
            primaryMLUserId: mlUserId,
            primaryNickname: nickname,
            primaryEmail: email,
            primarySiteId: siteId
          }
        })

        logger.info('[OrgManager] Created new organization', {
          orgId: newOrg.id,
          mlUserId
        })

        // Cria conta ML principal
        const mlAccount = await this.upsertPrimaryMLAccount(tx, {
          organizationId: newOrg.id,
          mlUserId,
          nickname,
          email,
          siteId,
          tokens
        })

        // Atualiza organização com ID da conta principal
        await tx.organization.update({
          where: { id: newOrg.id },
          data: { primaryMLAccountId: mlAccount.id }
        })

        // Audit log
        await auditLog({
          action: AUDIT_ACTIONS.ORGANIZATION_CREATED,
          entityType: 'organization',
          entityId: newOrg.id,
          organizationId: newOrg.id,
          metadata: { mlUserId, nickname, siteId }
        })

        return { organization: newOrg, mlAccount, isNew: true }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000, // Max 5s waiting for lock
        timeout: 10000  // Max 10s for transaction
      })

      return result

    } catch (error: any) {
      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        // Unique constraint violation - race condition handled
        logger.warn('[OrgManager] Race condition detected, retrying...', { mlUserId })
        
        // Retry once after short delay
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const org = await prisma.organization.findUnique({
          where: { primaryMLUserId: mlUserId }
        })

        if (org) {
          const mlAccount = await prisma.mLAccount.findUnique({
            where: { mlUserId }
          })
          return { organization: org, mlAccount, isNew: false }
        }
      }

      logger.error('[OrgManager] Failed to create/get organization', { error })
      throw error
    }
  }

  /**
   * Atualiza ou cria conta ML principal de forma atômica
   */
  private static async upsertPrimaryMLAccount(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string
      mlUserId: string
      nickname: string
      email: string | null
      siteId: string
      tokens: {
        access_token: string
        refresh_token: string
        expires_in: number
      }
    }
  ) {
    const { organizationId, mlUserId, nickname, email, siteId, tokens } = params

    // Criptografa tokens
    const encryptedAccess = encryptToken(tokens.access_token)
    const encryptedRefresh = encryptToken(tokens.refresh_token)

    // UPSERT atômico
    const mlAccount = await tx.mLAccount.upsert({
      where: { mlUserId },
      update: {
        nickname,
        email,
        siteId,
        isPrimary: true,
        accessToken: encryptedAccess.encrypted,
        accessTokenIV: encryptedAccess.iv,
        accessTokenTag: encryptedAccess.authTag,
        refreshToken: encryptedRefresh.encrypted,
        refreshTokenIV: encryptedRefresh.iv,
        refreshTokenTag: encryptedRefresh.authTag,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
        connectionError: null,
        lastSyncAt: new Date()
      },
      create: {
        mlUserId,
        nickname,
        email,
        siteId,
        isPrimary: true,
        organizationId,
        accessToken: encryptedAccess.encrypted,
        accessTokenIV: encryptedAccess.iv,
        accessTokenTag: encryptedAccess.authTag,
        refreshToken: encryptedRefresh.encrypted,
        refreshTokenIV: encryptedRefresh.iv,
        refreshTokenTag: encryptedRefresh.authTag,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000)
      }
    })

    return mlAccount
  }

  /**
   * Valida se uma conta ML pode ser adicionada a uma organização
   */
  static async validateAccountAddition(
    organizationId: string,
    mlUserId: string
  ): Promise<{ valid: boolean; reason?: string }> {
    // Verifica se ML account já existe em qualquer organização
    const existingAccount = await prisma.mLAccount.findUnique({
      where: { mlUserId },
      include: { organization: true }
    })

    if (existingAccount) {
      if (existingAccount.organizationId === organizationId) {
        return { 
          valid: false, 
          reason: 'Esta conta ML já está conectada a esta organização' 
        }
      }

      return { 
        valid: false, 
        reason: `Esta conta ML já está conectada a outra organização (${existingAccount.organization.primaryNickname})` 
      }
    }

    // Verifica limite de contas por organização (máx 10)
    const accountCount = await prisma.mLAccount.count({
      where: { 
        organizationId,
        isActive: true 
      }
    })

    if (accountCount >= 10) {
      return { 
        valid: false, 
        reason: 'Limite máximo de 10 contas ML por organização atingido' 
      }
    }

    return { valid: true }
  }

  /**
   * Garante consistência de conta primária
   */
  static async ensurePrimaryAccountConsistency(organizationId: string): Promise<void> {
    const primaryAccounts = await prisma.mLAccount.findMany({
      where: {
        organizationId,
        isPrimary: true,
        isActive: true
      }
    })

    // Se houver múltiplas primárias (não deveria), mantém apenas a primeira
    if (primaryAccounts.length > 1) {
      logger.warn('[OrgManager] Multiple primary accounts detected, fixing...', {
        organizationId,
        count: primaryAccounts.length
      })

      // Mantém apenas a primeira como primária
      const [keepPrimary, ...removePrimary] = primaryAccounts

      await Promise.all(
        removePrimary.map(account =>
          prisma.mLAccount.update({
            where: { id: account.id },
            data: { isPrimary: false }
          })
        )
      )

      // Atualiza organização
      await prisma.organization.update({
        where: { id: organizationId },
        data: { primaryMLAccountId: keepPrimary?.id || '' }
      })
    }

    // Se não houver nenhuma primária, define a primeira ativa
    if (primaryAccounts.length === 0) {
      const firstActive = await prisma.mLAccount.findFirst({
        where: {
          organizationId,
          isActive: true
        },
        orderBy: { createdAt: 'asc' }
      })

      if (firstActive) {
        await prisma.mLAccount.update({
          where: { id: firstActive.id },
          data: { isPrimary: true }
        })

        await prisma.organization.update({
          where: { id: organizationId },
          data: { 
            primaryMLAccountId: firstActive.id,
            primaryMLUserId: firstActive.mlUserId,
            primaryNickname: firstActive.nickname
          }
        })

        logger.info('[OrgManager] Set primary account', {
          organizationId,
          accountId: firstActive.id
        })
      }
    }
  }
}

export default OrganizationManager
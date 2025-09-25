/**
 * Middleware para ativar Row-Level Security (RLS) em todas as queries Prisma
 * CRÍTICO: Previne vazamento de dados entre organizações
 */

import { logger } from '@/lib/logger'

/**
 * Validates organization ID format to prevent injection
 */
function isValidOrganizationId(id: string): boolean {
  // Organization IDs should be CUID format (alphanumeric)
  const cuidRegex = /^[a-zA-Z0-9]{20,30}$/
  return cuidRegex.test(id)
}

/**
 * Define o contexto de segurança para RLS
 * Deve ser chamado antes de cada query que precisa isolamento tenant
 */
export async function setSecurityContext(
  prisma: any,
  organizationId: string | null
) {
  if (!organizationId) {
    logger.warn('[RLS] No organizationId provided for security context')
    return
  }

  try {
    // SECURITY FIX: Validate organization ID format
    if (!isValidOrganizationId(organizationId)) {
      throw new Error(`Invalid organization ID format: ${organizationId}`)
    }
    
    // SECURITY FIX: Use parameterized query to prevent SQL injection
    await prisma.$executeRaw`SET LOCAL app.current_organization_id = ${organizationId}`
    
    logger.debug('[RLS] Security context set', { organizationId })
  } catch (error) {
    logger.error('[RLS] Failed to set security context', { error, organizationId })
    throw new Error('Failed to set security context')
  }
}


/**
 * Wrapper para transações com RLS
 * Garante que o contexto de segurança seja mantido durante a transação
 */
export async function withRLSTransaction<T>(
  prisma: any,
  organizationId: string,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  // SECURITY FIX: Validate organization ID before transaction
  if (!isValidOrganizationId(organizationId)) {
    throw new Error(`Invalid organization ID format: ${organizationId}`)
  }
  
  return await prisma.$transaction(async (tx: any) => {
    // SECURITY FIX: Use parameterized query to prevent SQL injection
    await tx.$executeRaw`SET LOCAL app.current_organization_id = ${organizationId}`
    
    // Execute callback with security context set
    return await callback(tx)
  })
}

/**
 * Helper para queries seguras com RLS
 * Garante que o organizationId seja sempre incluído
 */
export function secureWhere(
  organizationId: string,
  where: any = {}
): any {
  return {
    ...where,
    organizationId
  }
}

/**
 * Valida se uma entidade pertence à organização
 * Útil para verificações adicionais de segurança
 */
export async function validateOwnership(
  prisma: any,
  model: string,
  id: string,
  organizationId: string
): Promise<boolean> {
  try {
    const result = await prisma[model].findFirst({
      where: {
        id,
        organizationId
      }
    })
    
    return !!result
  } catch (error) {
    logger.error('[RLS] Ownership validation failed', {
      model,
      id,
      organizationId,
      error
    })
    return false
  }
}
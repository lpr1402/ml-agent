/**
 * Enterprise Subscription Plan Validator
 * Enforces business rules and usage limits
 * Production-Ready for SaaS Multi-Tenant
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'

export type PlanType = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'

interface PlanLimits {
  questionsPerMonth: number
  accountsPerOrg: number
  apiCallsPerHour: number
  storageGB: number
  supportLevel: 'basic' | 'priority' | 'dedicated'
  features: Set<string>
}

// Production plan configurations
const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    questionsPerMonth: 100,
    accountsPerOrg: 1,
    apiCallsPerHour: 100,
    storageGB: 1,
    supportLevel: 'basic',
    features: new Set(['basic_responses', 'manual_approval'])
  },
  PRO: {
    questionsPerMonth: 1000,
    accountsPerOrg: 4,
    apiCallsPerHour: 500,
    storageGB: 10,
    supportLevel: 'priority',
    features: new Set([
      'basic_responses', 'manual_approval', 'auto_approval',
      'ai_suggestions', 'analytics', 'whatsapp_notifications'
    ])
  },
  PREMIUM: {
    questionsPerMonth: 10000,
    accountsPerOrg: 10,
    apiCallsPerHour: 2000,
    storageGB: 100,
    supportLevel: 'priority',
    features: new Set([
      'basic_responses', 'manual_approval', 'auto_approval',
      'ai_suggestions', 'analytics', 'whatsapp_notifications',
      'custom_templates', 'api_access', 'bulk_operations',
      'advanced_analytics', 'priority_processing'
    ])
  },
  ENTERPRISE: {
    questionsPerMonth: -1, // Unlimited
    accountsPerOrg: -1, // Unlimited
    apiCallsPerHour: 10000,
    storageGB: 1000,
    supportLevel: 'dedicated',
    features: new Set([
      'basic_responses', 'manual_approval', 'auto_approval',
      'ai_suggestions', 'analytics', 'whatsapp_notifications',
      'custom_templates', 'api_access', 'bulk_operations',
      'advanced_analytics', 'priority_processing',
      'white_label', 'sla_guarantee', 'custom_integrations',
      'dedicated_support', 'training', 'onboarding'
    ])
  }
}

export class SubscriptionValidator {
  private static instance: SubscriptionValidator
  
  static getInstance(): SubscriptionValidator {
    if (!this.instance) {
      this.instance = new SubscriptionValidator()
    }
    return this.instance
  }
  
  /**
   * Validate if organization can perform action
   */
  async validateAction(
    organizationId: string,
    action: 'question' | 'api_call' | 'create_account' | 'use_feature',
    featureName?: string
  ): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: PlanType }> {
    try {
      // Get organization with current plan
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          plan: true,
          subscriptionStatus: true,
          _count: {
            select: {
              mlAccounts: true
            }
          }
        }
      })
      
      if (!org) {
        return { allowed: false, reason: 'Organization not found' }
      }
      
      // Check subscription status
      if (org.subscriptionStatus === 'PAST_DUE') {
        return { allowed: false, reason: 'Subscription past due - payment required' }
      }
      
      if (org.subscriptionStatus === 'CANCELLED') {
        return { allowed: false, reason: 'Subscription cancelled' }
      }
      
      if (org.subscriptionStatus === 'EXPIRED') {
        return { allowed: false, reason: 'Subscription expired' }
      }
      
      const plan = org.plan as PlanType
      const limits = PLAN_LIMITS[plan]
      
      // Validate based on action type
      switch (action) {
        case 'question':
          return this.validateQuestionLimit(organizationId, limits)
          
        case 'api_call':
          return this.validateApiLimit(organizationId, limits)
          
        case 'create_account':
          return this.validateAccountLimit(org._count?.mlAccounts || 0, limits)
          
        case 'use_feature':
          return this.validateFeature(featureName!, limits)
          
        default:
          return { allowed: true }
      }
      
    } catch (_error) {
      logger.error('[SubscriptionValidator] Validation error', { error: _error, organizationId, action })
      return { allowed: false, reason: 'Validation error' }
    }
  }
  
  /**
   * Validate monthly question limit
   */
  private async validateQuestionLimit(
    organizationId: string,
    limits: PlanLimits
  ): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: PlanType }> {
    // Unlimited for enterprise
    if (limits.questionsPerMonth === -1) {
      return { allowed: true }
    }
    
    // Get current month usage from cache or database
    const cacheKey = `usage:questions:${organizationId}:${new Date().getMonth()}`
    let usage = await redis.get(cacheKey)
    
    if (!usage) {
      // Calculate from database
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const count = await prisma.question.count({
        where: {
          mlAccount: {
            organizationId
          },
          dateCreated: {
            gte: startOfMonth
          }
        }
      })
      
      usage = count.toString()
      await redis.set(cacheKey, usage, 'EX', 3600) // Cache for 1 hour
    }
    
    const currentUsage = parseInt(usage)
    
    if (currentUsage >= limits.questionsPerMonth) {
      // Suggest upgrade
      const suggestedPlan = this.suggestUpgrade('questions', currentUsage)
      return {
        allowed: false,
        reason: `Monthly question limit reached (${limits.questionsPerMonth})`,
        upgradeRequired: suggestedPlan
      }
    }
    
    // Increment usage counter
    await redis.incr(cacheKey)
    
    return { allowed: true }
  }
  
  /**
   * Validate API rate limit
   */
  private async validateApiLimit(
    organizationId: string,
    limits: PlanLimits
  ): Promise<{ allowed: boolean; reason?: string }> {
    const cacheKey = `ratelimit:api:${organizationId}:${new Date().getHours()}`
    const usage = await redis.get(cacheKey)
    
    if (usage && parseInt(usage) >= limits.apiCallsPerHour) {
      return {
        allowed: false,
        reason: `API rate limit exceeded (${limits.apiCallsPerHour}/hour)`
      }
    }
    
    await redis.incr(cacheKey)
    await redis.expire(cacheKey, 3600)
    
    return { allowed: true }
  }
  
  /**
   * Validate account creation limit
   */
  private validateAccountLimit(
    currentAccounts: number,
    limits: PlanLimits
  ): { allowed: boolean; reason?: string; upgradeRequired?: PlanType } {
    if (limits.accountsPerOrg === -1) {
      return { allowed: true }
    }
    
    if (currentAccounts >= limits.accountsPerOrg) {
      const suggestedPlan = this.suggestUpgrade('accounts', currentAccounts)
      return {
        allowed: false,
        reason: `Account limit reached (${limits.accountsPerOrg} accounts)`,
        upgradeRequired: suggestedPlan
      }
    }
    
    return { allowed: true }
  }
  
  /**
   * Validate feature availability
   */
  private validateFeature(
    featureName: string,
    limits: PlanLimits
  ): { allowed: boolean; reason?: string; upgradeRequired?: PlanType } {
    if (!limits.features.has(featureName)) {
      // Find minimum plan with this feature
      const planWithFeature = this.findPlanWithFeature(featureName)
      return {
        allowed: false,
        reason: `Feature "${featureName}" not available in current plan`,
        upgradeRequired: planWithFeature
      }
    }
    
    return { allowed: true }
  }
  
  /**
   * Suggest plan upgrade based on usage
   */
  private suggestUpgrade(metric: string, currentUsage: number): PlanType {
    if (metric === 'questions') {
      if (currentUsage <= 1000) return 'PRO'
      if (currentUsage <= 10000) return 'PREMIUM'
      return 'ENTERPRISE'
    }
    
    if (metric === 'accounts') {
      if (currentUsage <= 4) return 'PRO'
      if (currentUsage <= 10) return 'PREMIUM'
      return 'ENTERPRISE'
    }
    
    return 'PRO'
  }
  
  /**
   * Find minimum plan with specific feature
   */
  private findPlanWithFeature(featureName: string): PlanType {
    const plans: PlanType[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE']
    
    for (const plan of plans) {
      if (PLAN_LIMITS[plan].features.has(featureName)) {
        return plan
      }
    }
    
    return 'ENTERPRISE'
  }
  
  /**
   * Get current usage statistics
   */
  async getUsageStats(organizationId: string): Promise<{
    questions: { used: number; limit: number; percentage: number }
    accounts: { used: number; limit: number; percentage: number }
    apiCalls: { used: number; limit: number; percentage: number }
    storage: { usedGB: number; limitGB: number; percentage: number }
  }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        _count: {
          select: { mlAccounts: true }
        }
      }
    })
    
    if (!org) {
      throw new Error('Organization not found')
    }
    
    const limits = PLAN_LIMITS[org.plan as PlanType]
    
    // Get question usage
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const questionCount = await prisma.question.count({
      where: {
        mlAccount: { organizationId },
        dateCreated: { gte: startOfMonth }
      }
    })
    
    // Get API usage
    const apiCacheKey = `ratelimit:api:${organizationId}:${new Date().getHours()}`
    const apiUsage = parseInt(await redis.get(apiCacheKey) || '0')
    
    return {
      questions: {
        used: questionCount,
        limit: limits.questionsPerMonth,
        percentage: limits.questionsPerMonth === -1 ? 0 : (questionCount / limits.questionsPerMonth) * 100
      },
      accounts: {
        used: org._count?.mlAccounts || 0,
        limit: limits.accountsPerOrg,
        percentage: limits.accountsPerOrg === -1 ? 0 : ((org._count?.mlAccounts || 0) / limits.accountsPerOrg) * 100
      },
      apiCalls: {
        used: apiUsage,
        limit: limits.apiCallsPerHour,
        percentage: (apiUsage / limits.apiCallsPerHour) * 100
      },
      storage: {
        usedGB: 0.5, // TODO: Calculate actual storage
        limitGB: limits.storageGB,
        percentage: (0.5 / limits.storageGB) * 100
      }
    }
  }
  
  /**
   * Check if feature is available for plan
   */
  isFeatureAvailable(plan: PlanType, feature: string): boolean {
    return PLAN_LIMITS[plan].features.has(feature)
  }
  
  /**
   * Get plan details
   */
  getPlanDetails(plan: PlanType): PlanLimits {
    return PLAN_LIMITS[plan]
  }
}

// Export singleton
export const subscriptionValidator = SubscriptionValidator.getInstance()
/**
 * Subscription Plan Enforcement Middleware
 * Applies business rules across all API endpoints
 * Production-Ready with Zero Trust Architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAccount } from '@/lib/api/session-auth'
import { subscriptionValidator } from './plan-validator'
import { logger } from '@/lib/logger'

// Feature mappings for API endpoints
const ENDPOINT_FEATURES: Record<string, string> = {
  '/api/agent/approve-question': 'auto_approval',
  '/api/agent/templates': 'custom_templates',
  '/api/mercadolibre/advanced-metrics': 'advanced_analytics',
  '/api/agent/bulk': 'bulk_operations',
  '/api/webhooks/custom': 'custom_integrations',
  '/api/agent/ai-suggestion': 'ai_suggestions',
  '/api/notifications/whatsapp': 'whatsapp_notifications'
}

// Endpoints that require specific plans
const PLAN_REQUIRED_ENDPOINTS: Record<string, string[]> = {
  '/api/agent/export': ['PRO', 'PREMIUM', 'ENTERPRISE'],
  '/api/analytics/advanced': ['PREMIUM', 'ENTERPRISE'],
  '/api/admin': ['ENTERPRISE']
}

/**
 * Enforce subscription limits middleware
 */
export async function enforceSubscriptionLimits(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  try {
    // Skip enforcement for public endpoints
    if (pathname.startsWith('/api/public') || 
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/health')) {
      return null
    }
    
    // Get authenticated account
    const auth = await getAuthenticatedAccount()
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const organizationId = auth.organizationId
    
    // Check feature-based restrictions
    const requiredFeature = ENDPOINT_FEATURES[pathname]
    if (requiredFeature) {
      const validation = await subscriptionValidator.validateAction(
        organizationId,
        'use_feature',
        requiredFeature
      )
      
      if (!validation.allowed) {
        logger.warn('[PlanMiddleware] Feature blocked', {
          organizationId,
          feature: requiredFeature,
          endpoint: pathname
        })
        
        return NextResponse.json({
          error: validation.reason,
          upgradeRequired: validation.upgradeRequired,
          feature: requiredFeature
        }, { status: 403 })
      }
    }
    
    // Check plan-specific endpoints
    const requiredPlans = PLAN_REQUIRED_ENDPOINTS[pathname]
    if (requiredPlans) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true }
      })
      
      if (!org || !requiredPlans.includes(org.plan)) {
        return NextResponse.json({
          error: `This endpoint requires ${requiredPlans.join(' or ')} plan`,
          currentPlan: org?.plan,
          upgradeRequired: requiredPlans[0]
        }, { status: 403 })
      }
    }
    
    // Check API rate limits based on plan
    if (pathname.startsWith('/api/mercadolibre')) {
      const validation = await subscriptionValidator.validateAction(
        organizationId,
        'api_call'
      )
      
      if (!validation.allowed) {
        logger.warn('[PlanMiddleware] API rate limit exceeded', {
          organizationId,
          endpoint: pathname
        })
        
        return NextResponse.json({
          error: validation.reason,
          retryAfter: 3600 // 1 hour
        }, { 
          status: 429,
          headers: {
            'Retry-After': '3600',
            'X-RateLimit-Limit': '2000',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + 3600000).toISOString()
          }
        })
      }
    }
    
    // Check question creation limits
    if (pathname === '/api/agent/approve-question' && request.method === 'POST') {
      const validation = await subscriptionValidator.validateAction(
        organizationId,
        'question'
      )
      
      if (!validation.allowed) {
        logger.warn('[PlanMiddleware] Question limit exceeded', {
          organizationId
        })
        
        // Get usage stats for response
        const stats = await subscriptionValidator.getUsageStats(organizationId)
        
        return NextResponse.json({
          error: validation.reason,
          upgradeRequired: validation.upgradeRequired,
          usage: stats.questions,
          resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
        }, { status: 403 })
      }
    }
    
    // Check account creation limits
    if (pathname === '/api/ml-accounts' && request.method === 'POST') {
      const validation = await subscriptionValidator.validateAction(
        organizationId,
        'create_account'
      )
      
      if (!validation.allowed) {
        logger.warn('[PlanMiddleware] Account limit exceeded', {
          organizationId
        })
        
        const stats = await subscriptionValidator.getUsageStats(organizationId)
        
        return NextResponse.json({
          error: validation.reason,
          upgradeRequired: validation.upgradeRequired,
          usage: stats.accounts
        }, { status: 403 })
      }
    }
    
    // All checks passed
    return null
    
  } catch (error) {
    logger.error('[PlanMiddleware] Error enforcing limits', { error, pathname })
    // Fail open in case of errors to not block legitimate requests
    return null
  }
}

/**
 * Add usage tracking headers to response
 */
export async function addUsageHeaders(
  response: NextResponse,
  organizationId: string
): Promise<NextResponse> {
  try {
    const stats = await subscriptionValidator.getUsageStats(organizationId)
    
    // Add usage headers
    response.headers.set('X-Questions-Used', stats.questions.used.toString())
    response.headers.set('X-Questions-Limit', stats.questions.limit.toString())
    response.headers.set('X-API-Calls-Used', stats.apiCalls.used.toString())
    response.headers.set('X-API-Calls-Limit', stats.apiCalls.limit.toString())
    
  } catch (error) {
    logger.error('[PlanMiddleware] Error adding usage headers', { error })
  }
  
  return response
}

// Import prisma here to avoid circular dependency
import { prisma } from '@/lib/prisma'
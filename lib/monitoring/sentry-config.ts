import * as Sentry from '@sentry/nextjs'

export const SENTRY_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN']

export const sentryConfig = {
  dsn: SENTRY_DSN || '',
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  // Replay integration removed - not supported in current version
  integrations: [],
  ignoreErrors: [
    'Non-Error promise rejection captured',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],
  beforeSend(event: Sentry.ErrorEvent) {
    // Filter out non-critical errors in production
    if (process.env['NODE_ENV'] === 'production') {
      if (event.exception && event.exception.values) {
        const error = event.exception.values[0]
        
        // Don't send network errors
        if (error?.type === 'NetworkError' || error?.type === 'FetchError') {
          return null
        }
        
        // Don't send canceled requests
        if (error?.value && error?.value.includes('AbortError')) {
          return null
        }
      }
    }
    
    return event
  }
}

export function initSentry(options = {}) {
  if (SENTRY_DSN) {
    Sentry.init({
      ...sentryConfig,
      ...options,
      dsn: SENTRY_DSN
    })
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: {
        custom: context
      }
    })
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (SENTRY_DSN) {
    Sentry.captureMessage(message, level)
  }
}

export function trackWebhookPerformance(metric: any) {
  // Performance tracking for webhooks
  if (SENTRY_DSN) {
    Sentry.setContext('webhook_performance', metric)
  }
}

export function addBreadcrumb(data: any) {
  if (SENTRY_DSN) {
    Sentry.addBreadcrumb(data)
  }
}
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NODE_ENV,
  
  // Server-specific configuration
  integrations: [
    // Capture console errors
    Sentry.captureConsoleIntegration({
      levels: ["error", "warn"],
    }),
  ],
  
  // Enhanced error context
  beforeSend(event, hint) {
    // Add custom context for ML API errors
    if (event.exception?.values?.[0]?.value?.includes("mercadolibre")) {
      event.tags = {
        ...event.tags,
        ml_api_error: true
      }
      event.level = "error"
    }
    
    // Add custom context for AI errors
    if (event.exception?.values?.[0]?.value?.includes("openai") ||
        event.exception?.values?.[0]?.value?.includes("GPT")) {
      event.tags = {
        ...event.tags,
        ai_error: true
      }
    }
    
    return event
  },
  
  // Profile sample rate
  profilesSampleRate: 0.1,
})
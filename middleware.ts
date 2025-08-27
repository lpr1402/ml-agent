import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ML Webhook IPs whitelist
const ML_WEBHOOK_IPS = [
  "54.88.218.97",
  "18.215.140.160",
  "18.213.114.129",
  "18.206.34.84"
]

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const response = NextResponse.next()
  
  // Security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  
  // ML Webhook validation - ALWAYS ACCEPT FOR NOW
  if (pathname.startsWith("/api/ml-webhook")) {
    // Log IP for debugging but ALWAYS ACCEPT
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                request.headers.get("x-real-ip")
    
    console.log(`[Webhook] Request from IP: ${ip} - ACCEPTED`)
    
    // Webhook endpoints should always return quickly
    return response
  }
  
  // Rate limiting for API routes
  if (pathname.startsWith("/api")) {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1"
    const now = Date.now()
    const rateLimitKey = `${ip}:${pathname}`
    const rateLimit = rateLimitMap.get(rateLimitKey)
    
    if (rateLimit) {
      if (rateLimit.resetTime > now) {
        rateLimit.count++
        // Allow 100 requests per minute
        if (rateLimit.count > 100) {
          return NextResponse.json(
            { error: "Too many requests" },
            { status: 429 }
          )
        }
      } else {
        rateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + 60000 })
      }
    } else {
      rateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + 60000 })
    }
  }
  
  // Allow all routes - auth is handled client-side with localStorage
  // This is the modern approach used by most SaaS platforms
  
  // Redirect root to login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
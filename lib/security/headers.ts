/**
 * Headers de Segurança - Setembro 2025
 * Implementa todos os headers recomendados pelo OWASP
 */

import { NextResponse } from 'next/server'

export function addSecurityHeaders(response: NextResponse): NextResponse {
  // HSTS - Forçar HTTPS por 1 ano
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
  
  // Content Security Policy - Proteção contra XSS
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://api.mercadolibre.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://api.mercadolibre.com https://auth.mercadolibre.com.br wss://gugaleo.axnexlabs.com.br:3008 ws://localhost:3008 wss://localhost:3008 ws://localhost:* wss://localhost:*; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  )
  
  // Prevenir MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Proteção contra clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Controle de referrer
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissões de browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )
  
  // Cross-Origin policies
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  
  // DNS prefetch control
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  
  // Download options for IE
  response.headers.set('X-Download-Options', 'noopen')
  
  // XSS Protection for older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Cache control for sensitive pages
  if (response.url?.includes('/api/auth') || response.url?.includes('/api/agent')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    )
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }
  
  return response
}

export default addSecurityHeaders
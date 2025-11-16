/**
 * ENSURE HTTPS UTILITY
 * Centralizes all HTTP -> HTTPS conversions to fix Mixed Content warnings
 * Production-ready solution for Mercado Livre image URLs
 * October 2025
 */

/**
 * Force HTTPS on any URL (fixes Mixed Content CSP warnings)
 * Handles null/undefined safely
 */
export function ensureHttps(url: string | null | undefined): string | undefined
export function ensureHttps(url: string): string
export function ensureHttps(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return url.replace(/^http:/, 'https:')
}

/**
 * Force HTTPS on array of URLs
 */
export function ensureHttpsArray(urls: (string | null | undefined)[]): string[] {
  return urls
    .filter((url): url is string => Boolean(url))
    .map(url => url.replace(/^http:/, 'https:'))
}

/**
 * Force HTTPS on object with URL properties
 * Useful for API responses
 */
export function ensureHttpsObject<T extends Record<string, any>>(
  obj: T,
  urlKeys: (keyof T)[]
): T {
  const result = { ...obj }

  for (const key of urlKeys) {
    const value = result[key]
    if (typeof value === 'string') {
      result[key] = value.replace(/^http:/, 'https:') as any
    }
  }

  return result
}

/**
 * Next.js Image Loader - forces HTTPS for external images
 */
export function secureImageLoader({ src }: { src: string }): string {
  return src.replace(/^http:/, 'https:')
}

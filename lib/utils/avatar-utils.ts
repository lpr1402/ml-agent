/**
 * Client-safe utility functions for avatar handling
 * NO SERVER-SIDE DEPENDENCIES (Prisma, etc)
 */

/**
 * Validates and returns a clean avatar URL
 * Safe for use in client components
 * Handles both string URLs and thumbnail objects from ML API
 */
export function getValidAvatarUrl(thumbnail: string | { picture_url?: string } | null | undefined): string | null {
  if (!thumbnail) return null

  // Handle ML API thumbnail object format: { picture_id: "...", picture_url: "..." }
  if (typeof thumbnail === 'object' && thumbnail.picture_url) {
    return thumbnail.picture_url
  }

  // Handle string URLs
  if (typeof thumbnail !== 'string') return null

  // Clean and validate the URL
  const cleanUrl = thumbnail.trim()

  // If it's already a full valid URL, use it directly
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl
  }

  // If it's a protocol-relative URL (//domain.com/path)
  if (cleanUrl.startsWith('//')) {
    return `https:${cleanUrl}`
  }

  // If it's a ML static path, add the domain
  if (cleanUrl.startsWith('/') && cleanUrl.includes('.')) {
    return `https://http2.mlstatic.com${cleanUrl}`
  }

  // If doesn't look like a valid URL at all, return null
  // We DON'T generate fake URLs, only use what's stored
  if (cleanUrl.length < 10 || !cleanUrl.includes('.')) {
    return null
  }

  return cleanUrl
}
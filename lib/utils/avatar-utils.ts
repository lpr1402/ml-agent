/**
 * Client-safe utility functions for avatar handling
 * NO SERVER-SIDE DEPENDENCIES (Prisma, etc)
 */

/**
 * Validates and returns a clean avatar URL
 * Safe for use in client components
 */
export function getValidAvatarUrl(thumbnail: string | null | undefined): string | null {
  if (!thumbnail) return null

  // Se é uma URL completa válida, usar direto
  if (thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
    return thumbnail
  }

  // Se for um caminho relativo do ML, adicionar o domínio
  if (thumbnail.startsWith('/')) {
    return `https://http2.mlstatic.com${thumbnail}`
  }

  // Se não parece ser uma URL válida, retornar null
  if (thumbnail.length < 10 || !thumbnail.includes('.')) {
    return null
  }

  return thumbnail
}
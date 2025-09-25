/**
 * OptimizedImage Component
 * Production-ready image component that handles Next.js optimization
 * and fallback for external images
 */

import Image from 'next/image'
import { useState } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  priority?: boolean
  unoptimized?: boolean
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  width = 100,
  height = 100,
  priority = false,
  unoptimized = false
}: OptimizedImageProps) {
  const [error, setError] = useState(false)

  // Check if it's an external image
  const isExternal = src.startsWith('http://') || src.startsWith('https://')

  // For Mercado Livre images or when error occurs, use standard img
  if (error || (isExternal && src.includes('mlstatic.com'))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      priority={priority}
      unoptimized={unoptimized || isExternal}
      onError={() => setError(true)}
    />
  )
}
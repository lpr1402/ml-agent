import React from 'react'
import { cn } from '@/lib/utils'

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive'
  glow?: boolean
  shimmer?: boolean
}

export function PremiumCard({
  className,
  variant = 'default',
  glow = false,
  shimmer = false,
  children,
  ...props
}: PremiumCardProps) {
  return (
    <div
      className={cn(
        'premium-card',
        variant === 'elevated' && 'shadow-xl',
        variant === 'interactive' && 'cursor-pointer',
        glow && 'glow-gold',
        shimmer && 'shimmer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
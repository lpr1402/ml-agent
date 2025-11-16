import * as React from 'react'
import { cn } from '@/lib/utils'

interface PremiumHeaderProps extends React.HTMLAttributes<HTMLElement> {
  logo?: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PremiumHeader({
  className,
  logo,
  title,
  subtitle,
  actions,
  children,
  ...props
}: PremiumHeaderProps) {
  return (
    <header
      className={cn(
        'premium-header',
        className
      )}
      {...props}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {logo && (
              <div className="premium-button p-2 rounded-lg">
                {logo}
              </div>
            )}
            {(title || subtitle) && (
              <div>
                {title && (
                  <h1 className="text-lg font-semibold text-gradient-gold">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-xs text-gray-500">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Section */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
        
        {/* Custom Children */}
        {children}
      </div>
    </header>
  )
}
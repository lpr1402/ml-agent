/**
 * Organization Health Badge
 * Badge com status visual de saúde da organização
 */

'use client'

import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'loading'

interface OrgHealthBadgeProps {
  status: HealthStatus
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

export function OrgHealthBadge({
  status,
  label,
  size = 'md',
  showIcon = true,
  className = ''
}: OrgHealthBadgeProps) {

  const getStyles = () => {
    const base = 'inline-flex items-center gap-1.5 rounded-full font-medium transition-all'

    const sizes = {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3 py-1.5 text-sm'
    }

    const statuses = {
      healthy: 'bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/20',
      warning: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
      critical: 'bg-red-500/10 text-red-500 border border-red-500/20',
      loading: 'bg-white/5 text-white/60 border border-white/10'
    }

    return `${base} ${sizes[size]} ${statuses[status]} ${className}`
  }

  const getIcon = () => {
    const iconSizes = {
      sm: 'w-3 h-3',
      md: 'w-3.5 h-3.5',
      lg: 'w-4 h-4'
    }

    const iconClass = iconSizes[size]

    switch (status) {
      case 'healthy':
        return <CheckCircle className={iconClass} />
      case 'warning':
        return <AlertTriangle className={iconClass} />
      case 'critical':
        return <XCircle className={iconClass} />
      case 'loading':
        return <Loader2 className={`${iconClass} animate-spin`} />
    }
  }

  const getLabel = () => {
    if (label) return label

    switch (status) {
      case 'healthy':
        return 'OK'
      case 'warning':
        return 'Warning'
      case 'critical':
        return 'Critical'
      case 'loading':
        return 'Loading...'
    }
  }

  return (
    <span className={getStyles()}>
      {showIcon && getIcon()}
      <span>{getLabel()}</span>
    </span>
  )
}

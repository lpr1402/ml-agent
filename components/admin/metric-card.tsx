/**
 * Metric Card - Card de métrica com animações premium
 * Cores: Preto/Dourado/Amarelo
 */

'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: {
    value: number
    label: string
  }
  trend?: 'up' | 'down' | 'neutral'
  severity?: 'success' | 'warning' | 'error' | 'neutral'
  icon?: React.ReactNode
  loading?: boolean
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  trend,
  severity = 'neutral',
  icon,
  loading = false
}: MetricCardProps) {

  const getTrendIcon = () => {
    if (!trend || trend === 'neutral') return <Minus className="w-4 h-4" />
    if (trend === 'up') return <TrendingUp className="w-4 h-4" />
    return <TrendingDown className="w-4 h-4" />
  }

  const getTrendColor = () => {
    if (severity === 'success') return 'text-[#FFE600]'
    if (severity === 'warning') return 'text-yellow-500'
    if (severity === 'error') return 'text-red-500'
    return 'text-white/60'
  }

  const getBorderColor = () => {
    if (severity === 'success') return 'border-[#FFE600]/20 hover:border-[#FFE600]/40'
    if (severity === 'warning') return 'border-yellow-500/20 hover:border-yellow-500/40'
    if (severity === 'error') return 'border-red-500/20 hover:border-red-500/40'
    return 'border-white/10 hover:border-white/20'
  }

  if (loading) {
    return (
      <div className="premium-card p-6 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded mb-4" />
        <div className="h-8 w-32 bg-white/10 rounded mb-2" />
        <div className="h-3 w-20 bg-white/10 rounded" />
      </div>
    )
  }

  return (
    <div className={`
      relative overflow-hidden rounded-xl
      bg-gradient-to-br from-[#1A1A1A]/80 to-[#111111]/60
      border ${getBorderColor()}
      backdrop-blur-xl
      transition-all duration-300
      hover:transform hover:scale-[1.02]
      hover:shadow-[0_0_30px_rgba(255,230,0,0.1)]
      group
    `}>
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFE600]/0 via-[#FFE600]/0 to-[#FFE600]/0 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />

      {/* Top gold line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFE600]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm text-white/60 font-medium mb-1">
              {title}
            </p>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              {value}
            </h3>
          </div>

          {icon && (
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#FFE600]/10 text-[#FFE600] group-hover:bg-[#FFE600]/20 transition-colors">
              {icon}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          {subtitle && (
            <p className="text-xs text-white/50">
              {subtitle}
            </p>
          )}

          {change && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-md
              bg-white/5 border border-white/10
              text-xs font-medium
              ${getTrendColor()}
            `}>
              {getTrendIcon()}
              <span>{change.value > 0 ? '+' : ''}{change.value}%</span>
              <span className="text-white/40 ml-1">{change.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

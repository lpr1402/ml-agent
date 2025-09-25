'use client'

import React, { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConnectionStatusProps {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  className?: string
  showLabel?: boolean
}

export function ConnectionStatus({
  isConnected: _isConnected,
  connectionStatus,
  className,
  showLabel = true
}: ConnectionStatusProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false)

  // Pulse animation when status changes
  useEffect(() => {
    setPulseAnimation(true)
    const timer = setTimeout(() => setPulseAnimation(false), 1000)
    return () => clearTimeout(timer)
  }, [connectionStatus])

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Conectado',
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20',
          dotColor: 'bg-emerald-500',
          animate: false
        }
      case 'connecting':
        return {
          icon: RefreshCw,
          label: 'Conectando...',
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20',
          dotColor: 'bg-amber-500',
          animate: true
        }
      case 'error':
        return {
          icon: WifiOff,
          label: 'Erro',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20',
          dotColor: 'bg-red-500',
          animate: false
        }
      default:
        return {
          icon: WifiOff,
          label: 'Desconectado',
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/20',
          dotColor: 'bg-gray-500',
          animate: false
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm transition-all duration-300",
        config.bgColor,
        config.borderColor,
        pulseAnimation && "scale-105",
        className
      )}
    >
      <div className="relative">
        <Icon
          className={cn(
            "h-4 w-4 transition-colors",
            config.color,
            config.animate && "animate-spin"
          )}
        />
        {/* Status dot */}
        <div
          className={cn(
            "absolute -top-1 -right-1 h-2 w-2 rounded-full",
            config.dotColor,
            connectionStatus === 'connected' && 'animate-pulse'
          )}
        />
      </div>

      {showLabel && (
        <span className={cn("text-sm font-medium", config.color)}>
          {config.label}
        </span>
      )}
    </div>
  )
}

// Component to show real-time updates indicator
export function RealtimeIndicator({
  isActive,
  className
}: {
  isActive: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-md transition-all",
        isActive
          ? "bg-emerald-500/10 border border-emerald-500/20"
          : "bg-gray-500/10 border border-gray-500/20",
        className
      )}
    >
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          isActive
            ? "bg-emerald-500 animate-pulse"
            : "bg-gray-500"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium",
          isActive ? "text-emerald-500" : "text-gray-500"
        )}
      >
        {isActive ? 'Tempo Real' : 'Offline'}
      </span>
    </div>
  )
}
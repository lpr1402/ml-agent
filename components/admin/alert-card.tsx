/**
 * Alert Card - Card de alerta com ações rápidas
 * Cores: Preto/Dourado/Amarelo
 */

'use client'

import Link from 'next/link'
import { AlertTriangle, XCircle, Info, ExternalLink, X } from 'lucide-react'
import type { AlertType, AlertCategory } from '@prisma/client'

interface AlertCardProps {
  id: string
  type: AlertType
  category: AlertCategory
  message: string
  suggestedAction?: string | undefined
  actionUrl?: string | undefined
  organizationName?: string | undefined
  affectedQuestions?: number | undefined
  detectedAt: Date
  onDismiss?: ((alertId: string) => void) | undefined
  onResolve?: ((alertId: string) => void) | undefined
}

export function AlertCard({
  id,
  type,
  message,
  suggestedAction,
  actionUrl,
  organizationName,
  affectedQuestions,
  detectedAt,
  onDismiss,
  onResolve
}: AlertCardProps) {

  const getIcon = () => {
    switch (type) {
      case 'CRITICAL':
        return <XCircle className="w-5 h-5" />
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5" />
      case 'INFO':
        return <Info className="w-5 h-5" />
    }
  }

  const getStyles = () => {
    switch (type) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-500',
          glow: 'shadow-[0_0_20px_rgba(239,68,68,0.1)]'
        }
      case 'WARNING':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-500',
          glow: 'shadow-[0_0_20px_rgba(234,179,8,0.1)]'
        }
      case 'INFO':
        return {
          bg: 'bg-[#FFE600]/10',
          border: 'border-[#FFE600]/30',
          text: 'text-[#FFE600]',
          glow: 'shadow-[0_0_20px_rgba(255,230,0,0.1)]'
        }
    }
  }

  const styles = getStyles()

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)

    if (diff < 60) return 'agora'
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
    return `${Math.floor(diff / 86400)}d atrás`
  }

  return (
    <div className={`
      relative rounded-xl p-4
      ${styles.bg} ${styles.border} ${styles.glow}
      border backdrop-blur-xl
      transition-all duration-300
      hover:transform hover:scale-[1.01]
      group
    `}>
      {/* Top line */}
      <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-current to-transparent opacity-30 ${styles.text}`} />

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${styles.text}`}>
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${styles.text}`}>
                  {type}
                </span>
                {organizationName && (
                  <>
                    <span className="text-white/30">•</span>
                    <span className="text-xs text-white/60">
                      {organizationName}
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm text-white font-medium leading-relaxed">
                {message}
              </p>

              {affectedQuestions && affectedQuestions > 0 && (
                <p className="text-xs text-white/50 mt-1">
                  {affectedQuestions} {affectedQuestions === 1 ? 'pergunta afetada' : 'perguntas afetadas'}
                </p>
              )}
            </div>

            {/* Time */}
            <span className="text-xs text-white/40 whitespace-nowrap">
              {formatTime(detectedAt)}
            </span>
          </div>

          {/* Suggested Action */}
          {suggestedAction && (
            <div className="bg-white/5 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-white/60 mb-1">
                <span className="text-white/80 font-medium">Ação sugerida:</span>
              </p>
              <p className="text-xs text-white/70">
                {suggestedAction}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {actionUrl && (
              <Link
                href={actionUrl}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5
                  text-xs font-medium
                  bg-white/10 hover:bg-white/20
                  border border-white/20 hover:border-white/30
                  rounded-lg
                  transition-all duration-200
                  text-white
                `}
              >
                Ver Detalhes
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}

            {onResolve && (
              <button
                onClick={() => onResolve(id)}
                className="
                  px-3 py-1.5 text-xs font-medium
                  bg-[#FFE600]/10 hover:bg-[#FFE600]/20
                  border border-[#FFE600]/20 hover:border-[#FFE600]/30
                  rounded-lg
                  transition-all duration-200
                  text-[#FFE600]
                "
              >
                Resolver
              </button>
            )}

            {onDismiss && (
              <button
                onClick={() => onDismiss(id)}
                className="
                  ml-auto p-1.5
                  hover:bg-white/10
                  rounded-lg
                  transition-colors duration-200
                  text-white/40 hover:text-white/80
                "
                title="Dispensar alerta"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Alerts Page - Sistema completo de alertas
 * Visualiza todos alertas com filtros e ações
 */

'use client'

import { useEffect, useState } from 'react'
import { AlertCard } from '@/components/admin/alert-card'
import { AlertTriangle, RefreshCw, Filter } from 'lucide-react'

interface Alert {
  id: string
  type: 'CRITICAL' | 'WARNING' | 'INFO'
  category: string
  message: string
  suggestedAction?: string
  actionUrl?: string
  organizationName?: string
  affectedQuestions?: number
  detectedAt: string
  status: string
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE')

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        ...(filterStatus !== 'all' && { status: filterStatus }),
        limit: '100'
      })

      const res = await fetch(`/api/admin/alerts?${params}`)
      const data = await res.json()

      if (data.success) {
        setAlerts(data.data)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus])

  const filteredAlerts = alerts.filter(alert => {
    if (filterType === 'all') return true
    return alert.type === filterType
  })

  const criticalCount = alerts.filter(a => a.type === 'CRITICAL').length
  const warningCount = alerts.filter(a => a.type === 'WARNING').length
  const infoCount = alerts.filter(a => a.type === 'INFO').length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Alertas do Sistema
          </h1>
          <p className="text-white/60">
            Monitoramento de problemas e avisos importantes
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="
            flex items-center gap-2 px-4 py-2
            bg-[#FFE600]/10 hover:bg-[#FFE600]/20
            border border-[#FFE600]/20 hover:border-[#FFE600]/30
            rounded-lg
            text-[#FFE600] font-medium
            transition-all duration-200
          "
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="premium-card p-4">
          <div className="text-xs text-white/60 mb-1">Total</div>
          <div className="text-2xl font-bold text-white">
            {alerts.length}
          </div>
        </div>
        <div className="premium-card p-4">
          <div className="text-xs text-white/60 mb-1">Críticos</div>
          <div className="text-2xl font-bold text-red-500">
            {criticalCount}
          </div>
        </div>
        <div className="premium-card p-4">
          <div className="text-xs text-white/60 mb-1">Avisos</div>
          <div className="text-2xl font-bold text-yellow-500">
            {warningCount}
          </div>
        </div>
        <div className="premium-card p-4">
          <div className="text-xs text-white/60 mb-1">Informativos</div>
          <div className="text-2xl font-bold text-[#FFE600]">
            {infoCount}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 text-white/60">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtrar:</span>
        </div>

        {/* Tipo */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="
            px-4 py-2
            bg-[#1A1A1A]/80 border border-white/10
            rounded-lg
            text-white text-sm
            focus:outline-none focus:border-[#FFE600]/30
            transition-colors
          "
        >
          <option value="all">Todos os tipos</option>
          <option value="CRITICAL">🔴 Críticos</option>
          <option value="WARNING">⚠️ Avisos</option>
          <option value="INFO">ℹ️ Informativos</option>
        </select>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="
            px-4 py-2
            bg-[#1A1A1A]/80 border border-white/10
            rounded-lg
            text-white text-sm
            focus:outline-none focus:border-[#FFE600]/30
            transition-colors
          "
        >
          <option value="ACTIVE">Ativos</option>
          <option value="RESOLVED">Resolvidos</option>
          <option value="DISMISSED">Dispensados</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* Lista de Alertas */}
      <div className="space-y-4">
        {loading ? (
          <>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="premium-card p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-5 h-5 bg-white/10 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-white/10 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              id={alert.id}
              type={alert.type}
              category={alert.category as any}
              message={alert.message}
              suggestedAction={alert.suggestedAction}
              actionUrl={alert.actionUrl}
              organizationName={alert.organizationName}
              affectedQuestions={alert.affectedQuestions}
              detectedAt={new Date(alert.detectedAt)}
            />
          ))
        ) : (
          <div className="premium-card p-12 text-center">
            <AlertTriangle className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Nenhum alerta encontrado
            </h3>
            <p className="text-white/60">
              {filterType !== 'all' || filterStatus !== 'ACTIVE'
                ? 'Nenhum alerta corresponde aos filtros aplicados'
                : 'Sistema operando normalmente sem alertas ativos'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

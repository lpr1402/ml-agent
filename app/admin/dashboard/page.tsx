/**
 * Admin Dashboard - Página Principal
 * Visão geral do sistema com métricas em tempo real
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MetricCard } from '@/components/admin/metric-card'
import { AlertCard } from '@/components/admin/alert-card'
import { OrgHealthBadge } from '@/components/admin/org-health-badge'
import {
  Building2,
  Link as LinkIcon,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Activity,
  Clock
} from 'lucide-react'

interface GlobalMetrics {
  organizations: {
    total: number
    active: number
    withIssues: number
  }
  mlAccounts: {
    total: number
    active: number
    inactive: number
  }
  questions: {
    total: number
    today: number
    pending: number
    failed: number
    successRate: number
    avgProcessingTime: number
  }
  alerts: {
    critical: number
    warning: number
    total: number
  }
}

interface Alert {
  id: string
  type: 'CRITICAL' | 'WARNING' | 'INFO'
  category: 'TOKEN_EXPIRED' | 'QUESTION_STUCK' | 'WEBHOOK_FAILED' | 'RATE_LIMIT_EXCEEDED' | 'ORG_DISCONNECTED' | 'TOKEN_EXPIRING_SOON' | 'HIGH_ERROR_RATE' | 'SLOW_PROCESSING' | 'LOW_ACTIVITY' | 'NEW_ORGANIZATION' | 'ACCOUNT_ADDED' | 'HIGH_VOLUME' | 'MILESTONE_REACHED'
  message: string
  suggestedAction?: string
  actionUrl?: string
  organizationName?: string
  affectedQuestions?: number
  detectedAt: string
}

interface Organization {
  id: string
  organizationName: string
  username: string
  healthStatus: 'healthy' | 'warning' | 'critical'
  activeMLAccounts: number
  questionsToday: number
  criticalAlerts: number
  warningAlerts: number
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      setRefreshing(true)

      // Buscar métricas globais
      const metricsRes = await fetch('/api/admin/metrics/global')
      const metricsData = await metricsRes.json()

      if (metricsData.success) {
        setMetrics(metricsData.data)
      }

      // Buscar organizações
      const orgsRes = await fetch('/api/admin/organizations')
      const orgsData = await orgsRes.json()

      if (orgsData.success) {
        setOrganizations(orgsData.data.slice(0, 10)) // Mostrar top 10
      }

      // Buscar alertas ativos
      const alertsRes = await fetch('/api/admin/alerts?status=ACTIVE&limit=5')
      const alertsData = await alertsRes.json()

      if (alertsData.success) {
        setAlerts(alertsData.data)
      }

    } catch (error) {
      console.error('[Dashboard] Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Auto-refresh a cada 30 segundos
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatProcessingTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Dashboard Administrativo
            </h1>
            <p className="text-white/60">
              Visão geral do sistema ML Agent
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={refreshing}
            className="
              flex items-center gap-2 px-4 py-2
              bg-[#FFE600]/10 hover:bg-[#FFE600]/20
              border border-[#FFE600]/20 hover:border-[#FFE600]/30
              rounded-lg
              text-[#FFE600] font-medium
              transition-all duration-200
              disabled:opacity-50
            "
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Métricas Globais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Organizações"
          value={metrics?.organizations.active || 0}
          subtitle={`${metrics?.organizations.total || 0} total`}
          change={{
            value: metrics?.organizations.withIssues || 0,
            label: 'com problemas'
          }}
          trend={metrics && metrics.organizations.withIssues > 0 ? 'down' : 'up'}
          severity={metrics && metrics.organizations.withIssues > 0 ? 'warning' : 'success'}
          icon={<Building2 className="w-6 h-6" />}
          loading={loading}
        />

        <MetricCard
          title="Contas ML"
          value={metrics?.mlAccounts.active || 0}
          subtitle={`${metrics?.mlAccounts.total || 0} total`}
          change={{
            value: metrics?.mlAccounts.inactive || 0,
            label: 'inativas'
          }}
          trend={metrics && metrics.mlAccounts.inactive > 0 ? 'down' : 'up'}
          severity={metrics && metrics.mlAccounts.inactive > 3 ? 'warning' : 'success'}
          icon={<LinkIcon className="w-6 h-6" />}
          loading={loading}
        />

        <MetricCard
          title="Perguntas/Hoje"
          value={metrics?.questions.today || 0}
          subtitle={`${metrics?.questions.total.toLocaleString() || 0} total`}
          change={{
            value: metrics?.questions.successRate || 100,
            label: 'taxa de sucesso'
          }}
          trend="up"
          severity="success"
          icon={<MessageSquare className="w-6 h-6" />}
          loading={loading}
        />

        <MetricCard
          title="Alertas"
          value={metrics?.alerts.critical || 0}
          subtitle={`${metrics?.alerts.total || 0} total`}
          change={{
            value: metrics?.alerts.warning || 0,
            label: 'warnings'
          }}
          trend={metrics && metrics.alerts.critical > 0 ? 'down' : 'neutral'}
          severity={metrics && metrics.alerts.critical > 0 ? 'error' : 'success'}
          icon={<AlertTriangle className="w-6 h-6" />}
          loading={loading}
        />
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-[#FFE600]" />
            <h3 className="text-lg font-semibold text-white">Taxa de Sucesso</h3>
          </div>
          <div className="text-4xl font-bold text-[#FFE600] mb-2">
            {metrics?.questions.successRate.toFixed(1)}%
          </div>
          <p className="text-sm text-white/60">
            Últimas 24 horas ({metrics?.questions.today || 0} perguntas)
          </p>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-[#FFE600]" />
            <h3 className="text-lg font-semibold text-white">Tempo Médio</h3>
          </div>
          <div className="text-4xl font-bold text-[#FFE600] mb-2">
            {metrics?.questions.avgProcessingTime
              ? formatProcessingTime(metrics.questions.avgProcessingTime)
              : '0s'}
          </div>
          <p className="text-sm text-white/60">
            Processamento de perguntas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alertas Críticos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Alertas Críticos</h2>
            <Link
              href="/admin/alerts"
              className="text-sm text-[#FFE600] hover:text-[#FFC700] flex items-center gap-1"
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              <>
                <div className="premium-card p-4 animate-pulse">
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-white/10 rounded" />
                </div>
                <div className="premium-card p-4 animate-pulse">
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-white/10 rounded" />
                </div>
              </>
            ) : alerts.length > 0 ? (
              alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  {...alert}
                  detectedAt={new Date(alert.detectedAt)}
                />
              ))
            ) : (
              <div className="premium-card p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/60">Nenhum alerta ativo</p>
                <p className="text-sm text-white/40 mt-1">Sistema operando normalmente</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Organizações */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Organizações</h2>
            <Link
              href="/admin/organizations"
              className="text-sm text-[#FFE600] hover:text-[#FFC700] flex items-center gap-1"
            >
              Ver todas
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-2">
            {loading ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="premium-card p-4 animate-pulse">
                    <div className="h-4 w-2/3 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-1/3 bg-white/10 rounded" />
                  </div>
                ))}
              </>
            ) : organizations.length > 0 ? (
              organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/admin/organization/${org.id}`}
                  className="
                    block premium-card p-4
                    hover:border-[#FFE600]/30
                    transition-all duration-200
                  "
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {org.organizationName || org.username}
                        </h3>
                        <OrgHealthBadge status={org.healthStatus} size="sm" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/60">
                        <span>{org.activeMLAccounts} contas</span>
                        <span>•</span>
                        <span>{org.questionsToday} perguntas hoje</span>
                      </div>
                    </div>

                    {(org.criticalAlerts > 0 || org.warningAlerts > 0) && (
                      <div className="flex items-center gap-2 ml-4">
                        {org.criticalAlerts > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-500 rounded-full">
                            {org.criticalAlerts} críticos
                          </span>
                        )}
                        {org.warningAlerts > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-500/20 text-yellow-500 rounded-full">
                            {org.warningAlerts} avisos
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="premium-card p-8 text-center">
                <Building2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/60">Nenhuma organização encontrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

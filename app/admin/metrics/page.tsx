/**
 * Metrics Page - Métricas Detalhadas do Sistema
 * Gráficos e análises profundas
 * Enterprise-Grade - Outubro 2025
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  MessageSquare,
  CheckCircle,
  RefreshCw
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface MetricsData {
  questionsOverTime: Array<{ date: string; count: number }>
  organizationsOverTime: Array<{ date: string; count: number }>
  performanceMetrics: {
    avgResponseTime: number
    avgProcessingTime: number
    successRate: number
    totalQuestions: number
    activeOrganizations: number
  }
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/metrics?period=${period}`)
      const data = await response.json()

      if (data.success) {
        setMetrics(data.data)
      }
    } catch (error) {
      console.error('[Metrics] Error fetching:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Métricas</h1>
              <p className="text-white/60">Análises detalhadas do sistema</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <div className="flex gap-2 bg-black/40 border border-white/10 rounded-lg p-1">
              {['7d', '30d', '90d'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p as any)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                    period === p
                      ? 'bg-gold text-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={fetchMetrics}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Carregando métricas...</div>
      ) : (
        <>
          {/* Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="w-5 h-5 text-gold" />
                <span className="text-white/60 text-sm">Total Perguntas</span>
              </div>
              <div className="text-3xl font-bold text-gold">
                {metrics?.performanceMetrics.totalQuestions.toLocaleString() || 0}
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-gold" />
                <span className="text-white/60 text-sm">Organizações</span>
              </div>
              <div className="text-3xl font-bold text-gold">
                {metrics?.performanceMetrics.activeOrganizations || 0}
              </div>
            </div>

            <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400/60 text-sm">Taxa Sucesso</span>
              </div>
              <div className="text-3xl font-bold text-emerald-400">
                {metrics?.performanceMetrics.successRate.toFixed(1) || 0}%
              </div>
            </div>

            <div className="bg-black/40 border border-blue-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-blue-400/60 text-sm">Tempo Médio</span>
              </div>
              <div className="text-3xl font-bold text-blue-400">
                {metrics?.performanceMetrics.avgProcessingTime.toFixed(1) || 0}s
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Questions Over Time */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gold" />
                Perguntas ao Longo do Tempo
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics?.questionsOverTime || []}>
                    <defs>
                      <linearGradient id="colorQuestions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFE600" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#FFE600" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis dataKey="date" stroke="#999" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#999" style={{ fontSize: '11px' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', border: '1px solid #FFE600', borderRadius: '8px' }}
                      labelStyle={{ color: '#FFE600' }}
                      itemStyle={{ color: '#FFF' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#FFE600" strokeWidth={2} fill="url(#colorQuestions)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Organizations Over Time */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-gold" />
                Novas Organizações
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics?.organizationsOverTime || []}>
                    <defs>
                      <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis dataKey="date" stroke="#999" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#999" style={{ fontSize: '11px' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', border: '1px solid #10B981', borderRadius: '8px' }}
                      labelStyle={{ color: '#10B981' }}
                      itemStyle={{ color: '#FFF' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} fill="url(#colorOrgs)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

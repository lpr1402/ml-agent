/**
 * System Page - Status do Sistema
 * Monitoramento de processos PM2, memoria, CPU
 * Enterprise-Grade - Outubro 2025
 */

'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Cpu,
  HardDrive,
  Activity,
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  Database,
  Wifi
} from 'lucide-react'

interface ProcessInfo {
  id: number
  name: string
  status: string
  cpu: string
  memory: string
  uptime: string
  restarts: number
}

interface SystemMetrics {
  processes: ProcessInfo[]
  system: {
    totalMemory: string
    usedMemory: string
    freeMemory: string
    cpuUsage: string
    uptime: string
    platform: string
    nodeVersion: string
  }
  database: {
    status: string
    connections: number
    poolSize: number
  }
  redis: {
    status: string
    memory: string
    keys: number
  }
}

export default function SystemPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/system')
      const data = await response.json()

      if (data.success) {
        setMetrics(data.data)
      }
    } catch (error) {
      console.error('[System] Error fetching:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()

    const interval = setInterval(fetchMetrics, 5000) // Atualizar a cada 5s
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center">
              <Settings className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Sistema</h1>
              <p className="text-white/60">Status de processos e recursos</p>
            </div>
          </div>

          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Carregando métricas...</div>
      ) : (
        <>
          {/* System Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Cpu className="w-6 h-6 text-gold" />
                <h3 className="text-lg font-semibold text-white">CPU</h3>
              </div>
              <div className="text-3xl font-bold text-gold mb-2">{metrics?.system.cpuUsage || '0%'}</div>
              <div className="text-sm text-white/60">Platform: {metrics?.system.platform || 'N/A'}</div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <HardDrive className="w-6 h-6 text-gold" />
                <h3 className="text-lg font-semibold text-white">Memória</h3>
              </div>
              <div className="text-3xl font-bold text-gold mb-2">{metrics?.system.usedMemory || '0 MB'}</div>
              <div className="text-sm text-white/60">
                Livre: {metrics?.system.freeMemory || '0 MB'} / Total: {metrics?.system.totalMemory || '0 MB'}
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-6 h-6 text-gold" />
                <h3 className="text-lg font-semibold text-white">Uptime</h3>
              </div>
              <div className="text-3xl font-bold text-gold mb-2">{metrics?.system.uptime || '0d'}</div>
              <div className="text-sm text-white/60">Node: {metrics?.system.nodeVersion || 'N/A'}</div>
            </div>
          </div>

          {/* Database & Redis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">PostgreSQL</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${metrics?.database.status === 'connected' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {metrics?.database.status === 'connected' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {metrics?.database.status || 'unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Conexões Ativas</span>
                  <span className="text-white font-semibold">{metrics?.database.connections || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Pool Size</span>
                  <span className="text-white font-semibold">{metrics?.database.poolSize || 30}</span>
                </div>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Wifi className="w-6 h-6 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Redis</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${metrics?.redis.status === 'connected' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {metrics?.redis.status === 'connected' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {metrics?.redis.status || 'unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Memory</span>
                  <span className="text-white font-semibold">{metrics?.redis.memory || '0 MB'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Keys</span>
                  <span className="text-white font-semibold">{metrics?.redis.keys || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PM2 Processes */}
          <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-black/60">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-gold" />
                <h3 className="text-lg font-semibold text-white">Processos PM2</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/60 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Processo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60">CPU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Memory</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Uptime</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Restarts</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.processes && metrics.processes.length > 0 ? (
                    metrics.processes.map((proc, index) => (
                      <motion.tr
                        key={proc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 text-white/60 text-sm">{proc.id}</td>
                        <td className="px-4 py-3 text-white font-medium">{proc.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${proc.status === 'online' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                            {proc.status === 'online' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {proc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/80">{proc.cpu}</td>
                        <td className="px-4 py-3 text-white/80">{proc.memory}</td>
                        <td className="px-4 py-3 text-white/60 text-sm">{proc.uptime}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${proc.restarts > 5 ? 'text-red-400' : 'text-white/60'}`}>
                            {proc.restarts}
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                        Nenhum processo encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

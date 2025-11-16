/**
 * Webhooks Page - Monitoramento de Webhooks ML
 * Visualizar últimos webhooks recebidos do Mercado Livre
 * Enterprise-Grade - Outubro 2025
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Webhook,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  ShoppingCart,
  Package,
  DollarSign
} from 'lucide-react'

interface WebhookEvent {
  id: string
  topic: string
  resourceId: string
  userId: string
  status: 'SUCCESS' | 'FAILED' | 'PENDING'
  receivedAt: Date
  processedAt?: Date
  error?: string
  organizationName?: string
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    last24h: 0
  })

  const fetchWebhooks = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/webhooks?limit=50')
      const data = await response.json()

      if (data.success) {
        setWebhooks(data.webhooks || [])
        setStats(prevStats => data.stats || prevStats)
      }
    } catch (error) {
      console.error('[Webhooks] Error fetching:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWebhooks()

    const interval = setInterval(fetchWebhooks, 5000) // Atualizar a cada 5s
    return () => clearInterval(interval)
  }, [fetchWebhooks])

  const getTopicIcon = (topic: string) => {
    if (topic.includes('question')) return <MessageSquare className="w-4 h-4" />
    if (topic.includes('order')) return <ShoppingCart className="w-4 h-4" />
    if (topic.includes('payment')) return <DollarSign className="w-4 h-4" />
    if (topic.includes('stock') || topic.includes('shipment')) return <Package className="w-4 h-4" />
    return <Webhook className="w-4 h-4" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'text-emerald-400 bg-emerald-500/10'
      case 'FAILED': return 'text-red-400 bg-red-500/10'
      default: return 'text-yellow-400 bg-yellow-500/10'
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center">
              <Webhook className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Webhooks</h1>
              <p className="text-white/60">Eventos recebidos do Mercado Livre</p>
            </div>
          </div>

          <button
            onClick={fetchWebhooks}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
          <div className="text-white/60 text-sm mb-1">Total</div>
          <div className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</div>
        </div>

        <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-4">
          <div className="text-emerald-400/60 text-sm mb-1 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Sucesso
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.success.toLocaleString()}</div>
        </div>

        <div className="bg-black/40 border border-red-500/30 rounded-xl p-4">
          <div className="text-red-400/60 text-sm mb-1 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Falhas
          </div>
          <div className="text-2xl font-bold text-red-400">{stats.failed.toLocaleString()}</div>
        </div>

        <div className="bg-black/40 border border-yellow-500/30 rounded-xl p-4">
          <div className="text-yellow-400/60 text-sm mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pendentes
          </div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending.toLocaleString()}</div>
        </div>

        <div className="bg-black/40 border border-gold/30 rounded-xl p-4">
          <div className="text-gold/60 text-sm mb-1">Últimas 24h</div>
          <div className="text-2xl font-bold text-gold">{stats.last24h.toLocaleString()}</div>
        </div>
      </div>

      {/* Webhooks Table */}
      <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/60 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Tópico</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Resource ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Organização</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Recebido</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Processado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                    Carregando webhooks...
                  </td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                    Nenhum webhook recebido
                  </td>
                </tr>
              ) : (
                webhooks.map((webhook, index) => (
                  <motion.tr
                    key={webhook.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.status)}`}>
                        {webhook.status === 'SUCCESS' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {webhook.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTopicIcon(webhook.topic)}
                        <span className="text-white text-sm">{webhook.topic}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/60 text-sm font-mono">{webhook.resourceId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/80 text-sm">{webhook.organizationName || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/60 text-xs">
                        {new Date(webhook.receivedAt).toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {webhook.processedAt ? (
                        <span className="text-white/60 text-xs">
                          {new Date(webhook.processedAt).toLocaleString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-yellow-400 text-xs">Processando...</span>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

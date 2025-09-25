'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import {
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Activity,
  Package,
  RefreshCw
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AccountMetrics {
  accountId: string
  nickname: string
  thumbnail?: string
  siteId: string
  totalQuestions: number
  answeredQuestions: number
  pendingQuestions: number
  avgResponseTime: number
  autoApprovedCount: number
  manualApprovedCount: number
  revisedCount: number
  failedCount: number
  tokenErrors: number
}

interface AggregatedMetrics {
  totalQuestions: number
  answeredQuestions: number
  pendingQuestions: number
  avgResponseTime: number
  autoApprovedCount: number
  manualApprovedCount: number
  revisedCount: number
  failedCount: number
  activeAccounts: number
}

interface MultiAccountMetrics {
  aggregated: AggregatedMetrics
  byAccount: AccountMetrics[]
  timestamp: string
}

interface Props {
  onAccountSelect?: (accountId: string | null) => void
  selectedAccountId?: string | null
}

// Cores para cada conta
const ACCOUNT_COLORS = [
  '#FFE600', // Amarelo ML
  '#FFC700', // Dourado
  '#3483FA', // Azul ML
  '#00A650', // Verde
  '#FF6B6B', // Vermelho
  '#8B5CF6', // Roxo
  '#F97316', // Laranja
  '#06B6D4', // Ciano
  '#EC4899', // Rosa
  '#10B981', // Esmeralda
]

export function MultiAccountMetrics({ onAccountSelect, selectedAccountId }: Props) {
  const [metrics, setMetrics] = useState<MultiAccountMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchMetrics = async () => {
    try {
      setRefreshing(true)
      const data = await apiClient.get('/api/agent/metrics-multi')
      setMetrics(data)
      logger.info('[Multi Metrics] Data loaded', { 
        accounts: data.byAccount.length,
        total: data.aggregated.totalQuestions 
      })
    } catch (error) {
      logger.error('[Multi Metrics] Error fetching metrics:', { message: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    
    // Auto-refresh a cada 60 segundos
    const interval = setInterval(fetchMetrics, 60000) // Reduzido de 30s para 60s - evita rate limit
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`
    return `${Math.round(seconds / 3600)}h`
  }

  const getAccountColor = (index: number) => ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center p-8 text-gray-400">
        Nenhuma métrica disponível
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de refresh */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
          <Activity className="h-5 w-5 text-yellow-500" />
          Métricas Consolidadas
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
            {metrics.aggregated.activeAccounts} contas
          </Badge>
        </h2>
        <Button
          onClick={fetchMetrics}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="text-gray-400 border-gray-700 hover:text-yellow-500 hover:border-yellow-500/30"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>

      {/* Métricas Agregadas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4" style={{background: 'rgba(26, 26, 26, 0.5)', borderLeft: '2px solid #FFE600', borderTop: '1px solid rgba(255, 230, 0, 0.1)', borderRight: '1px solid rgba(255, 230, 0, 0.1)', borderBottom: '1px solid rgba(255, 230, 0, 0.1)'}}>
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg" style={{background: 'rgba(255, 230, 0, 0.1)'}}>
              <MessageSquare className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-500">{metrics.aggregated.totalQuestions}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
            </div>
          </div>
        </Card>

        <Card className="p-4" style={{background: 'rgba(26, 26, 26, 0.5)', borderLeft: '2px solid #00A650', borderTop: '1px solid rgba(0, 166, 80, 0.1)', borderRight: '1px solid rgba(0, 166, 80, 0.1)', borderBottom: '1px solid rgba(0, 166, 80, 0.1)'}}>
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg" style={{background: 'rgba(34, 197, 94, 0.1)'}}>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-500">{metrics.aggregated.answeredQuestions}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Respondidas</p>
            </div>
          </div>
        </Card>

        <Card className="p-4" style={{background: 'rgba(26, 26, 26, 0.5)', borderLeft: '2px solid #F97316', borderTop: '1px solid rgba(249, 115, 22, 0.1)', borderRight: '1px solid rgba(249, 115, 22, 0.1)', borderBottom: '1px solid rgba(249, 115, 22, 0.1)'}}>
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg" style={{background: 'rgba(249, 115, 22, 0.1)'}}>
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-orange-500">{metrics.aggregated.pendingQuestions}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Pendentes</p>
            </div>
          </div>
        </Card>

        <Card className="p-4" style={{background: 'rgba(26, 26, 26, 0.5)', borderLeft: '2px solid #3483FA', borderTop: '1px solid rgba(52, 131, 250, 0.1)', borderRight: '1px solid rgba(52, 131, 250, 0.1)', borderBottom: '1px solid rgba(52, 131, 250, 0.1)'}}>
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg" style={{background: 'rgba(52, 131, 250, 0.1)'}}>
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-500">{formatTime(metrics.aggregated.avgResponseTime)}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Tempo Médio</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Métricas por Conta */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-white">
          <Users className="h-4 w-4 text-yellow-500" />
          Métricas por Conta ML
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.byAccount.map((account, index) => {
            const color = getAccountColor(index)
            const isSelected = selectedAccountId === account.accountId
            
            return (
              <Card
                key={account.accountId}
                className="p-4 cursor-pointer transition-colors"
                style={{
                  background: isSelected 
                    ? `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)` 
                    : 'rgba(26, 26, 26, 0.5)',
                  borderLeft: `2px solid ${color}`,
                  border: isSelected ? `1px solid ${color}30` : '1px solid rgba(255, 230, 0, 0.1)'
                }}
                onClick={() => onAccountSelect?.(isSelected ? null : account.accountId)}
              >
                {/* Header da conta */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10" style={{ border: `1px solid ${color}` }}>
                    {account.thumbnail ? (
                      <AvatarImage src={account.thumbnail} alt={account.nickname} />
                    ) : (
                      <AvatarFallback style={{ background: `${color}20`, color }}>
                        <Package className="h-5 w-5" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{account.nickname}</p>
                    <p className="text-xs text-gray-500">{account.siteId}</p>
                  </div>
                  {isSelected && (
                    <Badge className="text-xs" style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                      Ativa
                    </Badge>
                  )}
                </div>

                {/* Métricas da conta */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded" style={{background: 'rgba(255, 230, 0, 0.05)'}}>
                    <p className="text-lg font-bold text-yellow-500">{account.totalQuestions}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="p-2 rounded" style={{background: 'rgba(34, 197, 94, 0.05)'}}>
                    <p className="text-lg font-bold text-green-500">
                      {account.answeredQuestions}
                    </p>
                    <p className="text-xs text-gray-500">Resp.</p>
                  </div>
                  <div className="p-2 rounded" style={{background: 'rgba(249, 115, 22, 0.05)'}}>
                    <p className="text-lg font-bold text-orange-500">
                      {account.pendingQuestions}
                    </p>
                    <p className="text-xs text-gray-500">Pend.</p>
                  </div>
                </div>

                {/* Indicadores adicionais */}
                <div className="pt-3 mt-3 border-t" style={{borderColor: 'rgba(255, 230, 0, 0.1)'}}>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(account.avgResponseTime)}
                    </span>
                    {account.failedCount > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {account.failedCount} falhas
                      </span>
                    )}
                    {account.tokenErrors > 0 && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <AlertCircle className="h-3 w-3" />
                        Token erro
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Status de atualização */}
      <div className="text-xs text-gray-500 text-center">
        Última atualização: {new Date(metrics.timestamp).toLocaleTimeString('pt-BR')}
      </div>
    </div>
  )
}
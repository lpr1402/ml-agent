/**
 * Organization Details Page
 * Visão completa de uma organização específica
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import NextImage from 'next/image'
import { OrgHealthBadge } from '@/components/admin/org-health-badge'
import { AlertCard } from '@/components/admin/alert-card'
import { ArrowLeft, Building2, Link as LinkIcon, MessageSquare, Clock, AlertTriangle, RefreshCw } from 'lucide-react'

export default function OrganizationDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params?.['orgId'] as string

  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchOrganization = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/organization/${orgId}`)
      const data = await res.json()

      if (data.success) {
        setOrg(data.data)
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orgId) {
      fetchOrganization()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-white/10 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="premium-card p-6">
                <div className="h-4 w-20 bg-white/10 rounded mb-2" />
                <div className="h-8 w-24 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="p-8">
        <div className="premium-card p-12 text-center">
          <Building2 className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Organização não encontrada
          </h2>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-[#FFE600]/10 hover:bg-[#FFE600]/20 border border-[#FFE600]/20 rounded-lg text-[#FFE600] transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  const healthStatus = org.mlAccounts.length === 0 ? 'critical' :
                      org._count.alerts > 3 ? 'warning' : 'healthy'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/admin/organizations')}
          className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para organizações
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">
                {org.organizationName || org.username}
              </h1>
              <OrgHealthBadge status={healthStatus} />
            </div>
            <p className="text-white/60">
              @{org.username} • {org.plan} • Criada em {new Date(org.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <button
            onClick={fetchOrganization}
            className="
              flex items-center gap-2 px-4 py-2
              bg-[#FFE600]/10 hover:bg-[#FFE600]/20
              border border-[#FFE600]/20 hover:border-[#FFE600]/30
              rounded-lg
              text-[#FFE600] font-medium
              transition-all duration-200
            "
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <LinkIcon className="w-5 h-5 text-[#FFE600]" />
            <h3 className="text-sm font-semibold text-white/80">Contas ML</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {org.mlAccounts.length}
          </div>
          <div className="text-xs text-white/50">
            {org.mlAccounts.filter((a: any) => a.isActive).length} ativas
          </div>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare className="w-5 h-5 text-[#FFE600]" />
            <h3 className="text-sm font-semibold text-white/80">Perguntas</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {org.questionsToday}
          </div>
          <div className="text-xs text-white/50">
            {org.questionsTotal.toLocaleString()} total
          </div>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-yellow-500" />
            <h3 className="text-sm font-semibold text-white/80">Pendentes</h3>
          </div>
          <div className="text-3xl font-bold text-yellow-500 mb-1">
            {org.questionsPending}
          </div>
          <div className="text-xs text-white/50">
            aguardando ação
          </div>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-semibold text-white/80">Alertas</h3>
          </div>
          <div className="text-3xl font-bold text-red-500 mb-1">
            {org._count.alerts}
          </div>
          <div className="text-xs text-white/50">
            ativos
          </div>
        </div>
      </div>

      {/* Contas ML */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Contas do Mercado Livre</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {org.mlAccounts.map((account: any) => (
            <div key={account.id} className="premium-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {account.thumbnail && (
                    <NextImage
                      src={account.thumbnail}
                      alt={account.nickname}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                      unoptimized
                    />
                  )}
                  <div>
                    <div className="font-medium text-white">{account.nickname}</div>
                    <div className="text-xs text-white/50">{account.siteId}</div>
                  </div>
                </div>
                <div className={`
                  w-2 h-2 rounded-full
                  ${account.isActive ? 'bg-[#FFE600]' : 'bg-red-500'}
                `} />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Token expira:</span>
                  <span className="text-white">
                    {new Date(account.tokenExpiresAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {account.lastSyncAt && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Último sync:</span>
                    <span className="text-white">
                      {new Date(account.lastSyncAt).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas Ativos */}
      {org.alerts && org.alerts.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Alertas Ativos</h2>
          <div className="space-y-3">
            {org.alerts.map((alert: any) => (
              <AlertCard
                key={alert.id}
                id={alert.id}
                type={alert.type}
                category={alert.category}
                message={alert.message}
                suggestedAction={alert.suggestedAction}
                actionUrl={alert.actionUrl}
                affectedQuestions={alert.affectedQuestions}
                detectedAt={new Date(alert.detectedAt)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

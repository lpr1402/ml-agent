/**
 * Organizations List Page - Lista completa de organizações
 * Com filtros, busca e ações administrativas
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { OrgHealthBadge } from '@/components/admin/org-health-badge'
import { Building2, Search, RefreshCw, ExternalLink } from 'lucide-react'

interface Organization {
  id: string
  username: string
  organizationName: string
  plan: string
  subscriptionStatus: string
  totalMLAccounts: number
  activeMLAccounts: number
  questionsTotal: number
  questionsToday: number
  questionsPending: number
  questionsFailed: number
  criticalAlerts: number
  warningAlerts: number
  healthStatus: 'healthy' | 'warning' | 'critical'
  createdAt: string
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterHealth, setFilterHealth] = useState<string>('all')

  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/organizations')
      const data = await res.json()

      if (data.success) {
        setOrganizations(data.data)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.username?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesHealth = filterHealth === 'all' || org.healthStatus === filterHealth
    return matchesSearch && matchesHealth
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Organizações
          </h1>
          <p className="text-white/60">
            {organizations.length} organizações ativas no sistema
          </p>
        </div>

        <button
          onClick={fetchOrganizations}
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

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="Buscar organização..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="
              w-full pl-10 pr-4 py-3
              bg-[#1A1A1A]/80 border border-white/10
              rounded-lg
              text-white placeholder:text-white/40
              focus:outline-none focus:border-[#FFE600]/30
              transition-colors
            "
          />
        </div>

        {/* Filtro de Health */}
        <select
          value={filterHealth}
          onChange={(e) => setFilterHealth(e.target.value)}
          className="
            px-4 py-3
            bg-[#1A1A1A]/80 border border-white/10
            rounded-lg
            text-white
            focus:outline-none focus:border-[#FFE600]/30
            transition-colors
          "
        >
          <option value="all">Todos os status</option>
          <option value="healthy">✅ Saudáveis</option>
          <option value="warning">⚠️ Com avisos</option>
          <option value="critical">🔴 Críticas</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">
                  Organização
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">
                  Status
                </th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-white/80">
                  Contas ML
                </th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-white/80">
                  Perguntas
                </th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-white/80">
                  Alertas
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-white/80">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-white/5 animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 w-40 bg-white/10 rounded" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 w-16 bg-white/10 rounded-full" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-12 bg-white/10 rounded mx-auto" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-16 bg-white/10 rounded mx-auto" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-12 bg-white/10 rounded mx-auto" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-8 w-20 bg-white/10 rounded ml-auto" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filteredOrgs.length > 0 ? (
                filteredOrgs.map((org) => (
                  <tr
                    key={org.id}
                    className="
                      border-b border-white/5
                      hover:bg-white/5
                      transition-colors
                    "
                  >
                    {/* Organização */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-white">
                          {org.organizationName || org.username}
                        </div>
                        <div className="text-xs text-white/50">
                          @{org.username}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <OrgHealthBadge status={org.healthStatus} />
                    </td>

                    {/* Contas ML */}
                    <td className="px-6 py-4 text-center">
                      <div className="text-white font-medium">
                        {org.activeMLAccounts}/{org.totalMLAccounts}
                      </div>
                      <div className="text-xs text-white/50">
                        ativas
                      </div>
                    </td>

                    {/* Perguntas */}
                    <td className="px-6 py-4 text-center">
                      <div className="text-white font-medium">
                        {org.questionsToday}
                      </div>
                      <div className="text-xs text-white/50">
                        hoje
                      </div>
                    </td>

                    {/* Alertas */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {org.criticalAlerts > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-500 rounded-full">
                            {org.criticalAlerts}
                          </span>
                        )}
                        {org.warningAlerts > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-yellow-500/20 text-yellow-500 rounded-full">
                            {org.warningAlerts}
                          </span>
                        )}
                        {org.criticalAlerts === 0 && org.warningAlerts === 0 && (
                          <span className="text-white/40">—</span>
                        )}
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/organization/${org.id}`}
                        className="
                          inline-flex items-center gap-1.5 px-3 py-1.5
                          bg-[#FFE600]/10 hover:bg-[#FFE600]/20
                          border border-[#FFE600]/20 hover:border-[#FFE600]/30
                          rounded-lg
                          text-xs font-medium text-[#FFE600]
                          transition-all duration-200
                        "
                      >
                        Ver Detalhes
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Building2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/60">
                      {searchTerm || filterHealth !== 'all'
                        ? 'Nenhuma organização encontrada com os filtros aplicados'
                        : 'Nenhuma organização cadastrada'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Footer */}
      {!loading && filteredOrgs.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="premium-card p-4 text-center">
            <div className="text-2xl font-bold text-[#FFE600] mb-1">
              {filteredOrgs.length}
            </div>
            <div className="text-xs text-white/60">
              Organizações
            </div>
          </div>
          <div className="premium-card p-4 text-center">
            <div className="text-2xl font-bold text-[#FFE600] mb-1">
              {filteredOrgs.reduce((sum, org) => sum + org.activeMLAccounts, 0)}
            </div>
            <div className="text-xs text-white/60">
              Contas ML Ativas
            </div>
          </div>
          <div className="premium-card p-4 text-center">
            <div className="text-2xl font-bold text-[#FFE600] mb-1">
              {filteredOrgs.reduce((sum, org) => sum + org.questionsToday, 0)}
            </div>
            <div className="text-xs text-white/60">
              Perguntas Hoje
            </div>
          </div>
          <div className="premium-card p-4 text-center">
            <div className="text-2xl font-bold text-red-500 mb-1">
              {filteredOrgs.reduce((sum, org) => sum + org.criticalAlerts, 0)}
            </div>
            <div className="text-xs text-white/60">
              Alertas Críticos
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

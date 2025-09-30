'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MLAccountSwitcher } from '@/components/ml-account-switcher'
import { MLAgentDashboardModern } from '@/components/dashboard/ml-agent-dashboard-modern'
import { MultiAccountQuestions } from '@/components/agent/multi-account-questions'
import { MetricsROIModern } from '@/components/agent/metrics-roi-modern'
import { MLAccountsPodium } from '@/components/agent/ml-accounts-podium'
import { PremiumLoader } from '@/components/ui/premium-loader'
import { AddAccountModal } from '@/components/add-account-modal'
import { ProActivationModal } from '@/components/pro-activation-modal'
import {
  MessageSquare,
  Activity,
  LogOut,
  Clock
} from 'lucide-react'

export default function AgenteMultiConta() {
  // Add custom style for shimmer animation with proper cleanup
  React.useEffect(() => {
    const styleId = 'agente-shimmer-style'

    // Check if style already exists before adding
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s linear infinite;
        }
      `
      document.head.appendChild(style)

      return () => {
        // Safe cleanup - check if element exists before removing
        const element = document.getElementById(styleId)
        if (element && document.head.contains(element)) {
          document.head.removeChild(element)
        }
      }
    }
    return undefined // Explicitly return undefined when no cleanup needed
  }, [])
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [selectedAccountId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [organizationData, setOrganizationData] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false)
  const [accountsCount, setAccountsCount] = useState(0)
  const [showProModal, setShowProModal] = useState(false)


  // Verificar autenticação
  useEffect(() => {
    let mounted = true
    
    const checkAuth = async () => {
      try {
        const session = await apiClient.get('/api/auth/session')
        
        if (!mounted) return
        
        if (!session?.organizationId) {
          logger.info('No session found, redirecting to login')
          router.push('/login')
          return
        }
        
        setOrganizationData(session)
        setIsPro(session.plan === 'PRO')

        // Check if it's first time and not PRO
        const hasSeenProModal = localStorage.getItem('hasSeenProModal')
        if (!hasSeenProModal && session.plan !== 'PRO') {
          setShowProModal(true)
          localStorage.setItem('hasSeenProModal', 'true')
        }

        // Fetch accounts count
        try {
          const accountsResponse = await apiClient.get('/api/ml-accounts/metrics')
          if (accountsResponse?.accounts) {
            setAccountsCount(accountsResponse.accounts.length)
          }
        } catch (error) {
          logger.warn('Failed to fetch accounts count', { error })
        }

        setLoading(false)
      } catch (error) {
        if (!mounted) return
        
        logger.error('Auth check failed:', { error })
        router.push('/login')
      }
    }
    
    checkAuth()
    
    return () => {
      mounted = false
    }
  }, [router])

  // Listener para upgrade de plano
  useEffect(() => {
    const handlePlanUpgrade = (event: CustomEvent) => {
      const newPlan = event.detail
      setOrganizationData((prev: any) => ({
        ...prev,
        plan: newPlan,
        accountCount: newPlan === 'PRO' ? 10 : 1
      }))
      setIsPro(newPlan === 'PRO')
    }

    window.addEventListener('planUpgraded' as any, handlePlanUpgrade as any)

    return () => {
      window.removeEventListener('planUpgraded' as any, handlePlanUpgrade as any)
    }
  }, [])

  const handleLogout = async () => {
    try {
      const response = await apiClient.post('/api/auth/logout')
      logger.info('Logout successful', response)
      // Redirecionar para login após logout bem-sucedido
      router.push('/login')
    } catch (error) {
      logger.error('Logout failed:', { error })
      // Mesmo com erro, tentar redirecionar
      router.push('/login')
    }
  }

  if (loading) {
    return <PremiumLoader isPro={isPro} />
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-black via-gray-950 to-black" role="main">
      {/* Ultra Modern Header 2025 - Mobile Optimized with iOS Safe Area */}
      <header className="sticky top-0 z-50 bg-black">
        {/* iOS Safe Area Top - Black Background */}
        <div className="pt-[env(safe-area-inset-top,20px)] bg-black"></div>
        {/* Main Header Content */}
        <div className="backdrop-blur-2xl bg-gradient-to-b from-black/90 to-black/80 border-b border-white/5 shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-r from-gold/3 via-transparent to-gold/3 opacity-50"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 sm:h-20 lg:h-24 flex items-center justify-between relative">
            {/* Premium Brand Identity - Mobile Optimized */}
            <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
              {/* ML Agent Logo - Clean & Minimal */}
              <Image
                src="/mlagent-logo-3d.svg"
                alt="ML Agent"
                width={64}
                height={64}
                className="h-10 sm:h-12 lg:h-16 w-auto object-contain hover:scale-105 transition-transform duration-500"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(255, 230, 0, 0.2))',
                }}
              />

              {/* Brand Text with Account Count */}
              <div className="flex items-center gap-2 sm:gap-3">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-light text-white tracking-wide">
                  ML Agent
                </h1>
                {organizationData?.plan && organizationData.plan !== 'TRIAL' && organizationData.plan !== 'FREE' && (
                  <span className="text-lg sm:text-2xl lg:text-3xl font-bold italic bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent tracking-wider pr-2">
                    {organizationData.plan.toUpperCase()}
                  </span>
                )}

                {/* Account Count - Matching MLAccountSwitcher Style */}
                <div className="hidden sm:flex items-center gap-1.5 ml-2 sm:ml-4 px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                  <span className="text-xs font-medium text-gold">
                    {organizationData?.accountCount || 1}
                  </span>
                  <span className="text-xs text-gray-500">
                    {organizationData?.accountCount === 1 ? 'conta' : 'contas'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Premium Actions - Ultra Minimalista */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Account Switcher Container - Mobile First Ultra Clean */}
              <div className="[&>div]:!min-w-0 [&>div]:!w-auto sm:[&>div]:!min-w-[200px] lg:[&>div]:!min-w-[240px]
                          [&>div]:!border-white/5 [&>div]:!bg-black/20 hover:[&>div]:!border-white/10
                          [&>div]:!shadow-none [&>div]:!rounded-lg
                          [&_button]:!h-10 [&_button]:!px-2 sm:[&_button]:!px-3 lg:[&_button]:!px-4
                          [&_button]:!min-w-0">
                <MLAccountSwitcher />
              </div>

              {/* Clean Divider */}
              <div className="hidden sm:block h-6 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

              {/* Logout Button - Minimal */}
              <button
                onClick={handleLogout}
                className="group p-2 rounded-lg hover:bg-white/5 transition-all duration-300"
                title="Sair"
              >
                <LogOut className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Gradient Line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>
        </div>
      </header>

      {/* Main Content Area - Mobile Optimized */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-10 space-y-4 sm:space-y-6 lg:space-y-10">
        {/* Central de Atendimento Section - Mobile Optimized */}
        <section className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

          <div className="relative z-10 p-4 sm:p-6 lg:p-8">
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-3 relative w-full sm:w-auto">
                  {/* Online Status - Mobile Top Right - Aligned with Title */}
                  <div className="absolute -top-1 right-0 sm:hidden z-20">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 backdrop-blur">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-gray-400 font-semibold">Online</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                    <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                      Central de Atendimento
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                      Responda rapidamente para manter sua reputação em alta
                    </p>
                  </div>
                </div>

                {/* Filters Container - Aligned with title */}
                <div id="questions-filters-container" className="w-full sm:w-auto sm:mt-2" />
              </div>
            </div>

            <MultiAccountQuestions
              key={refreshKey}
              selectedAccountId={selectedAccountId}
              filterStatus="pending"
              showFilters={true}
              renderFiltersTo="questions-filters-container"
              pageKey="central-atendimento"
            />
          </div>
        </section>

        {/* Dashboard Tabs Section - Ultra Premium 2025 - Mobile Optimized */}
        <section className="relative">
          {/* Glow Effect Background */}
          <div className="absolute -inset-1 bg-gradient-to-r from-gold/10 via-transparent to-gold/10 blur-xl sm:blur-3xl opacity-30 pointer-events-none" />

          <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="relative">
            {/* Tab Navigation Container - Mobile Optimized */}
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-[2rem] bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl">
              {/* Inner Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-gold/5 to-transparent opacity-50 pointer-events-none" />

              <TabsList className="relative w-full h-14 sm:h-16 lg:h-20 bg-transparent p-2 sm:p-3 lg:p-4 flex items-center justify-center gap-1 sm:gap-2 lg:gap-4">
                {/* Dashboard Tab - Mobile Optimized */}
                <TabsTrigger
                  value="dashboard"
                  className="group relative flex-1 h-10 sm:h-11 lg:h-12 px-2 sm:px-3 lg:px-5 rounded-xl sm:rounded-xl lg:rounded-2xl font-bold text-xs sm:text-sm lg:text-base transition-all duration-500 overflow-hidden
                    data-[state=inactive]:bg-white/[0.02] data-[state=inactive]:hover:bg-white/[0.05]
                    data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-gold data-[state=active]:via-gold-light data-[state=active]:to-gold
                    data-[state=active]:text-black data-[state=active]:shadow-2xl data-[state=active]:shadow-gold/40
                    flex items-center justify-center gap-1 sm:gap-1.5 lg:gap-2"
                >
                  {/* Animated Background for Inactive State */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 data-[state=active]:hidden" />

                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 relative z-10" />
                  <span className="relative z-10 font-semibold text-xs sm:text-sm lg:text-base hidden sm:inline">Dashboard</span>

                  {/* Active State Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-data-[state=active]:animate-shimmer" />
                </TabsTrigger>

                {/* History Tab - Mobile Optimized */}
                <TabsTrigger
                  value="all-questions"
                  className="group relative flex-1 h-10 sm:h-11 lg:h-12 px-2 sm:px-3 lg:px-5 rounded-xl sm:rounded-xl lg:rounded-2xl font-bold text-xs sm:text-sm lg:text-base transition-all duration-500 overflow-hidden
                    data-[state=inactive]:bg-white/[0.02] data-[state=inactive]:hover:bg-white/[0.05]
                    data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-gold data-[state=active]:via-gold-light data-[state=active]:to-gold
                    data-[state=active]:text-black data-[state=active]:shadow-2xl data-[state=active]:shadow-gold/40
                    flex items-center justify-center gap-1 sm:gap-1.5 lg:gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 data-[state=active]:hidden" />

                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 relative z-10" />
                  <span className="relative z-10 font-semibold text-xs sm:text-sm lg:text-base hidden sm:inline">Histórico</span>

                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-data-[state=active]:animate-shimmer" />
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-4 sm:mt-6 lg:mt-8">
              <TabsContent value="dashboard" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                  <MLAgentDashboardModern />
                  <MetricsROIModern
                    accountId={selectedAccountId}
                    organizationId={organizationData?.organizationId || ""}
                  />
                  <MLAccountsPodium
                    organizationId={organizationData?.organizationId || ""}
                    onAddAccount={() => setIsAddAccountModalOpen(true)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="all-questions" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                {/* Histórico Section - Matching Central de Atendimento Design - Mobile Optimized */}
                <section className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
                  {/* Background Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

                  <div className="relative z-10 p-4 sm:p-6 lg:p-8">
                    <div className="mb-4 sm:mb-6 lg:mb-8">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                              Histórico de Atendimento
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                              Visualize o histórico completo de perguntas respondidas
                            </p>
                          </div>
                        </div>
                        {/* Portal container for filters - positioned at top right */}
                        <div id="historico-filters-portal" className="flex items-center" />
                      </div>
                    </div>

                    <MultiAccountQuestions
                      key={refreshKey + 100}
                      selectedAccountId={selectedAccountId}
                      filterStatus="completed"
                      showFilters={true}
                      renderFiltersTo="historico-filters-portal"
                      pageKey="historico-atendimento"
                    />
                  </div>
                </section>
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </main>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        onSuccess={() => {
          setIsAddAccountModalOpen(false)
          setRefreshKey(prev => prev + 1)
          setAccountsCount(prev => prev + 1)
        }}
        currentAccountCount={accountsCount}
        maxAccounts={isPro ? 10 : 1}
        subscriptionStatus={organizationData?.plan || 'TRIAL'}
      />

      {/* PRO Activation Modal */}
      <ProActivationModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        onActivate={() => {
          setIsPro(true)
          setOrganizationData((prev: any) => ({
            ...prev,
            plan: 'PRO',
            accountCount: 10
          }))
        }}
      />
    </div>
  )
}
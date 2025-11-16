'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MLAccountSwitcher } from '@/components/ml-account-switcher'
import { PremiumLoader } from '@/components/ui/premium-loader'
import { AddAccountModal } from '@/components/add-account-modal'
import { ProActivationModal } from '@/components/pro-activation-modal'
import {
  MessageSquare,
  Activity,
  LogOut,
  Trophy
} from 'lucide-react'

// 🚀 ENTERPRISE: Lazy loading de componentes pesados para initial load rápido
const MLAgentDashboardModern = lazy(() => import('@/components/dashboard/ml-agent-dashboard-modern').then(mod => ({ default: mod.MLAgentDashboardModern })))
const MultiAccountQuestions = lazy(() => import('@/components/agent/multi-account-questions').then(mod => ({ default: mod.MultiAccountQuestions })))
const GamificationDashboard = lazy(() => import('@/components/gamification/gamification-dashboard').then(mod => ({ default: mod.GamificationDashboard })))

// Componente de loading
const ComponentLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Activity className="h-8 w-8 text-gold animate-pulse" />
  </div>
)

export default function AgenteMultiConta() {
  // Add custom style for shimmer animation with proper cleanup
  useEffect(() => {
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
  const [_selectedAccountId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('performance')
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
            {/* Header Section - Title + Filters Inline on Mobile */}
            <div className="mb-4 sm:mb-6 lg:mb-8">
              {/* Mobile: Title Left + Filters Right in same row */}
              <div className="flex items-start justify-between gap-2 mb-3 sm:mb-0">
                {/* Title Section - Left Side */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                    <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                      <span className="lg:hidden">Atendimento</span>
                      <span className="hidden lg:inline">Central de Atendimento</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 hidden lg:block">
                      Responda rapidamente para manter sua reputação em alta
                    </p>
                  </div>
                </div>

                {/* Filters Container - Right Side (Mobile and Desktop) */}
                <div id="questions-filters-container" className="flex-shrink-0 relative z-50" />
              </div>
            </div>

            <Suspense fallback={<ComponentLoader />}>
              <MultiAccountQuestions
                key={refreshKey}
                selectedAccountId={null}
                filterStatus="pending"
                showFilters={true}
                renderFiltersTo="questions-filters-container"
                pageKey="central-atendimento"
              />
            </Suspense>
          </div>
        </section>

        {/* Dashboard Tabs Section - Ultra Modern 2025 Glassmorphism Fixed Height */}
        <section className="relative">
          <Tabs defaultValue="performance" value={activeTab} onValueChange={setActiveTab} className="relative">
            {/* Tab Navigation - Pill Style with Fixed Container Height */}
            <div className="relative flex justify-center mb-5 sm:mb-6">
              {/* Fixed Height Container - Prevents Layout Shift */}
              <div className="relative h-12 sm:h-[52px] lg:h-14 flex items-center">
                <TabsList className="relative inline-flex h-full p-1 sm:p-1.5 gap-1 sm:gap-1.5
                  bg-black/40 backdrop-blur-2xl
                  rounded-full
                  border border-white/[0.08]
                  shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                  before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none
                  after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none">

                  {/* Performance Tab - FIXED HEIGHT */}
                  <TabsTrigger
                    value="performance"
                    className="group relative z-10
                      min-w-[100px] sm:min-w-[140px] lg:min-w-[160px]
                      px-4 sm:px-6 lg:px-8
                      h-10 sm:h-11 lg:h-12
                      rounded-full
                      font-medium text-xs sm:text-sm lg:text-base
                      transition-colors duration-300 ease-out

                      border border-transparent

                      data-[state=inactive]:text-gray-400
                      data-[state=inactive]:hover:text-white
                      data-[state=inactive]:hover:bg-white/[0.03]

                      data-[state=active]:text-white
                      data-[state=active]:bg-gradient-to-br data-[state=active]:from-white/[0.12] data-[state=active]:to-white/[0.06]
                      data-[state=active]:shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)]
                      data-[state=active]:border-gold/30

                      flex items-center justify-center gap-2 sm:gap-2.5
                      touch-manipulation
                      active:scale-[0.98]
                      will-change-[background-color,border-color,color]"
                  >
                    <Activity
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0
                      transition-all duration-300
                      group-data-[state=active]:text-gold
                      group-data-[state=inactive]:opacity-60 group-hover:opacity-100"
                      strokeWidth={2.5}
                    />
                    <span className="font-semibold tracking-wide whitespace-nowrap">Performance</span>
                  </TabsTrigger>

                  {/* Ranking Tab - FIXED HEIGHT */}
                  <TabsTrigger
                    value="gamification"
                    className="group relative z-10
                      min-w-[100px] sm:min-w-[140px] lg:min-w-[160px]
                      px-4 sm:px-6 lg:px-8
                      h-10 sm:h-11 lg:h-12
                      rounded-full
                      font-medium text-xs sm:text-sm lg:text-base
                      transition-colors duration-300 ease-out

                      border border-transparent

                      data-[state=inactive]:text-gray-400
                      data-[state=inactive]:hover:text-white
                      data-[state=inactive]:hover:bg-white/[0.03]

                      data-[state=active]:text-white
                      data-[state=active]:bg-gradient-to-br data-[state=active]:from-white/[0.12] data-[state=active]:to-white/[0.06]
                      data-[state=active]:shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)]
                      data-[state=active]:border-gold/30

                      flex items-center justify-center gap-2 sm:gap-2.5
                      touch-manipulation
                      active:scale-[0.98]
                      will-change-[background-color,border-color,color]"
                  >
                    <Trophy
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0
                      transition-all duration-300
                      group-data-[state=active]:text-gold
                      group-data-[state=inactive]:opacity-60 group-hover:opacity-100"
                      strokeWidth={2.5}
                    />
                    <span className="font-semibold tracking-wide whitespace-nowrap">Ranking</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Content Container - Matching Glassmorphism */}
            <div className="relative rounded-2xl sm:rounded-3xl
              bg-black/40 backdrop-blur-2xl
              border border-white/[0.08]
              shadow-[0_8px_32px_rgba(0,0,0,0.4)]
              before:absolute before:inset-0 before:rounded-2xl sm:before:rounded-3xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none
              after:absolute after:inset-0 after:rounded-2xl sm:after:rounded-3xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none
              overflow-hidden">

              <TabsContent value="performance" className="relative z-10 p-4 sm:p-6 lg:p-8 m-0
                data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2
                data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:slide-out-to-top-2
                duration-500">
                <Suspense fallback={<ComponentLoader />}>
                  <MLAgentDashboardModern />
                </Suspense>
              </TabsContent>

              <TabsContent value="gamification" className="relative z-10 p-4 sm:p-6 lg:p-8 m-0
                data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2
                data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:slide-out-to-top-2
                duration-500">
                <Suspense fallback={<ComponentLoader />}>
                  <GamificationDashboard />
                </Suspense>
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
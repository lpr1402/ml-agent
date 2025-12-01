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
  Trophy,
  Settings
} from 'lucide-react'

// 🚀 ENTERPRISE: Lazy loading de componentes pesados para initial load rápido
const MLAgentDashboardModern = lazy(() => import('@/components/dashboard/ml-agent-dashboard-modern').then(mod => ({ default: mod.MLAgentDashboardModern })))
const MultiAccountQuestions = lazy(() => import('@/components/agent/multi-account-questions').then(mod => ({ default: mod.MultiAccountQuestions })))
const GamificationDashboard = lazy(() => import('@/components/gamification/gamification-dashboard').then(mod => ({ default: mod.GamificationDashboard })))
const OrganizationSettings = lazy(() => import('@/components/settings/organization-settings').then(mod => ({ default: mod.OrganizationSettings })))
const PlatformInfo = lazy(() => import('@/components/settings/platform-info').then(mod => ({ default: mod.PlatformInfo })))

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
  const [activeSection, setActiveSection] = useState<'atendimento' | 'performance' | 'ranking' | 'configuracoes' | null>(null)


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

  // Auto-detect active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { id: 'central-atendimento', name: 'atendimento' as const },
        { id: 'dashboard-section', name: 'performance' as const },
        { id: 'configuracoes-section', name: 'configuracoes' as const }
      ]

      // Get current scroll position with offset for sticky header
      const scrollY = window.scrollY + 200 // Offset for header height

      // Check if we're at the top (before first section)
      const firstSectionConfig = sections[0]
      if (firstSectionConfig) {
        const firstSection = document.getElementById(firstSectionConfig.id)
        if (firstSection && scrollY < firstSection.offsetTop) {
          setActiveSection(null)
          return
        }
      }

      // Find which section is currently in view
      let foundSection = false
      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollY >= offsetTop && scrollY < offsetTop + offsetHeight) {
            // Special handling for dashboard section - check active tab
            if (section.name === 'performance' && activeTab === 'gamification') {
              setActiveSection('ranking')
            } else {
              setActiveSection(section.name)
            }
            foundSection = true
            break
          }
        }
      }

      // If no section found and we're past the last section, keep the last one active
      if (!foundSection) {
        const lastSectionConfig = sections[sections.length - 1]
        if (lastSectionConfig) {
          const lastElement = document.getElementById(lastSectionConfig.id)
          if (lastElement && scrollY >= lastElement.offsetTop) {
            setActiveSection(lastSectionConfig.name)
          }
        }
      }
    }

    // Throttle scroll events for performance
    let ticking = false
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })

    // Initial check
    handleScroll()

    return () => {
      window.removeEventListener('scroll', throttledScroll)
    }
  }, [activeTab])

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

  // Navegação entre seções com scroll suave
  const handleSectionChange = (section: 'atendimento' | 'performance' | 'ranking' | 'configuracoes') => {
    // Atualizar seção ativa
    setActiveSection(section)

    // Scroll suave para a seção
    const sectionId = section === 'atendimento' ? 'central-atendimento' :
                      section === 'performance' ? 'dashboard-section' :
                      section === 'ranking' ? 'dashboard-section' :
                      'configuracoes-section'

    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Se for performance ou ranking, mudar a tab ativa
    if (section === 'performance') {
      setActiveTab('performance')
    } else if (section === 'ranking') {
      setActiveTab('gamification')
    }
  }

  if (loading) {
    return <PremiumLoader isPro={isPro} />
  }

  return (
    <div className="min-h-screen min-h-[100dvh] relative overflow-x-hidden" role="main">
      {/* Premium Metallic Background - Multi-Layer Effect */}

      {/* Base Layer - Dark gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 -z-10" />

      {/* Metallic Shine Layer - Creates depth */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-800/20 via-transparent to-gray-800/20 -z-10" />

      {/* Gold Accent Layer - Subtle premium glow */}
      <div className="fixed inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none -z-10" />

      {/* Radial Glow - Spotlight effect */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.08),transparent_50%)] pointer-events-none -z-10" />

      {/* Noise Texture - Adds metallic grain */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none -z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      />
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
                src="/mlagent-logo-3d.png"
                alt="ML Agent"
                width={64}
                height={64}
                className="h-10 sm:h-12 lg:h-16 w-auto object-contain hover:scale-105 transition-transform duration-500"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(255, 230, 0, 0.2))',
                }}
              />

              {/* Brand Logo - Sempre mostra a imagem ML Agent PRO - DESTACADA */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Image
                  src="/mlagent-pro-logo.png"
                  alt="ML Agent PRO"
                  width={1024}
                  height={230}
                  className="h-6 xs:h-7 sm:h-8 md:h-10 lg:h-12 w-auto object-contain hover:scale-105 transition-transform duration-300"
                  style={{
                    filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.35)) drop-shadow(0 0 30px rgba(212, 175, 55, 0.15))',
                    maxWidth: '280px'
                  }}
                  priority
                />

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
              {/* Account Switcher - Premium & Responsivo */}
              <MLAccountSwitcher />

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

      {/* Navigation Breadcrumbs - Premium Tab Style */}
      <div className="sticky top-[64px] sm:top-[80px] lg:top-[96px] z-40 bg-gradient-to-b from-black via-black/95 to-transparent backdrop-blur-xl">
        <div className="w-full py-2.5 sm:py-3 px-3 sm:px-4 md:px-6 lg:container lg:mx-auto">
          {/* Premium Tab Container */}
          <div className="relative flex justify-center">
            <div className="relative flex items-center">
              <nav
                className="relative inline-flex items-center h-10 sm:h-11 lg:h-12 p-1 sm:p-1.5 gap-1 sm:gap-1.5
                  bg-black/40 backdrop-blur-2xl
                  rounded-xl sm:rounded-2xl
                  border border-white/[0.08]
                  shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                  before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none
                  after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none
                  overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch]"
                aria-label="Navegação de seções"
              >
                {/* Atendimento */}
                <button
                  onClick={() => handleSectionChange('atendimento')}
                  className={`group relative z-10
                    min-w-[70px] sm:min-w-[100px] lg:min-w-[120px]
                    px-3 sm:px-4 lg:px-6
                    h-full
                    rounded-lg sm:rounded-xl
                    font-medium text-[10px] sm:text-xs lg:text-sm
                    transition-all duration-300 ease-out
                    border border-transparent
                    flex items-center justify-center gap-1 sm:gap-2
                    touch-manipulation
                    active:scale-[0.98]
                    whitespace-nowrap
                    ${activeSection === 'atendimento'
                      ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                >
                  <MessageSquare className={`w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0
                    transition-all duration-300
                    ${activeSection === 'atendimento' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`}
                    strokeWidth={2.5} />
                  <span className="font-semibold tracking-wide">Atendimento</span>
                </button>

                {/* Performance */}
                <button
                  onClick={() => handleSectionChange('performance')}
                  className={`group relative z-10
                    min-w-[70px] sm:min-w-[100px] lg:min-w-[120px]
                    px-3 sm:px-4 lg:px-6
                    h-full
                    rounded-lg sm:rounded-xl
                    font-medium text-[10px] sm:text-xs lg:text-sm
                    transition-all duration-300 ease-out
                    border border-transparent
                    flex items-center justify-center gap-1 sm:gap-2
                    touch-manipulation
                    active:scale-[0.98]
                    whitespace-nowrap
                    ${activeSection === 'performance'
                      ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                >
                  <Activity className={`w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0
                    transition-all duration-300
                    ${activeSection === 'performance' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`}
                    strokeWidth={2.5} />
                  <span className="font-semibold tracking-wide">Performance</span>
                </button>

                {/* Ranking */}
                <button
                  onClick={() => handleSectionChange('ranking')}
                  className={`group relative z-10
                    min-w-[70px] sm:min-w-[100px] lg:min-w-[120px]
                    px-3 sm:px-4 lg:px-6
                    h-full
                    rounded-lg sm:rounded-xl
                    font-medium text-[10px] sm:text-xs lg:text-sm
                    transition-all duration-300 ease-out
                    border border-transparent
                    flex items-center justify-center gap-1 sm:gap-2
                    touch-manipulation
                    active:scale-[0.98]
                    whitespace-nowrap
                    ${activeSection === 'ranking'
                      ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                >
                  <Trophy className={`w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0
                    transition-all duration-300
                    ${activeSection === 'ranking' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`}
                    strokeWidth={2.5} />
                  <span className="font-semibold tracking-wide">Ranking</span>
                </button>

                {/* Configurações */}
                <button
                  onClick={() => handleSectionChange('configuracoes')}
                  className={`group relative z-10
                    min-w-[60px] sm:min-w-[100px] lg:min-w-[120px]
                    px-2 sm:px-4 lg:px-6
                    h-full
                    rounded-lg sm:rounded-xl
                    font-medium text-[10px] sm:text-xs lg:text-sm
                    transition-all duration-300 ease-out
                    border border-transparent
                    flex items-center justify-center gap-1 sm:gap-2
                    touch-manipulation
                    active:scale-[0.98]
                    whitespace-nowrap
                    ${activeSection === 'configuracoes'
                      ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                >
                  <Settings className={`w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0
                    transition-all duration-300
                    ${activeSection === 'configuracoes' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`}
                    strokeWidth={2.5} />
                  <span className="font-semibold tracking-wide">Config</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Mobile-First Optimized */}
      <main className="w-full px-3 sm:px-4 md:px-6 lg:container lg:mx-auto py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Central de Atendimento Section - No Container, Direct Content */}
        <section id="central-atendimento" className="relative">
          {/* Header Section - Mobile Optimized */}
          <div className="mb-5 sm:mb-6">
            <div className="flex items-center sm:items-start justify-between gap-3 sm:gap-4">
              {/* Title Section - Perfect Mobile Size */}
              <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-black" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold tracking-tight">
                    <span className="lg:hidden">Atendimento</span>
                    <span className="hidden lg:inline">Central de Atendimento</span>
                  </h3>
                  <p className="text-xs text-gray-400 hidden sm:block lg:text-sm mt-0.5">
                    Responda rapidamente para manter sua reputação
                  </p>
                </div>
              </div>

              {/* Filters Container - Alinhado verticalmente com título em mobile */}
              <div id="questions-filters-container" className="flex-shrink-0 relative z-50" />
            </div>
          </div>

          {/* Questions List - Direct Content */}
          <Suspense fallback={<ComponentLoader />}>
            <MultiAccountQuestions
              key={refreshKey}
              selectedAccountId={null}
              filterStatus="pending" // Mostrar apenas perguntas PENDENTES por padrão
              showFilters={true}
              renderFiltersTo="questions-filters-container"
              pageKey="central-atendimento"
            />
          </Suspense>
        </section>

        {/* Dashboard Tabs Section - Ultra Modern 2025 Glassmorphism Fixed Height */}
        <section
          id="dashboard-section"
          className="relative transition-all duration-500"
        >
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

                  {/* Performance Tab */}
                  <TabsTrigger
                    value="performance"
                    className="group relative z-10
                      min-w-[100px] sm:min-w-[140px] lg:min-w-[160px]
                      px-4 sm:px-6 lg:px-8
                      h-full
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

                  {/* Ranking Tab */}
                  <TabsTrigger
                    value="gamification"
                    className="group relative z-10
                      min-w-[100px] sm:min-w-[140px] lg:min-w-[160px]
                      px-4 sm:px-6 lg:px-8
                      h-full
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

            {/* Content - Direct, No Container */}
            <div className="relative">
              <TabsContent value="performance" className="m-0
                data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2
                data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:slide-out-to-top-2
                duration-500">
                <Suspense fallback={<ComponentLoader />}>
                  <MLAgentDashboardModern />
                </Suspense>
              </TabsContent>

              <TabsContent value="gamification" className="m-0
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

        {/* Configurações Section - Direct Content */}
        <section id="configuracoes-section" className="relative">
          {/* Header - Mobile Optimized */}
          <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold tracking-tight">
                Configurações da Organização
              </h3>
              <p className="text-xs text-gray-400 hidden sm:block lg:text-sm mt-0.5">
                Gerencie dados da organização, segurança e preferências
              </p>
            </div>
          </div>

          {/* Settings Content - Direct */}
          <Suspense fallback={<ComponentLoader />}>
            <OrganizationSettings />
          </Suspense>

          {/* 🎯 DIVISOR CLEAN - Apenas linha */}
          <div className="w-full border-t border-white/[0.06] my-8 sm:my-10 lg:my-12" />

          {/* Platform Info - Sobre a Plataforma */}
          <div>
            <Suspense fallback={<ComponentLoader />}>
              <PlatformInfo />
            </Suspense>
          </div>
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

      {/* Premium Footer - AXNEXLABS Branding */}
      <footer className="relative w-full border-t border-white/5 mt-12 sm:mt-16 lg:mt-20">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:container lg:mx-auto py-8 sm:py-10 lg:py-12">
          <div className="flex flex-col items-center justify-center gap-3 sm:gap-4">
            {/* Branding - Maior e Mais Bonito */}
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <span className="text-sm sm:text-base lg:text-lg text-gray-400 font-medium">Uma criação</span>
              <Image
                src="/axnexlabs-logo.png"
                alt="AxnexLabs"
                width={1024}
                height={450}
                className="h-12 sm:h-16 md:h-18 lg:h-20 xl:h-24 w-auto object-contain opacity-80 hover:opacity-100 transition-all duration-500 hover:scale-105"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.1))'
                }}
              />
              <span className="text-xs sm:text-sm text-gray-500 font-light">
                Versão Brasileira 4.1/1911 Hebert Richards
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
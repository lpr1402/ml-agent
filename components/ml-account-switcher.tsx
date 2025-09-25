'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { getValidAvatarUrl } from '@/lib/utils/avatar-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ChevronDown,
  Check,
  Plus,
  RefreshCw,
  User,
  Users,
  Sparkles,
  Crown
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import { AddAccountModal } from '@/components/add-account-modal'

interface MLAccount {
  id: string
  mlUserId: string
  nickname: string
  email?: string
  siteId: string
  thumbnail?: string
  isPrimary: boolean
  isActive: boolean
  isCurrentActive: boolean
  tokenValid: boolean
  connectionError?: string
  permalink?: string  // Link do perfil no ML
}

export function MLAccountSwitcher() {
  const [accounts, setAccounts] = useState<MLAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [organizationInfo, setOrganizationInfo] = useState<{
    subscriptionStatus: string
    accountCount: number
    maxAccounts: number
  }>({
    subscriptionStatus: 'TRIAL',
    accountCount: 0,
    maxAccounts: 1
  })

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await apiClient.get('/api/ml-accounts/switch')
      setAccounts(response.accounts)
      setActiveAccountId(response.activeAccountId)

      // Buscar informações da organização para o modal
      if (response.organizationId) {
        const orgResponse = await apiClient.get('/api/ml-accounts/organization-info')
        if (orgResponse) {
          setOrganizationInfo({
            subscriptionStatus: orgResponse.subscriptionStatus || 'TRIAL',
            accountCount: response.accounts.length,
            maxAccounts: orgResponse.maxAccounts || 1
          })
        }
      }

      // Se não há imagem em nenhuma conta, tenta buscar do ML
      const hasNoImages = response.accounts.every((acc: MLAccount) => !acc.thumbnail)
      if (hasNoImages) {
        logger.info('[MLAccountSwitcher] No profile images found, fetching from ML...')
        try {
          await apiClient.get('/api/ml-accounts/update-profile-image')
          logger.info('[MLAccountSwitcher] Avatar update process initiated')

          // Aguardar um pouco e recarregar contas
          setTimeout(async () => {
            const refreshedResponse = await apiClient.get('/api/ml-accounts/switch')
            setAccounts(refreshedResponse.accounts)
            logger.info('[MLAccountSwitcher] Accounts refreshed with avatars')
          }, 2000)
        } catch (updateError) {
          logger.warn('[MLAccountSwitcher] Failed to update profile images:', { error: updateError })
        }
      }
    } catch (error) {
      logger.error('Failed to fetch accounts:', { error })
    } finally {
      setLoading(false)
    }
  }

  const switchAccount = async (accountId: string) => {
    if (accountId === activeAccountId || switching) return
    
    setSwitching(true)
    try {
      await apiClient.post('/api/ml-accounts/switch', { accountId })
      setActiveAccountId(accountId)
      
      // Recarregar a página para atualizar todos os dados
      window.location.reload()
    } catch (error) {
      logger.error('Failed to switch account:', { error })
      toast({
        title: "Erro ao trocar de conta",
        description: "Não foi possível trocar de conta. Por favor, tente novamente.",
        variant: "destructive"
      })
    } finally {
      setSwitching(false)
    }
  }

  const addNewAccount = () => {
    // Abrir modal para adicionar nova conta
    setIsModalOpen(true)
  }
  
  const handleModalSuccess = () => {
    // Recarregar contas após adicionar com sucesso
    fetchAccounts()
    setIsModalOpen(false)
  }

  const activeAccount = accounts.find(acc => acc.id === activeAccountId)

  if (loading) {
    return (
      <div className="relative rounded-xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />
        <Button
          variant="ghost"
          disabled
          className="relative min-w-[280px] h-12 px-4 bg-transparent"
        >
          <RefreshCw className="h-4 w-4 mr-2 animate-spin text-gold drop-shadow-lg" />
          <span className="text-gray-400 text-sm font-medium">Carregando contas...</span>
        </Button>
      </div>
    )
  }

  if (!activeAccount) {
    return (
      <div className="relative rounded-xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-xl overflow-hidden hover:border-gold/20 transition-all duration-300">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />
        <Button
          variant="ghost"
          onClick={addNewAccount}
          className="relative min-w-[280px] h-12 px-4 bg-transparent text-gold font-semibold group"
        >
          <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-500 drop-shadow-lg" />
          <span className="text-sm">Conectar Conta ML</span>
        </Button>
      </div>
    )
  }

  // Get profile image with proper validation
  const profileImage = getValidAvatarUrl(activeAccount.thumbnail)

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
        <div className="relative rounded-xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-xl overflow-hidden hover:border-white/10 transition-all duration-300">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

          <Button
            variant="ghost"
            className="relative group px-4 py-2 h-12 min-w-[280px] bg-transparent w-full"
            disabled={switching}
          >
          <div className="relative flex items-center gap-3 w-full">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="h-8 w-8 ring-1 ring-white/10 group-hover:ring-gold/30 transition-all duration-300">
                {profileImage ? (
                  <AvatarImage
                    src={profileImage}
                    alt={activeAccount.nickname}
                    className="object-cover"
                    onError={(e) => {
                      logger.error('[MLAccountSwitcher] Image load error:', {
                        src: profileImage,
                        nickname: activeAccount.nickname
                      })
                      // Hide broken image and show fallback
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                ) : (
                  <AvatarFallback className="bg-black/50 text-gray-400 border border-white/10">
                    <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                  </AvatarFallback>
                )}
              </Avatar>
            </div>

            {/* Account Info - Hidden on mobile, shown on sm and up */}
            <div className="hidden sm:flex flex-col items-start text-left flex-1">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-xs sm:text-sm font-medium text-white group-hover:text-gold transition-colors duration-300 max-w-[80px] sm:max-w-[120px] lg:max-w-[140px] truncate">
                  {activeAccount.nickname}
                </span>
                {activeAccount.isPrimary && (
                  <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gold opacity-60" />
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 hidden lg:block">
                {activeAccount.siteId} • {activeAccount.mlUserId}
              </span>
            </div>

            {/* Chevron Icon */}
            <ChevronDown
              className={`h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-gray-400 group-hover:text-gold transition-all duration-300 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </div>

          {/* Loading Overlay */}
          {switching && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md rounded-xl flex items-center justify-center z-20">
              <RefreshCw className="h-5 w-5 animate-spin text-gold drop-shadow-lg" />
            </div>
          )}
          </Button>
        </div>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        className="w-[280px] sm:w-[340px] lg:w-[380px] bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Background Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        {/* Premium Header with Gold Accent - Mobile Optimized */}
        <div className="relative px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 lg:py-4 border-b border-white/5 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gold animate-pulse" />
              <h3 className="text-xs sm:text-sm font-semibold text-white">Contas Conectadas</h3>
            </div>
            <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
              {accounts.length} {accounts.length === 1 ? 'conta' : 'contas'}
            </span>
          </div>
        </div>

        {/* Accounts List - Mobile Optimized */}
        <div className="relative p-2 sm:p-2.5 lg:p-3 max-h-[300px] sm:max-h-[350px] lg:max-h-[400px] overflow-y-auto custom-scrollbar">
          {accounts.map((account) => {
            const accountImage = getValidAvatarUrl(account.thumbnail)
            const isActive = account.id === activeAccountId

            return (
              <DropdownMenuItem
                key={account.id}
                onClick={() => switchAccount(account.id)}
                className={`
                  relative cursor-pointer p-2.5 sm:p-3 lg:p-3.5 rounded-lg sm:rounded-xl transition-all duration-300 mb-1.5 sm:mb-2 last:mb-0
                  ${isActive
                    ? 'bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/30 shadow-lg'
                    : 'hover:bg-white/[0.03] border border-white/5 hover:border-white/10'
                  }
                  ${!account.isActive ? 'opacity-40 cursor-not-allowed' : ''}
                  group overflow-hidden
                `}
                disabled={!account.isActive || switching}
              >
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-gold/0 via-gold/5 to-gold/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    {/* Premium Avatar */}
                    <div className="relative">
                      <Avatar className={`h-10 w-10 ring-2 ${isActive ? 'ring-gold/50' : 'ring-white/10'} transition-all duration-300`}>
                        {accountImage ? (
                          <AvatarImage
                            src={accountImage}
                            alt={account.nickname}
                            className="object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900 text-gray-400 border border-white/10">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </div>

                    {/* Account Info with Premium Typography */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`
                          text-sm font-semibold tracking-wide
                          ${isActive ? 'text-gold' : 'text-white group-hover:text-gold-light'}
                          transition-colors duration-300
                        `}>
                          {account.nickname}
                        </span>
                        {account.isPrimary && (
                          <Crown className="h-3 w-3 text-gold opacity-70" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-medium">
                          {account.siteId}
                        </span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500">
                          ID: {account.mlUserId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-2">
                    {!account.tokenValid && (
                      <div className="px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                        <span className="text-[10px] text-red-400 font-medium">Token Expirado</span>
                      </div>
                    )}
                    {isActive && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center">
                        <Check className="h-4 w-4 text-gold" />
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>

        {/* Add Account Button - Ultra Premium Design */}
        {accounts.length < organizationInfo.maxAccounts && (
          <>
            <div className="relative mx-3 my-3">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
            </div>

            <div className="p-3">
              <DropdownMenuItem
                onClick={addNewAccount}
                className="relative cursor-pointer p-4 rounded-xl bg-gradient-to-br from-gold/10 via-gold/5 to-transparent hover:from-gold/20 hover:via-gold/10 transition-all duration-300 border border-gold/20 hover:border-gold/40 group overflow-hidden"
              >
                {/* Shimmer Effect on Hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div className="relative flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gold/30 blur-xl animate-pulse" />
                      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-xl">
                        <Plus className="h-6 w-6 text-black" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-gold block">
                        Adicionar Nova Conta
                      </span>
                      <span className="text-xs text-gray-400">
                        Conecte mais contas do Mercado Livre
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-gold">
                        {organizationInfo.maxAccounts - accounts.length}
                      </span>
                      <span className="text-xs text-gray-500 block">
                        disponíveis
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                      style={{ width: `${(accounts.length / organizationInfo.maxAccounts) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {accounts.length} de {organizationInfo.maxAccounts} contas
                    </span>
                    {organizationInfo.subscriptionStatus === 'TRIAL' && (
                      <div className="flex items-center gap-1 text-gold/80">
                        <Crown className="h-3 w-3" />
                        <span className="font-medium">Upgrade PRO: até 10 contas</span>
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            </div>
          </>
        )}

        {/* Max Accounts Reached - Premium Info */}
        {accounts.length >= organizationInfo.maxAccounts && (
          <>
            <div className="relative mx-3 my-3">
              <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>

            <div className="p-3">
              <div className="relative p-4 rounded-xl bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 border border-white/5 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-20 pointer-events-none" />

                <div className="relative flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 blur-xl" />
                    <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/30">
                      <Users className="h-6 w-6 text-red-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-white block">
                      Limite Máximo Atingido
                    </span>
                    <span className="text-xs text-gray-400">
                      Você possui {organizationInfo.maxAccounts} {organizationInfo.maxAccounts === 1 ? 'conta conectada' : 'contas conectadas'}
                    </span>
                  </div>
                  {organizationInfo.subscriptionStatus === 'TRIAL' && (
                    <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/30">
                      <div className="flex items-center gap-1">
                        <Crown className="h-3 w-3 text-gold" />
                        <span className="text-xs font-semibold text-gold">PRO</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    
    {/* Modal de adicionar conta */}
    <AddAccountModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSuccess={handleModalSuccess}
      currentAccountCount={organizationInfo.accountCount}
      maxAccounts={organizationInfo.maxAccounts}
      subscriptionStatus={organizationInfo.subscriptionStatus}
    />
    </>
  )
}
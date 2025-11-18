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
  const [loading, setLoading] = useState(true)
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

      logger.info('[MLAccountManager] Accounts loaded', {
        count: response.accounts.length
      })
    } catch (error) {
      logger.error('Failed to fetch accounts:', { error })
    } finally {
      setLoading(false)
    }
  }

  const addNewAccount = async () => {
    try {
      logger.info('[MLAccountManager] Initiating OAuth flow for new account')

      // Obter URL de autorização
      const response = await apiClient.get('/api/ml-accounts/add')

      if (!response.authUrl) {
        throw new Error('URL de autorização não recebida')
      }

      logger.info('[MLAccountManager] Opening OAuth window', { authUrl: response.authUrl })

      // Abrir OAuth em nova janela/aba
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const authWindow = window.open(
        response.authUrl,
        'ml-oauth-add-account',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )

      if (!authWindow) {
        alert('⚠️ Popup bloqueado!\n\nPor favor, permita popups para este site e tente novamente.')
        return
      }

      authWindow.focus()

      // Escutar retorno do OAuth
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'ml-oauth-success') {
          logger.info('[MLAccountManager] OAuth success', { account: event.data.account })

          // Recarregar contas (SEM reload da página)
          fetchAccounts()

          // Emitir evento para outros componentes
          window.dispatchEvent(new CustomEvent('accounts:updated'))

          window.removeEventListener('message', handleMessage)
        } else if (event.data.type === 'ml-oauth-error') {
          logger.error('[MLAccountManager] OAuth error', { error: event.data.error })
          window.removeEventListener('message', handleMessage)
        }
      }

      window.addEventListener('message', handleMessage)

    } catch (error: any) {
      logger.error('[MLAccountManager] Error initiating OAuth', { error })
      alert(`Erro ao iniciar autenticação:\n\n${error.message || 'Erro desconhecido'}`)
    }
  }

  if (loading) {
    return (
      <div className="relative rounded-xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-xl overflow-hidden">
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

  if (accounts.length === 0) {
    return (
      <div className="relative rounded-xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-xl overflow-hidden hover:border-gold/20 transition-all duration-300">
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
          >
          <div className="relative flex items-center gap-3 w-full">
            {/* Multiple Avatars Stack */}
            <div className="relative flex items-center">
              {accounts.slice(0, 3).map((account, index) => {
                const accountImage = getValidAvatarUrl(account.thumbnail)
                return (
                  <Avatar
                    key={account.id}
                    className="h-8 w-8 ring-2 ring-gray-900 group-hover:ring-gold/30 transition-all duration-300"
                    style={{ marginLeft: index > 0 ? '-10px' : '0', zIndex: 3 - index }}
                  >
                    {accountImage ? (
                      <AvatarImage
                        src={accountImage}
                        alt={account.nickname}
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="bg-black/50 text-gray-400 border border-white/10">
                        <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                )
              })}
              {accounts.length > 3 && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center ring-2 ring-gray-900 text-[10px] font-bold text-gold" style={{ marginLeft: '-10px', zIndex: 0 }}>
                  +{accounts.length - 3}
                </div>
              )}
            </div>

            {/* Account Info - Hidden on mobile, shown on sm and up */}
            <div className="hidden sm:flex flex-col items-start text-left flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-medium text-white group-hover:text-gold transition-colors duration-300">
                  Contas ML
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500">
                {accounts.length} {accounts.length === 1 ? 'conta' : 'contas'} conectadas
              </span>
            </div>

            {/* Chevron Icon */}
            <ChevronDown
              className={`h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-gray-400 group-hover:text-gold transition-all duration-300 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
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
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs sm:text-sm font-semibold text-white">Contas do Mercado Livre</h3>
            </div>
            <span className="text-[10px] sm:text-xs text-emerald-400 font-medium">
              {accounts.length} ativa{accounts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            Todas as contas funcionam simultaneamente
          </p>
        </div>

        {/* Accounts List - Mobile Optimized */}
        <div className="relative p-2 sm:p-2.5 lg:p-3 max-h-[300px] sm:max-h-[350px] lg:max-h-[400px] overflow-y-auto custom-scrollbar">
          {accounts.map((account) => {
            const accountImage = getValidAvatarUrl(account.thumbnail)

            return (
              <div
                key={account.id}
                className="relative p-2.5 sm:p-3 lg:p-3.5 rounded-lg sm:rounded-xl transition-all duration-300 mb-1.5 sm:mb-2 last:mb-0 bg-gradient-to-r from-white/[0.02] to-transparent border border-white/5 hover:border-gold/20 group overflow-hidden"
              >
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-gold/0 via-gold/5 to-gold/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Premium Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10 ring-2 ring-gold/30 transition-all duration-300">
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
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tracking-wide text-white group-hover:text-gold-light transition-colors duration-300 truncate">
                          {account.nickname}
                        </span>
                        {account.isPrimary && (
                          <Crown className="h-3 w-3 text-gold opacity-70 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-medium">
                          {account.siteId}
                        </span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500 truncate">
                          ID: {account.mlUserId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!account.tokenValid ? (
                      <div className="px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                        <span className="text-[10px] text-red-400 font-medium">Token Expirado</span>
                      </div>
                    ) : account.isActive ? (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center border border-emerald-500/30">
                        <Check className="h-4 w-4 text-emerald-400" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
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

            <div className="p-2 sm:p-3">
              <DropdownMenuItem
                onClick={addNewAccount}
                className="relative cursor-pointer p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold/10 via-gold/5 to-transparent hover:from-gold/20 hover:via-gold/10 transition-all duration-300 border border-gold/20 hover:border-gold/40 group overflow-hidden"
              >
                {/* Shimmer Effect on Hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div className="relative flex flex-col gap-2 sm:gap-3">
                  {/* Top Row - Botão + Texto + Número */}
                  <div className="flex items-center gap-2">
                    {/* Botão + (Menor e Compacto) */}
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-gold/30 blur-lg animate-pulse" />
                      <div className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-lg">
                        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-black" />
                      </div>
                    </div>

                    {/* Texto com Gradiente Metálico (ao lado do botão) */}
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] sm:text-xs font-semibold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent block leading-tight">
                        Conecte mais contas do ML
                      </span>
                    </div>

                    {/* Número de contas disponíveis */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent leading-none">
                          {organizationInfo.maxAccounts - accounts.length}
                        </span>
                        <span className="text-[10px] text-gray-500 mt-0">
                          disponíveis
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 sm:h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                      style={{ width: `${(accounts.length / organizationInfo.maxAccounts) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] sm:text-xs gap-2">
                    <span className="text-gray-500 flex-shrink-0">
                      {accounts.length} de {organizationInfo.maxAccounts} contas
                    </span>
                    {organizationInfo.subscriptionStatus === 'TRIAL' && (
                      <div className="flex items-center gap-1 text-gold/80 flex-shrink-0">
                        <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {/* Mobile: Texto curto */}
                        <span className="font-medium sm:hidden">PRO: 10 contas</span>
                        {/* Desktop: Texto completo */}
                        <span className="font-medium hidden sm:inline">Upgrade PRO: até 10 contas</span>
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

            <div className="p-2 sm:p-3">
              <div className="relative p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 border border-white/5 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-20 pointer-events-none" />

                <div className="relative flex items-center gap-2 sm:gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-red-500/20 blur-xl" />
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/30">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Mobile: Texto curto */}
                    <span className="text-xs sm:text-sm font-bold text-white block sm:hidden leading-tight">
                      Limite Atingido
                    </span>
                    {/* Desktop: Texto completo */}
                    <span className="hidden sm:block text-sm font-bold text-white leading-tight">
                      Limite Máximo Atingido
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-400 block mt-0.5 truncate">
                      {organizationInfo.maxAccounts} {organizationInfo.maxAccounts === 1 ? 'conta' : 'contas'} conectada{organizationInfo.maxAccounts === 1 ? '' : 's'}
                    </span>
                  </div>
                  {organizationInfo.subscriptionStatus === 'TRIAL' && (
                    <div className="flex-shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/30">
                      <div className="flex items-center gap-1">
                        <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gold" />
                        <span className="text-[10px] sm:text-xs font-semibold text-gold">PRO</span>
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
    </>
  )
}
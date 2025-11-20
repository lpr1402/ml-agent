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
      <Button
        variant="ghost"
        disabled
        className="relative inline-flex items-center justify-center
          min-w-[180px] sm:min-w-[220px] md:min-w-[240px] lg:min-w-[260px]
          h-10 sm:h-11 md:h-12 lg:h-12
          px-3 sm:px-4 md:px-5 lg:px-6
          bg-black/40 backdrop-blur-2xl
          rounded-xl sm:rounded-2xl
          border border-white/[0.08]
          shadow-[0_8px_32px_rgba(0,0,0,0.4)]
          before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none
          after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none
          overflow-hidden"
      >
        <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin text-gold" />
        <span className="text-gray-400 text-xs sm:text-sm font-medium">Carregando...</span>
      </Button>
    )
  }

  if (accounts.length === 0) {
    return (
      <Button
        variant="ghost"
        onClick={addNewAccount}
        className="relative inline-flex items-center justify-center
          min-w-[180px] sm:min-w-[220px] md:min-w-[240px] lg:min-w-[260px]
          h-10 sm:h-11 md:h-12 lg:h-12
          px-3 sm:px-4 md:px-5 lg:px-6
          bg-black/40 backdrop-blur-2xl
          rounded-xl sm:rounded-2xl
          border border-white/[0.08]
          shadow-[0_8px_32px_rgba(0,0,0,0.4)]
          before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none
          after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none
          hover:border-gold/20 transition-all duration-300 overflow-hidden
          text-gold font-semibold group"
      >
        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 group-hover:rotate-12 transition-transform duration-500" />
        <span className="text-xs sm:text-sm">Conectar Conta ML</span>
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative inline-flex items-center
            w-auto sm:min-w-[220px] md:min-w-[240px] lg:min-w-[260px]
            h-10 sm:h-11 md:h-12 lg:h-12
            px-2 sm:px-4 md:px-5 lg:px-6
            bg-black/40 backdrop-blur-2xl
            rounded-xl sm:rounded-2xl
            border border-white/[0.08]
            shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none
            after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none
            hover:border-white/[0.12] transition-all duration-300 overflow-hidden group cursor-pointer"
        >
          <div className="relative flex items-center gap-2 sm:gap-3 md:gap-3.5 lg:gap-4 w-full justify-between">
            {/* Multiple Avatars Stack - Responsivo */}
            <div className="relative flex items-center flex-shrink-0">
              {accounts.slice(0, 2).map((account, index) => {
                const accountImage = getValidAvatarUrl(account.thumbnail)
                return (
                  <Avatar
                    key={account.id}
                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-9 lg:w-9 ring-1 sm:ring-2 ring-black/80 group-hover:ring-gold/30 transition-all duration-300"
                    style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: 2 - index }}
                  >
                    {accountImage ? (
                      <AvatarImage
                        src={accountImage}
                        alt={account.nickname}
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="bg-black/50 text-gray-400 border border-white/10">
                        <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-4 lg:w-4" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                )
              })}
              {accounts.length > 2 && (
                <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-9 lg:w-9 rounded-full bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center ring-1 sm:ring-2 ring-black/80 text-[9px] sm:text-[10px] md:text-xs font-bold text-gold" style={{ marginLeft: '-8px', zIndex: 0 }}>
                  +{accounts.length - 2}
                </div>
              )}
            </div>

            {/* Account Info - Responsivo */}
            <div className="hidden sm:flex flex-col items-start text-left flex-1 min-w-0">
              <span className="text-xs sm:text-sm md:text-base font-semibold text-white group-hover:text-gold transition-colors duration-300 tracking-wide truncate">
                Contas ML
              </span>
              <span className="text-[10px] sm:text-xs md:text-sm text-gray-500 truncate">
                {accounts.length} {accounts.length === 1 ? 'conta' : 'contas'}
              </span>
            </div>

            {/* Chevron Icon - Responsivo */}
            <ChevronDown
              className={`h-3 w-3 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-5 lg:w-5 text-gray-400 group-hover:text-gold transition-all duration-300 flex-shrink-0 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        className="w-[280px] sm:w-[340px] lg:w-[380px]
          bg-black/40 backdrop-blur-2xl
          border border-white/[0.08]
          rounded-xl sm:rounded-2xl
          shadow-[0_8px_32px_rgba(0,0,0,0.4)]
          before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none
          after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none
          overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Background Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none rounded-xl sm:rounded-2xl" />

        {/* Premium Header - Clean & Fino */}
        <div className="relative z-10 px-3 sm:px-3.5 py-2.5 sm:py-3 border-b border-white/5 rounded-t-xl sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs sm:text-sm font-semibold text-white">Contas ML</h3>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">
              {accounts.length} ativa{accounts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Accounts List - Clean & Fino */}
        <div className="relative z-10 px-2 py-2 max-h-[280px] sm:max-h-[320px] overflow-y-auto custom-scrollbar">
          {accounts.map((account) => {
            const accountImage = getValidAvatarUrl(account.thumbnail)

            return (
              <div
                key={account.id}
                className="relative p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-300 mb-1.5 last:mb-0 bg-gradient-to-r from-white/[0.02] to-transparent border border-white/5 hover:border-gold/20 hover:bg-white/[0.04] group overflow-hidden"
              >
                <div className="relative flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                    {/* Avatar - Compacto */}
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9 ring-1 ring-white/10 group-hover:ring-gold/30 transition-all duration-300 flex-shrink-0">
                      {accountImage ? (
                        <AvatarImage
                          src={accountImage}
                          alt={account.nickname}
                          className="object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                          <User className="h-4 w-4 text-gray-400" />
                        </AvatarFallback>
                      )}
                    </Avatar>

                    {/* Account Info - Compacto */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-gold transition-colors duration-300 truncate tracking-wide">
                          {account.nickname}
                        </span>
                        {account.isPrimary && (
                          <Crown className="h-3 w-3 text-gold flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 truncate">
                        {account.siteId}
                      </span>
                    </div>
                  </div>

                  {/* Status - Compacto */}
                  <div className="flex-shrink-0">
                    {!account.tokenValid ? (
                      <div className="px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
                        <span className="text-[9px] text-red-400 font-medium">Expirado</span>
                      </div>
                    ) : account.isActive ? (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center border border-emerald-500/30">
                        <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add Account Button - Full Width Perfeito */}
        {accounts.length < organizationInfo.maxAccounts && (
            <div className="relative z-10 border-t border-white/5 py-2 sm:py-2.5">
              <DropdownMenuItem
                onClick={addNewAccount}
                className="relative cursor-pointer mx-2 sm:mx-2.5 md:mx-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold/10 via-gold/5 to-transparent hover:from-gold/15 hover:via-gold/10 transition-all duration-300 border border-gold/20 hover:border-gold/30 group overflow-hidden p-0"
              >
                {/* Shimmer Effect on Hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div className="relative flex flex-col gap-2 sm:gap-2.5 md:gap-3 p-3 sm:p-3.5 md:p-4">
                  {/* Top Row - Totalmente Responsivo e Simétrico */}
                  <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
                    {/* Botão + (Esquerda) - Responsivo */}
                    <div className="relative flex-shrink-0 w-7 sm:w-8 md:w-9 lg:w-10">
                      <div className="absolute inset-0 bg-gold/30 blur-md animate-pulse" />
                      <div className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-lg">
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-5 lg:w-5 text-black" strokeWidth={2.5} />
                      </div>
                    </div>

                    {/* Texto com Gradiente (Centro) - Sempre em Uma Linha */}
                    <div className="flex-1 min-w-0 text-center">
                      <span className="text-[10px] sm:text-xs md:text-sm font-semibold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent whitespace-nowrap leading-tight">
                        Conecte mais contas do ML
                      </span>
                    </div>

                    {/* Número de contas disponíveis (Direita) - Responsivo e Simétrico */}
                    <div className="relative flex-shrink-0 w-7 sm:w-8 md:w-9">
                      <div className="flex flex-col items-center">
                        <span className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent leading-none">
                          {organizationInfo.maxAccounts - accounts.length}
                        </span>
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] text-gray-500">
                          vagas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar Full Width com Border */}
                  <div className="w-full h-1.5 sm:h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                      style={{ width: `${(accounts.length / organizationInfo.maxAccounts) * 100}%` }}
                    />
                  </div>

                  {/* Bottom Info - Responsivo */}
                  <div className="flex items-center justify-between text-[10px] sm:text-xs md:text-sm gap-2">
                    <span className="text-gray-500 flex-shrink-0">
                      {accounts.length} de {organizationInfo.maxAccounts} contas
                    </span>
                    {organizationInfo.subscriptionStatus === 'TRIAL' && (
                      <div className="flex items-center gap-1 text-gold/80 flex-shrink-0">
                        <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5" />
                        <span className="font-medium text-[9px] sm:text-[10px] md:text-xs">
                          PRO: 10 contas
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            </div>
        )}

        {/* Max Accounts Reached - Totalmente Responsivo */}
        {accounts.length >= organizationInfo.maxAccounts && (
            <div className="relative z-10 border-t border-white/5 py-2 sm:py-2.5">
              <div className="relative mx-2 sm:mx-2.5 md:mx-3 p-2.5 sm:p-3 md:p-3.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 overflow-hidden">
                <div className="relative flex items-center gap-2 sm:gap-2.5 md:gap-3">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/30 flex-shrink-0">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs sm:text-sm md:text-base font-bold text-white block leading-tight">
                      Limite Atingido
                    </span>
                    <span className="text-[10px] sm:text-xs md:text-sm text-gray-500 block truncate">
                      {organizationInfo.maxAccounts} {organizationInfo.maxAccounts === 1 ? 'conta' : 'contas'}
                    </span>
                  </div>
                  {organizationInfo.subscriptionStatus === 'TRIAL' && (
                    <div className="flex-shrink-0 px-2 py-1 sm:px-2.5 sm:py-1 md:px-3 md:py-1.5 rounded-md bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/30">
                      <div className="flex items-center gap-1">
                        <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5" />
                        <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-gold">PRO</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}
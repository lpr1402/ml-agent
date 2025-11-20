'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api-client'
import {
  Loader2,
  CheckCircle,
  CheckCircle2,
  Plus,
  ShoppingBag,
  ArrowRight,
  Shield,
  Sparkles,
  Crown,
  UserPlus,
  Link2,
  AlertCircle,
  ExternalLink,
  Lock
} from 'lucide-react'

interface AddAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentAccountCount: number
  maxAccounts: number
  subscriptionStatus: string
}

export function AddAccountModal({
  isOpen,
  onClose,
  onSuccess,
  currentAccountCount,
  maxAccounts
}: AddAccountModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [authWindow, setAuthWindow] = useState<Window | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'authenticating' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Escutar mensagens da janela OAuth
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validar origem para segurança
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'ml-oauth-success') {
        logger.info('[AddAccountModal] OAuth success received', { account: event.data.account })
        setStatus('success')

        // Fechar janela OAuth se ainda estiver aberta
        if (authWindow && !authWindow.closed) {
          authWindow.close()
        }

        toast({
          title: "Conta adicionada!",
          description: `${event.data.account} conectada com sucesso.`,
          variant: "default"
        })

        // Aguardar um pouco para mostrar sucesso antes de fechar
        setTimeout(() => {
          onSuccess()
          onClose()
          setStatus('idle')
        }, 1500)
      } else if (event.data.type === 'ml-oauth-error') {
        logger.error('[AddAccountModal] OAuth error received', { error: event.data.error })
        setStatus('error')
        setErrorMessage(event.data.error || 'Erro ao adicionar conta')

        // Fechar janela OAuth se ainda estiver aberta
        if (authWindow && !authWindow.closed) {
          authWindow.close()
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [authWindow, onSuccess, onClose])

  // Verificar se janela OAuth foi fechada manualmente
  useEffect(() => {
    if (authWindow && status === 'authenticating') {
      const checkWindow = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkWindow)
          if (status === 'authenticating') {
            setStatus('idle')
            setIsLoading(false)
          }
        }
      }, 500)

      return () => clearInterval(checkWindow)
    }
    return undefined
  }, [authWindow, status])

  const handleAddAccount = async () => {
    try {
      setIsLoading(true)
      setStatus('loading')
      setErrorMessage('')

      // Verificar limites antes de prosseguir
      if (currentAccountCount >= maxAccounts) {
        setStatus('error')
        setErrorMessage(`Limite de ${maxAccounts} contas atingido`)
        setIsLoading(false)
        return
      }

      // Obter URL de autorização
      const response = await apiClient.get('/api/ml-accounts/add')

      if (!response.authUrl) {
        throw new Error('URL de autorização não recebida')
      }

      // Abrir OAuth em nova janela
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const newWindow = window.open(
        response.authUrl,
        'ml-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )

      if (!newWindow) {
        throw new Error('Popup bloqueado. Permita popups para este site.')
      }

      setAuthWindow(newWindow)
      setStatus('authenticating')
      newWindow.focus()

    } catch (error: any) {
      logger.error('[AddAccountModal] Error initiating OAuth', { error })
      setStatus('error')
      setErrorMessage(error.message || 'Erro ao iniciar autenticação')

      toast({
        title: "Erro",
        description: error.message || "Não foi possível iniciar o processo",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const canAddMoreAccounts = currentAccountCount < maxAccounts

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[90vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] sm:max-h-[85vh] md:max-h-[80vh] bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-2xl border border-white/5 text-white shadow-2xl overflow-hidden">
        {/* Premium Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        {/* Static Glow Effect - No Animation */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gold/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gold/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]">
          <DialogHeader className="relative pb-2 sm:pb-3 border-b border-white/5 flex-shrink-0 px-4 sm:px-6">
            {/* Compact Premium Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Premium Icon Container */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-gold/20 blur-xl" />
                  <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-xl shadow-gold/30">
                    <ShoppingBag className="h-5 w-5 sm:h-5.5 sm:w-5.5 text-black" strokeWidth={2.5} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base sm:text-lg font-bold text-white truncate">
                    Conectar Nova Conta
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-400 truncate">
                    Integração Mercado Livre
                  </DialogDescription>
                </div>
              </div>

              {/* Account Counter Badge */}
              <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/50 border border-gold/20 flex-shrink-0">
                <span className="text-xs sm:text-sm font-bold text-gold">
                  {currentAccountCount}/{maxAccounts}
                </span>
              </div>
            </div>

            {/* Premium Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
          </DialogHeader>

          <div className="relative flex-1 overflow-y-auto">
            {/* Estado inicial - Responsive Premium Layout */}
            {status === 'idle' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 p-5 sm:p-6 lg:p-7">
                {/* Connection Flow */}
                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-bold text-gold uppercase tracking-wide flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold" strokeWidth={2.5} />
                    Processo de Conexão
                  </h3>

                  <div className="space-y-2.5">
                    {[
                      { icon: UserPlus, title: 'Autorizar', desc: 'Clique em conectar' },
                      { icon: Lock, title: 'Autenticar', desc: 'Entre no Mercado Livre' },
                      { icon: Shield, title: 'Confirmar', desc: 'Autorize o ML Agent' }
                    ].map((step, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-white/[0.06] group hover:border-gold/20 transition-all duration-300"
                      >
                        <div className="relative">
                          <div className="absolute inset-0 bg-gold/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-gradient-to-br from-gold/10 to-gold/5 flex items-center justify-center">
                            <step.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold" />
                          </div>
                          <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-black border border-gold/30 flex items-center justify-center">
                            <span className="text-[8px] sm:text-[10px] font-bold text-gold">{index + 1}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] sm:text-xs font-semibold text-white">{step.title}</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-400">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account Slots */}
                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-bold text-gold uppercase tracking-wide flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold" strokeWidth={2.5} />
                    Slots Disponíveis
                  </h3>

                  <div className="relative p-2.5 sm:p-3 rounded-lg bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5">
                    <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                      {Array.from({ length: maxAccounts }).map((_, index) => (
                        <div
                          key={index}
                          className={`h-8 sm:h-9 md:h-10 rounded-md flex items-center justify-center transition-all duration-300 ${
                            index < currentAccountCount
                              ? 'bg-gradient-to-br from-gold/20 to-gold/10 border border-gold/30'
                              : index === currentAccountCount
                              ? 'bg-gradient-to-br from-gold/10 to-transparent border-2 border-dashed border-gold/30'
                              : 'bg-white/[0.02] border border-white/5'
                          }`}
                        >
                          {index < currentAccountCount ? (
                            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-gold" />
                          ) : index === currentAccountCount ? (
                            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-gold" />
                          ) : (
                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-600" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Compact Progress Bar */}
                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                        style={{ width: `${(currentAccountCount / maxAccounts) * 100}%` }}
                      />
                    </div>

                    <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] text-gray-400">
                        {currentAccountCount} de {maxAccounts} contas
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-semibold text-gold">
                        {maxAccounts - currentAccountCount} disponíveis
                      </span>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-bold text-gold uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold" strokeWidth={2.5} />
                    Benefícios
                  </h3>

                  <div className="p-2.5 sm:p-3 rounded-lg bg-gradient-to-br from-gold/10 via-gold/5 to-transparent border border-gold/20">
                    <ul className="space-y-1.5 sm:space-y-2">
                      <li className="flex items-start gap-1.5 sm:gap-2">
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gold mt-0.5 sm:mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] sm:text-xs font-medium text-white">IA Avançada</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-400">Respostas automáticas inteligentes</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-1.5 sm:gap-2">
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gold mt-0.5 sm:mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] sm:text-xs font-medium text-white">+40% Vendas</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-400">Aumento comprovado de conversão</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-1.5 sm:gap-2">
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gold mt-0.5 sm:mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] sm:text-xs font-medium text-white">Dashboard Pro</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-400">Métricas em tempo real</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Estado de carregamento - Compact Premium Animation */}
            {status === 'loading' && (
              <div className="flex items-center justify-center py-12 sm:py-16">
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gold/30 blur-xl" />
                    <Loader2 className="relative h-8 w-8 sm:h-10 sm:w-10 animate-spin text-gold" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-semibold text-white">Preparando Conexão</p>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Configurando ambiente seguro...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Estado de autenticação - Compact Premium Waiting */}
            {status === 'authenticating' && (
              <div className="flex items-center justify-center py-12 sm:py-16">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 lg:gap-8 text-center sm:text-left">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full border-2 border-gold/20 animate-ping" />
                    <div className="absolute inset-0 rounded-full border-2 border-gold/30 animate-ping animation-delay-200" />
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center">
                      <Lock className="h-6 w-6 sm:h-7 sm:w-7 text-gold" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-white">Aguardando Autorização</p>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Complete o login no Mercado Livre</p>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce animation-delay-200" />
                      <div className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce animation-delay-400" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Estado de sucesso - Compact Premium Celebration */}
            {status === 'success' && (
              <div className="flex items-center justify-center py-12 sm:py-16">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/30 blur-xl" />
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center animate-bounce">
                      <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base sm:text-lg font-bold text-white">Conta Conectada!</p>
                    <p className="text-xs sm:text-sm text-emerald-400 mt-0.5 sm:mt-1">Integração realizada com sucesso</p>
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                      <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
                      <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">Pronta para vender mais!</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Estado de erro - Compact Premium Error Display */}
            {status === 'error' && (
              <div className="flex items-center justify-center py-12 sm:py-16">
                <div className="flex flex-col items-center space-y-3 sm:space-y-4 max-w-xs sm:max-w-md px-4">
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-500/20 blur-lg" />
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/30">
                        <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-red-400" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-white">Erro na Conexão</p>
                      <p className="text-[10px] sm:text-xs text-red-400 mt-0.5 sm:mt-1">{errorMessage}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                    className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] sm:text-xs font-semibold hover:bg-red-500/20 transition-all"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Responsive Premium Actions Bar */}
          <div className="relative pt-2 sm:pt-3 pb-2 sm:pb-3 px-4 sm:px-6 border-t border-white/5 flex-shrink-0">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4">
              {/* Security Badge - Hidden on mobile */}
              <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-500">
                <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gold/60" />
                <span>Conexão segura</span>
              </div>

              {/* Action Buttons - Full width on mobile */}
              <div className="flex gap-2 w-full sm:w-auto">
                {status !== 'success' && (
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={isLoading || status === 'authenticating'}
                    className="px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg sm:rounded-xl transition-all duration-300 flex-1 sm:flex-none font-semibold"
                  >
                    Cancelar
                  </Button>
                )}

                {canAddMoreAccounts && status === 'idle' && (
                  <Button
                    onClick={handleAddAccount}
                    disabled={isLoading}
                    className="relative group px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-gold via-gold-light to-gold text-black text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 transition-all duration-300 overflow-hidden flex-1 sm:flex-none"
                  >
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

                    <div className="relative flex items-center justify-center gap-2">
                      <ExternalLink className="h-4 w-4" strokeWidth={2.5} />
                      <span>Conectar Agora</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                    </div>
                  </Button>
                )}

                {status === 'success' && (
                  <Button
                    onClick={onClose}
                    className="px-4 sm:px-5 py-1 sm:py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] sm:text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
                  >
                    Concluir
                  </Button>
                )}

                {!canAddMoreAccounts && status === 'idle' && (
                  <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 w-full sm:w-auto">
                    <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                      <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-400" />
                      <span className="text-[10px] sm:text-xs font-semibold text-red-400">Limite Atingido</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
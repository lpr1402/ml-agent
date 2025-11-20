'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import {
  Building2,
  Lock,
  Bell,
  Shield,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Mail,
  Phone,
  MessageSquare
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface OrganizationData {
  id: string
  name: string
  email: string
  whatsappNumber: string
  plan: string
  accountsCount: number
  createdAt: string
  whatsappNotifications: boolean
}

export function OrganizationSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form states
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [showCurrentPin, setShowCurrentPin] = useState(false)
  const [showNewPin, setShowNewPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)

  // Notification settings
  const [whatsappNotifications, setWhatsappNotifications] = useState(true)

  // Active tab
  const [activeTab, setActiveTab] = useState<'dados' | 'seguranca' | 'notificacoes'>('dados')

  useEffect(() => {
    loadOrganizationData()
  }, [])

  const loadOrganizationData = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/organization/settings')

      if (response) {
        setOrganizationData(response)
        setName(response.name || '')
        setEmail(response.email || '')
        setWhatsappNumber(response.whatsappNumber || '')
        setWhatsappNotifications(response.whatsappNotifications ?? true)
      }
    } catch (error) {
      logger.error('Failed to load organization data', { error })
      toast.error('Erro ao carregar dados da organização')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBasicData = async () => {
    try {
      setSaving(true)
      await apiClient.post('/api/organization/update', {
        name,
        email,
        whatsappNumber
      })

      toast.success('Dados atualizados com sucesso!')
      await loadOrganizationData()
    } catch (error: any) {
      logger.error('Failed to update organization data', { error })
      toast.error(error?.message || 'Erro ao atualizar dados')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePin = async () => {
    if (!currentPin) {
      toast.error('Digite o PIN atual')
      return
    }

    if (!newPin || !confirmNewPin) {
      toast.error('Digite o novo PIN e a confirmação')
      return
    }

    if (newPin !== confirmNewPin) {
      toast.error('Os PINs não coincidem')
      return
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast.error('O PIN deve conter exatamente 4 dígitos')
      return
    }

    try {
      setSaving(true)
      await apiClient.post('/api/organization/change-pin', {
        currentPin,
        newPin
      })

      toast.success('PIN alterado com sucesso!')
      setCurrentPin('')
      setNewPin('')
      setConfirmNewPin('')
    } catch (error: any) {
      logger.error('Failed to change PIN', { error })
      toast.error(error?.message || 'Erro ao alterar PIN. Verifique o PIN atual.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleWhatsappNotifications = async () => {
    const newValue = !whatsappNotifications
    setWhatsappNotifications(newValue)

    try {
      await apiClient.post('/api/organization/notifications', {
        whatsappNotifications: newValue
      })

      toast.success(newValue ? 'Notificações do WhatsApp ativadas!' : 'Notificações do WhatsApp desativadas!')
    } catch (error: any) {
      // Rollback on error
      setWhatsappNotifications(!newValue)
      logger.error('Failed to update WhatsApp notifications', { error })
      toast.error(error?.message || 'Erro ao atualizar notificações')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-gold animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Premium Tab Container - Matching Performance/Ranking Style */}
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
            aria-label="Configurações"
          >
            {/* Dados Tab */}
            <button
              onClick={() => setActiveTab('dados')}
              className={cn(
                "group relative z-10",
                "min-w-[70px] sm:min-w-[100px] lg:min-w-[120px]",
                "px-3 sm:px-4 lg:px-6",
                "h-full",
                "rounded-lg sm:rounded-xl",
                "font-medium text-[10px] sm:text-xs lg:text-sm",
                "transition-all duration-300 ease-out",
                "border border-transparent",
                "flex items-center justify-center gap-1 sm:gap-2",
                "touch-manipulation",
                "active:scale-[0.98]",
                "whitespace-nowrap",
                activeTab === 'dados'
                  ? "text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
              )}
            >
              <Building2 className={cn(
                "w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                "transition-all duration-300",
                activeTab === 'dados' ? "text-gold" : "opacity-60 group-hover:opacity-100"
              )} strokeWidth={2.5} />
              <span className="font-semibold tracking-wide">Dados</span>
            </button>

            {/* Segurança Tab */}
            <button
              onClick={() => setActiveTab('seguranca')}
              className={cn(
                "group relative z-10",
                "min-w-[70px] sm:min-w-[100px] lg:min-w-[120px]",
                "px-3 sm:px-4 lg:px-6",
                "h-full",
                "rounded-lg sm:rounded-xl",
                "font-medium text-[10px] sm:text-xs lg:text-sm",
                "transition-all duration-300 ease-out",
                "border border-transparent",
                "flex items-center justify-center gap-1 sm:gap-2",
                "touch-manipulation",
                "active:scale-[0.98]",
                "whitespace-nowrap",
                activeTab === 'seguranca'
                  ? "text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
              )}
            >
              <Shield className={cn(
                "w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                "transition-all duration-300",
                activeTab === 'seguranca' ? "text-gold" : "opacity-60 group-hover:opacity-100"
              )} strokeWidth={2.5} />
              <span className="font-semibold tracking-wide">Segurança</span>
            </button>

            {/* Notificações Tab */}
            <button
              onClick={() => setActiveTab('notificacoes')}
              className={cn(
                "group relative z-10",
                "min-w-[80px] sm:min-w-[100px] lg:min-w-[120px]",
                "px-3 sm:px-4 lg:px-6",
                "h-full",
                "rounded-lg sm:rounded-xl",
                "font-medium text-[10px] sm:text-xs lg:text-sm",
                "transition-all duration-300 ease-out",
                "border border-transparent",
                "flex items-center justify-center gap-1 sm:gap-2",
                "touch-manipulation",
                "active:scale-[0.98]",
                "whitespace-nowrap",
                activeTab === 'notificacoes'
                  ? "text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
              )}
            >
              <Bell className={cn(
                "w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                "transition-all duration-300",
                activeTab === 'notificacoes' ? "text-gold" : "opacity-60 group-hover:opacity-100"
              )} strokeWidth={2.5} />
              <span className="font-semibold tracking-wide">Notificações</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {/* Dados da Organização Tab */}
        {activeTab === 'dados' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Organization Info Card */}
            <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] p-4 sm:p-5 lg:p-6 overflow-hidden backdrop-blur-xl">
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20 flex-shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-black" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm sm:text-base font-bold text-white truncate">Informações Básicas</h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {organizationData?.name || 'Sua organização'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 sm:space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      Nome da Organização
                    </label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Digite o nome da organização"
                      className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 h-10 sm:h-11 px-3 sm:px-4 rounded-lg sm:rounded-xl text-sm sm:text-base"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      E-mail
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Mail className="w-4 h-4 text-gray-500" />
                      </div>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 h-10 sm:h-11 pl-10 sm:pl-11 pr-3 sm:pr-4 rounded-lg sm:rounded-xl text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      WhatsApp <span className="text-gray-500 font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Phone className="w-4 h-4 text-gray-500" />
                      </div>
                      <Input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 h-10 sm:h-11 pl-10 sm:pl-11 pr-3 sm:pr-4 rounded-lg sm:rounded-xl text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-1 sm:pt-2">
                    <Button
                      onClick={handleSaveBasicData}
                      disabled={saving}
                      className="w-full sm:w-auto bg-gradient-to-r from-gold to-gold-light text-black font-bold hover:shadow-lg hover:shadow-gold/30 transition-all duration-300 h-10 sm:h-11 px-5 sm:px-8 rounded-lg sm:rounded-xl text-sm sm:text-base"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Salvar Alterações
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Segurança Tab */}
        {activeTab === 'seguranca' && (
          <div className="space-y-4 sm:space-y-5">
            <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] p-4 sm:p-5 lg:p-6 overflow-hidden backdrop-blur-xl">
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20 flex-shrink-0">
                    <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-black" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm sm:text-base font-bold text-white">Alterar PIN de Segurança</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Proteja sua conta com um PIN de 4 dígitos</p>
                  </div>
                </div>

                <div className="space-y-3.5 sm:space-y-4">
                  {/* Current PIN */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      PIN Atual
                    </label>
                    <div className="relative">
                      <Input
                        type={showCurrentPin ? 'text' : 'password'}
                        value={currentPin}
                        onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        maxLength={4}
                        className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 h-10 sm:h-11 px-3 sm:px-4 pr-10 sm:pr-11 rounded-lg sm:rounded-xl text-sm sm:text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPin(!showCurrentPin)}
                        className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New PIN */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      Novo PIN (4 dígitos)
                    </label>
                    <div className="relative">
                      <Input
                        type={showNewPin ? 'text' : 'password'}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        maxLength={4}
                        className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 h-10 sm:h-11 px-3 sm:px-4 pr-10 sm:pr-11 rounded-lg sm:rounded-xl text-sm sm:text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New PIN */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      Confirmar Novo PIN
                    </label>
                    <div className="relative">
                      <Input
                        type={showConfirmPin ? 'text' : 'password'}
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        maxLength={4}
                        className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 h-10 sm:h-11 px-3 sm:px-4 pr-10 sm:pr-11 rounded-lg sm:rounded-xl text-sm sm:text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPin(!showConfirmPin)}
                        className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* PIN Match Indicator */}
                  {newPin && confirmNewPin && (
                    <div className={cn(
                      "flex items-center gap-2 text-xs sm:text-sm p-3 rounded-lg sm:rounded-xl border",
                      newPin === confirmNewPin
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {newPin === confirmNewPin ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>Os PINs coincidem</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Os PINs não coincidem</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Change PIN Button */}
                  <div className="pt-1 sm:pt-2">
                    <Button
                      onClick={handleChangePin}
                      disabled={saving || !currentPin || !newPin || !confirmNewPin || newPin !== confirmNewPin}
                      className="w-full sm:w-auto bg-gradient-to-r from-gold to-gold-light text-black font-bold hover:shadow-lg hover:shadow-gold/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed h-10 sm:h-11 px-5 sm:px-8 rounded-lg sm:rounded-xl text-sm sm:text-base"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Alterando...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Alterar PIN
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Security Info */}
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 text-xs sm:text-sm">
                    <div className="flex gap-2.5 sm:gap-3">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 text-blue-400" />
                      <div className="text-blue-300 min-w-0">
                        <p className="font-semibold mb-1">Dica de Segurança</p>
                        <p className="text-blue-300/80 leading-relaxed">
                          Use um PIN único e seguro. Evite sequências óbvias como 1234 ou datas de nascimento.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notificações Tab */}
        {activeTab === 'notificacoes' && (
          <div className="space-y-4 sm:space-y-5">
            <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] p-4 sm:p-5 lg:p-6 overflow-hidden backdrop-blur-xl">
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20 flex-shrink-0">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-black" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm sm:text-base font-bold text-white">Preferências de Notificações</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Escolha como deseja ser notificado</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* WhatsApp Notifications */}
                  <div className="relative group">
                    <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] hover:border-white/10 transition-all duration-300">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white text-xs sm:text-sm">Notificações por WhatsApp</p>
                          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Notificações em tempo real</p>
                        </div>
                      </div>
                      <button
                        onClick={handleToggleWhatsappNotifications}
                        className={cn(
                          "relative inline-flex h-6 w-11 sm:h-7 sm:w-12 items-center rounded-full transition-all duration-300 flex-shrink-0 ml-2",
                          whatsappNotifications
                            ? "bg-gradient-to-r from-green-500 to-green-400 shadow-lg shadow-green-500/30"
                            : "bg-gray-700"
                        )}
                      >
                        <span className={cn(
                          "inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white transition-transform duration-300 shadow-lg",
                          whatsappNotifications ? "translate-x-6 sm:translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

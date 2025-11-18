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
  Mail
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function OrganizationSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form states
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
  const [emailNotifications, setEmailNotifications] = useState(true)
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
        setName(response.name || '')
        setEmail(response.email || '')
        setWhatsappNumber(response.whatsappNumber || '')
        setEmailNotifications(response.emailNotifications ?? true)
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
      loadOrganizationData()
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

  const handleSaveNotifications = async () => {
    try {
      setSaving(true)
      await apiClient.post('/api/organization/notifications', {
        emailNotifications,
        whatsappNotifications
      })

      toast.success('Preferências de notificação atualizadas!')
    } catch (error: any) {
      logger.error('Failed to update notifications', { error })
      toast.error(error?.message || 'Erro ao atualizar notificações')
    } finally {
      setSaving(false)
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
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('dados')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 whitespace-nowrap font-medium text-sm",
            activeTab === 'dados'
              ? "bg-gold/10 text-gold border border-gold/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Building2 className="w-4 h-4" />
          Dados da Organização
        </button>

        <button
          onClick={() => setActiveTab('seguranca')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 whitespace-nowrap font-medium text-sm",
            activeTab === 'seguranca'
              ? "bg-gold/10 text-gold border border-gold/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Shield className="w-4 h-4" />
          Segurança
        </button>

        <button
          onClick={() => setActiveTab('notificacoes')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 whitespace-nowrap font-medium text-sm",
            activeTab === 'notificacoes'
              ? "bg-gold/10 text-gold border border-gold/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Bell className="w-4 h-4" />
          Notificações
        </button>
      </div>

      {/* Dados da Organização Tab */}
      {activeTab === 'dados' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-gold" />
              <h4 className="text-lg font-semibold text-white">Informações Básicas</h4>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome da Organização
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome da organização"
                  className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  E-mail
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  WhatsApp (opcional)
                </label>
                <Input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20"
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveBasicData}
                disabled={saving}
                className="w-full sm:w-auto bg-gradient-to-r from-gold to-gold-light text-black font-semibold hover:shadow-lg hover:shadow-gold/30 transition-all duration-300"
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
      )}

      {/* Segurança Tab */}
      {activeTab === 'seguranca' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="w-5 h-5 text-gold" />
              <h4 className="text-lg font-semibold text-white">Alterar PIN de Segurança</h4>
            </div>

            <div className="space-y-4">
              {/* Current PIN */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  PIN Atual
                </label>
                <div className="relative">
                  <Input
                    type={showCurrentPin ? 'text' : 'password'}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New PIN */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Novo PIN (4 dígitos)
                </label>
                <div className="relative">
                  <Input
                    type={showNewPin ? 'text' : 'password'}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New PIN */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirmar Novo PIN
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPin ? 'text' : 'password'}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-gold/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* PIN Match Indicator */}
              {newPin && confirmNewPin && (
                <div className={cn(
                  "flex items-center gap-2 text-sm p-3 rounded-lg",
                  newPin === confirmNewPin
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                )}>
                  {newPin === confirmNewPin ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Os PINs coincidem
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      Os PINs não coincidem
                    </>
                  )}
                </div>
              )}

              {/* Change PIN Button */}
              <Button
                onClick={handleChangePin}
                disabled={saving || !currentPin || !newPin || !confirmNewPin || newPin !== confirmNewPin}
                className="w-full sm:w-auto bg-gradient-to-r from-gold to-gold-light text-black font-semibold hover:shadow-lg hover:shadow-gold/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Security Info */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-400">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Dica de Segurança</p>
                    <p className="text-blue-300/80">
                      Use um PIN único e seguro. Evite sequências óbvias como 1234 ou datas de nascimento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificações Tab */}
      {activeTab === 'notificacoes' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-gold" />
              <h4 className="text-lg font-semibold text-white">Preferências de Notificações</h4>
            </div>

            <div className="space-y-4">
              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-white/5">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gold" />
                  <div>
                    <p className="font-medium text-white">Notificações por E-mail</p>
                    <p className="text-sm text-gray-400">Receba alertas importantes no seu e-mail</p>
                  </div>
                </div>
                <button
                  onClick={() => setEmailNotifications(!emailNotifications)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300",
                    emailNotifications ? "bg-gold" : "bg-gray-600"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300",
                      emailNotifications ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              {/* WhatsApp Notifications */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-white/5">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gold" />
                  <div>
                    <p className="font-medium text-white">Notificações por WhatsApp</p>
                    <p className="text-sm text-gray-400">Receba notificações em tempo real no WhatsApp</p>
                  </div>
                </div>
                <button
                  onClick={() => setWhatsappNotifications(!whatsappNotifications)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300",
                    whatsappNotifications ? "bg-gold" : "bg-gray-600"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300",
                      whatsappNotifications ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveNotifications}
                disabled={saving}
                className="w-full sm:w-auto bg-gradient-to-r from-gold to-gold-light text-black font-semibold hover:shadow-lg hover:shadow-gold/30 transition-all duration-300"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Preferências
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

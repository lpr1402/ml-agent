'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api-client'
import { AddAccountModal } from '@/components/add-account-modal'
import {
  Store,
  Plus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Crown,
  MoreVertical,
  LogOut,
  Shield,
  Clock
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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
  tokenExpiresAt?: string
  lastSyncAt?: string
}

interface OrganizationInfo {
  subscriptionStatus: string
  accountCount: number
  maxAccounts: number
}

export function MLAccountsManager() {
  const [accounts, setAccounts] = useState<MLAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [organizationInfo, setOrganizationInfo] = useState<OrganizationInfo>({
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
      
      // Buscar informações da organização
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
    } catch (error) {
      logger.error('Failed to fetch accounts:', { error })
      toast({
        title: "Erro ao carregar contas",
        description: "Não foi possível carregar as contas do Mercado Livre",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const switchAccount = async (accountId: string) => {
    if (accountId === activeAccountId || switching) return
    
    setSwitching(accountId)
    try {
      await apiClient.post('/api/ml-accounts/switch', { accountId })
      setActiveAccountId(accountId)
      
      toast({
        title: "Conta alternada",
        description: "Recarregando dados...",
        variant: "default"
      })
      
      // Recarregar a página para atualizar todos os dados
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      logger.error('Failed to switch account:', { error })
      toast({
        title: "Erro ao trocar de conta",
        description: "Não foi possível trocar de conta. Por favor, tente novamente.",
        variant: "destructive"
      })
    } finally {
      setSwitching(null)
    }
  }

  const removeAccount = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId)
    if (!account) return
    
    if (account.isPrimary) {
      toast({
        title: "Não é possível remover",
        description: "A conta principal não pode ser removida",
        variant: "destructive"
      })
      return
    }
    
    if (confirm(`Tem certeza que deseja remover a conta ${account.nickname}?`)) {
      try {
        await apiClient.delete(`/api/ml-accounts/remove/${accountId}`)
        
        toast({
          title: "Conta removida",
          description: `${account.nickname} foi desconectada da organização`,
          variant: "default"
        })
        
        fetchAccounts()
      } catch (error) {
        logger.error('Failed to remove account:', { error })
        toast({
          title: "Erro ao remover conta",
          description: "Não foi possível remover a conta",
          variant: "destructive"
        })
      }
    }
  }

  const handleModalSuccess = () => {
    fetchAccounts()
    setIsModalOpen(false)
  }

  if (loading) {
    return (
      <div 
        className="p-6 rounded-lg"
        style={{
          background: 'rgba(255, 230, 0, 0.05)',
          border: '1px solid rgba(255, 230, 0, 0.2)'
        }}
      >
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin" style={{ color: '#FFE600' }} />
          <span className="ml-3 text-sm" style={{ color: '#999' }}>Carregando contas...</span>
        </div>
      </div>
    )
  }

  const canAddMoreAccounts = organizationInfo.accountCount < organizationInfo.maxAccounts

  return (
    <>
      <div 
        className="p-6 rounded-lg space-y-6"
        style={{
          background: 'rgba(255, 230, 0, 0.03)',
          border: '1px solid rgba(255, 230, 0, 0.15)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#fff' }}>
              <Store className="h-5 w-5" style={{ color: '#FFE600' }} />
              Contas do Mercado Livre
            </h3>
            <p className="text-sm mt-1" style={{ color: '#888' }}>
              Gerencie múltiplas contas ML em uma única organização
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline"
              style={{
                background: 'rgba(255, 230, 0, 0.1)',
                border: '1px solid rgba(255, 230, 0, 0.3)',
                color: '#FFE600'
              }}
            >
              {organizationInfo.accountCount} / {organizationInfo.maxAccounts} contas
            </Badge>
            
            {canAddMoreAccounts && (
              <Button
                onClick={() => setIsModalOpen(true)}
                size="sm"
                style={{
                  background: '#FFE600',
                  color: '#0a0a0a',
                  fontWeight: 600
                }}
                className="hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            )}
          </div>
        </div>

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`relative p-4 rounded-lg border transition-all cursor-pointer ${
                switching === account.id ? 'opacity-50' : ''
              }`}
              style={{
                background: account.id === activeAccountId 
                  ? 'rgba(255, 230, 0, 0.08)' 
                  : 'rgba(255, 255, 255, 0.02)',
                border: account.id === activeAccountId
                  ? '2px solid #FFE600'
                  : '1px solid rgba(255, 255, 255, 0.1)'
              }}
              onClick={() => account.isActive && switchAccount(account.id)}
            >
              {/* Status Badge */}
              {account.isPrimary && (
                <Badge 
                  className="absolute top-2 right-2"
                  style={{
                    background: 'rgba(255, 230, 0, 0.2)',
                    border: '1px solid #FFE600',
                    color: '#FFE600',
                    fontSize: '10px'
                  }}
                >
                  <Crown className="h-3 w-3 mr-1" />
                  Principal
                </Badge>
              )}
              
              {!account.isPrimary && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-8 w-8 p-0"
                    >
                      <MoreVertical className="h-4 w-4" style={{ color: '#999' }} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAccount(account.id)
                      }}
                      className="text-red-500"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Remover conta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Account Info */}
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12" style={{ 
                  border: account.id === activeAccountId 
                    ? '2px solid #FFE600' 
                    : '1px solid rgba(255, 255, 255, 0.2)' 
                }}>
                  {account.thumbnail ? (
                    <AvatarImage src={account.thumbnail} alt={account.nickname} />
                  ) : (
                    <AvatarFallback style={{ 
                      background: account.id === activeAccountId 
                        ? 'rgba(255, 230, 0, 0.2)' 
                        : 'rgba(255, 255, 255, 0.05)',
                      color: account.id === activeAccountId ? '#FFE600' : '#666'
                    }}>
                      <Store className="h-5 w-5" />
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate" style={{ 
                    color: account.id === activeAccountId ? '#fff' : '#ccc' 
                  }}>
                    {account.nickname}
                  </h4>
                  <p className="text-xs truncate" style={{ color: '#666' }}>
                    {account.siteId} • ID: {account.mlUserId}
                  </p>
                  {account.email && (
                    <p className="text-xs truncate mt-1" style={{ color: '#555' }}>
                      {account.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Status Indicators */}
              <div className="mt-4 space-y-2">
                {/* Active Status */}
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: '#888' }}>Status:</span>
                  {account.id === activeAccountId ? (
                    <Badge 
                      variant="outline"
                      style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        color: '#22c55e',
                        fontSize: '10px'
                      }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ativa
                    </Badge>
                  ) : account.isActive ? (
                    <Badge 
                      variant="outline"
                      style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#3b82f6',
                        fontSize: '10px'
                      }}
                    >
                      Disponível
                    </Badge>
                  ) : (
                    <Badge 
                      variant="outline"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontSize: '10px'
                      }}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Inativa
                    </Badge>
                  )}
                </div>

                {/* Token Status */}
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: '#888' }}>Token:</span>
                  {account.tokenValid ? (
                    <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
                      <Shield className="h-3 w-3" />
                      Válido
                    </span>
                  ) : (
                    <span className="flex items-center gap-1" style={{ color: '#ef4444' }}>
                      <AlertCircle className="h-3 w-3" />
                      Expirado
                    </span>
                  )}
                </div>

                {/* Last Sync */}
                {account.lastSyncAt && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#888' }}>Última sinc:</span>
                    <span className="flex items-center gap-1" style={{ color: '#666' }}>
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(account.lastSyncAt), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                )}

                {/* Error Message */}
                {account.connectionError && (
                  <div 
                    className="mt-2 p-2 rounded text-xs"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#ef4444'
                    }}
                  >
                    {account.connectionError}
                  </div>
                )}
              </div>

              {/* Loading Overlay */}
              {switching === account.id && (
                <div 
                  className="absolute inset-0 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)'
                  }}
                >
                  <RefreshCw className="h-5 w-5 animate-spin" style={{ color: '#FFE600' }} />
                </div>
              )}
            </div>
          ))}

          {/* Add Account Card */}
          {canAddMoreAccounts && (
            <div
              className="p-4 rounded-lg border cursor-pointer transition-all hover:opacity-80"
              style={{
                background: 'rgba(255, 230, 0, 0.05)',
                border: '2px dashed rgba(255, 230, 0, 0.3)',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="h-10 w-10 mb-3" style={{ color: '#FFE600' }} />
              <span className="text-sm font-medium" style={{ color: '#FFE600' }}>
                Adicionar Nova Conta
              </span>
              <span className="text-xs mt-1" style={{ color: '#999' }}>
                Conecte outra loja ML
              </span>
            </div>
          )}
        </div>

        {/* Plan Info */}
        {!canAddMoreAccounts && (
          <div 
            className="p-4 rounded-lg"
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" style={{ color: '#ef4444' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
                  Limite de contas atingido
                </p>
                <p className="text-xs mt-1" style={{ color: '#999' }}>
                  Seu plano {organizationInfo.subscriptionStatus} permite até {organizationInfo.maxAccounts} conta(s).
                  Faça upgrade para adicionar mais contas.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

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
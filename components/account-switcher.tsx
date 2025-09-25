"use client"

/**
 * Componente para alternar entre contas ML
 * Mostra todas as contas conectadas e permite trocar facilmente
 */

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, Plus, Check, AlertCircle, Power, Store } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface MLAccount {
  id: string
  mlUserId: string
  nickname: string
  email: string | null
  siteId: string
  thumbnail: string | null
  isPrimary: boolean
  lastSyncAt: Date | null
  connectionError: string | null
  sellerReputation: any
  powerSellerStatus: string | null
}

interface AccountSwitcherProps {
  className?: string
}

export function AccountSwitcher({ className }: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<MLAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/ml-accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.accounts)
        setActiveAccountId(data.activeAccountId)
      }
    } catch (error) {
      logger.error('Failed to load accounts:', { error })
    }
  }

  const switchAccount = async (accountId: string) => {
    if (accountId === activeAccountId) {
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ml-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      })

      if (response.ok) {
        setActiveAccountId(accountId)
        setIsOpen(false)
        // Recarrega a página para atualizar os dados
        router.refresh()
      }
    } catch (error) {
      logger.error('Failed to switch account:', { error })
    } finally {
      setLoading(false)
    }
  }

  const addNewAccount = async () => {
    try {
      const response = await fetch('/api/ml-accounts/add', {
        method: 'POST'
      })
      
      if (response.ok) {
        const { authUrl } = await response.json()
        window.location.href = authUrl
      }
    } catch (error) {
      logger.error('Failed to add account:', { error })
    }
  }

  const activeAccount = accounts.find(a => a.id === activeAccountId)

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-black-rich border border-yellow-glow-10 rounded-lg hover:border-yellow-glow-20 transition-all"
        disabled={loading}
      >
        {activeAccount?.thumbnail ? (
          <Image
            src={activeAccount.thumbnail}
            alt={activeAccount.nickname}
            width={32}
            height={32}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <Store className="w-8 h-8 text-yellow-primary" />
        )}
        
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {activeAccount?.nickname || 'Selecione uma conta'}
            </span>
            {activeAccount?.isPrimary && (
              <span className="text-xs px-2 py-0.5 bg-yellow-glow-20 text-yellow-primary rounded">
                Principal
              </span>
            )}
          </div>
          <span className="text-xs text-gray-medium">
            {activeAccount?.siteId} • {activeAccount?.mlUserId}
          </span>
        </div>
        
        <ChevronDown className={`w-4 h-4 text-gray-medium transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full min-w-[300px] bg-black-rich border border-yellow-glow-10 rounded-lg shadow-xl z-50">
          <div className="p-2">
            <div className="text-xs text-gray-dark px-3 py-2 uppercase tracking-wider">
              Contas Conectadas
            </div>
            
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => switchAccount(account.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-yellow-glow-10 transition-all"
              >
                {account.thumbnail ? (
                  <Image
                    src={account.thumbnail}
                    alt={account.nickname}
                    width={32}
                    height={32}
                    className="rounded-full"
                    unoptimized
                  />
                ) : (
                  <Store className="w-8 h-8 text-gray-medium" />
                )}
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {account.nickname}
                    </span>
                    {account.isPrimary && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-glow-20 text-yellow-primary rounded">
                        Principal
                      </span>
                    )}
                    {account.powerSellerStatus && (
                      <Power className="w-3 h-3 text-yellow-primary" />
                    )}
                  </div>
                  <span className="text-xs text-gray-medium">
                    {account.siteId} • {account.mlUserId}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {account.connectionError ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : account.id === activeAccountId ? (
                    <Check className="w-4 h-4 text-yellow-primary" />
                  ) : null}
                </div>
              </button>
            ))}
            
            <div className="border-t border-yellow-glow-10 mt-2 pt-2">
              <button
                onClick={addNewAccount}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-yellow-glow-10 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-yellow-glow-20 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-yellow-primary" />
                </div>
                <span className="text-sm font-medium text-yellow-primary">
                  Adicionar Conta ML
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
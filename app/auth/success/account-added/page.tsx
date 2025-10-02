'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

function AccountAddedContent() {
  const searchParams = useSearchParams()
  const [isClosing, setIsClosing] = useState(false)

  const accountName = searchParams.get('nickname') || searchParams.get('account') || 'Nova conta'
  const error = searchParams.get('error')

  useEffect(() => {
    // Pequeno delay para garantir que o modal está pronto para receber mensagem
    const timer = setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        // 🎯 POPUP MODE: Enviar mensagem para janela pai e fechar
        if (error) {
          window.opener.postMessage(
            {
              type: 'ml-oauth-error',
              error: decodeURIComponent(error)
            },
            window.location.origin
          )
        } else {
          window.opener.postMessage(
            {
              type: 'ml-oauth-success',
              account: accountName
            },
            window.location.origin
          )
        }

        setIsClosing(true)

        // Fechar janela após enviar mensagem
        setTimeout(() => {
          window.close()
        }, 1500)
      } else {
        // 🎯 NEW TAB MODE: NÃO redirecionar automaticamente
        // Usuário deve fechar manualmente ou clicar no botão
        setIsClosing(true)

        // Tentar fechar após 2 segundos (pode funcionar em alguns browsers)
        setTimeout(() => {
          window.close()
        }, 2000)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [accountName, error])
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        color: '#fff'
      }}
    >
      <div className="text-center space-y-6 p-8">
        {error ? (
          <>
            <div className="flex justify-center">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '2px solid #ef4444'
                }}
              >
                <span className="text-4xl">⚠️</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold" style={{ color: '#ef4444' }}>
                Erro ao adicionar conta
              </h1>
              <p className="text-gray-400">
                {decodeURIComponent(error)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '2px solid #22c55e'
                }}
              >
                <CheckCircle className="h-10 w-10" style={{ color: '#22c55e' }} />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                Conta adicionada com sucesso!
              </h1>
              <p className="text-gray-300 font-medium">
                {accountName}
              </p>
              <p className="text-sm text-gray-500">
                Todas as suas contas ML funcionam simultaneamente
              </p>
            </div>
          </>
        )}
        
        {isClosing && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fechando janela...</span>
            </div>

            {/* Botão manual para fechar caso não feche automaticamente */}
            <button
              onClick={() => window.close()}
              className="px-6 py-3 rounded-xl font-semibold transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)',
                color: '#000',
                border: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              Fechar e Voltar
            </button>

            <p className="text-xs text-gray-600">
              Se a janela não fechar automaticamente, clique no botão acima
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AccountAddedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    }>
      <AccountAddedContent />
    </Suspense>
  )
}
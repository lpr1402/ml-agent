'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

function AccountAddedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isClosing, setIsClosing] = useState(false)

  const accountName = searchParams.get('account') || 'Nova conta'
  const error = searchParams.get('error')
  
  useEffect(() => {
    // Pequeno delay para garantir que o modal está pronto para receber mensagem
    const timer = setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        if (error) {
          // Enviar mensagem de erro
          window.opener.postMessage(
            {
              type: 'ml-oauth-error',
              error: decodeURIComponent(error)
            },
            window.location.origin
          )
        } else {
          // Enviar mensagem de sucesso
          window.opener.postMessage(
            {
              type: 'ml-oauth-success',
              account: decodeURIComponent(accountName)
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
        // Se não tem janela pai, redirecionar para agente após 2 segundos
        setTimeout(() => {
          // Usar Next.js router para manter iOS PWA fullscreen
          router.push('/agente')
        }, 2000)
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [accountName, error, router])
  
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
              <h1 className="text-2xl font-bold">
                Conta adicionada com sucesso!
              </h1>
              <p className="text-gray-400">
                {decodeURIComponent(accountName)} foi conectada à sua organização
              </p>
            </div>
          </>
        )}
        
        {isClosing && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Fechando janela...</span>
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
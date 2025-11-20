/**
 * Página de erro de autenticação
 * SEMPRE usa o domínio correto de constants.ts
 */

"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Suspense } from 'react'
import { APP_URLS } from '@/lib/constants'

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  LoginFailed: {
    title: 'Falha ao iniciar login',
    description: 'Não foi possível conectar com o Mercado Livre. Por favor, tente novamente.',
  },
  NoCode: {
    title: 'Código de autorização ausente',
    description: 'O processo de autenticação foi interrompido. Por favor, tente novamente.',
  },
  InvalidState: {
    title: 'Sessão inválida',
    description: 'Sua sessão expirou ou é inválida. Por favor, faça login novamente.',
  },
  TokenExchange: {
    title: 'Erro na autenticação',
    description: 'Não foi possível completar a autenticação com o Mercado Livre.',
  },
  UserInfo: {
    title: 'Erro ao obter informações',
    description: 'Não foi possível obter suas informações do Mercado Livre.',
  },
  Unknown: {
    title: 'Erro desconhecido',
    description: 'Ocorreu um erro inesperado. Por favor, tente novamente.',
  },
  access_denied: {
    title: 'Acesso negado',
    description: 'Você cancelou o processo de autorização ou não tem permissão para acessar.',
  },
  Configuration: {
    title: 'Erro de configuração',
    description: 'Há um problema com a configuração do servidor. Verifique as credenciais.',
  },
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const error = searchParams.get('error') || 'Unknown'
  const message = searchParams.get('message')

  const errorInfo = ERROR_MESSAGES[error] || ERROR_MESSAGES['Unknown']

  const handleRetry = () => {
    // Usar router para manter iOS PWA fullscreen
    const isPWA = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches
    if (isPWA) {
      router.push('/login')
    } else {
      window.location.href = APP_URLS.API_AUTH_LOGIN
    }
  }

  const handleGoBack = () => {
    // Usar router para manter iOS PWA fullscreen
    router.push('/')
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#0A0A0A] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full">
        <div className="bg-[#111111] border border-gold/20 rounded-xl sm:rounded-2xl p-6 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center mb-5 sm:mb-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/30">
              <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-red-500" strokeWidth={2.5} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
            {errorInfo?.title}
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-gray-400 text-center mb-5 sm:mb-6">
            {message || errorInfo?.description}
          </p>

          {/* Error Code */}
          {error !== 'Unknown' && (
            <div className="bg-[#0A0A0A] rounded-lg p-3 mb-5 sm:mb-6">
              <p className="text-xs text-gray-500 text-center">
                Código de erro: <span className="text-gold font-semibold">{error}</span>
              </p>
            </div>
          )}
          
          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold text-sm sm:text-base rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-gold/30 transition-all duration-300 flex items-center justify-center gap-2 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={2.5} />
              Tentar Novamente
            </button>

            <button
              onClick={handleGoBack}
              className="w-full py-2.5 sm:py-3 bg-transparent border border-gold/20 text-gold rounded-lg sm:rounded-xl hover:bg-gold/10 hover:border-gold/30 transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base font-semibold active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
              Voltar ao Início
            </button>
          </div>

          {/* Help */}
          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-gold/10">
            <p className="text-xs text-gray-500 text-center">
              Problemas persistentes? Entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-gold"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
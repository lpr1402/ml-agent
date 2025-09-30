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
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#0A0A0A] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-[#111111] border border-[#FFE600]/20 rounded-2xl p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-light text-white text-center mb-2">
            {errorInfo?.title}
          </h1>
          
          {/* Description */}
          <p className="text-[#999999] text-center mb-6">
            {message || errorInfo?.description}
          </p>
          
          {/* Error Code */}
          {error !== 'Unknown' && (
            <div className="bg-[#0A0A0A] rounded-lg p-3 mb-6">
              <p className="text-xs text-[#666666] text-center">
                Código de erro: <span className="text-[#FFE600]">{error}</span>
              </p>
            </div>
          )}
          
          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-gradient-to-r from-[#FFE600] to-[#FFC700] text-[#0A0A0A] font-semibold rounded-lg hover:shadow-lg hover:shadow-[#FFE600]/30 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
            
            <button
              onClick={handleGoBack}
              className="w-full py-3 bg-transparent border border-[#FFE600]/20 text-[#FFE600] rounded-lg hover:bg-[#FFE600]/10 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Início
            </button>
          </div>
          
          {/* Help */}
          <div className="mt-8 pt-6 border-t border-[#FFE600]/10">
            <p className="text-xs text-[#666666] text-center">
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600]"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
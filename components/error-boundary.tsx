'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { RefreshCw, Home, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

const MAX_AUTO_RETRIES = 3
const RETRY_DELAY = 1000

/**
 * Error Boundary para iOS PWA - Production 2025
 *
 * Previne crashes e oferece recovery automático:
 * - Auto-retry até 3x para erros transientes
 * - UI amigável para erros persistentes
 * - Logging para debugging
 * - Opção de reload ou voltar ao início
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null

  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)

    this.setState({ errorInfo })

    // Log to server for debugging (optional)
    this.logErrorToServer(error, errorInfo)

    // Auto-retry for transient errors
    if (this.state.retryCount < MAX_AUTO_RETRIES) {
      this.scheduleAutoRetry()
    }
  }

  private logErrorToServer(error: Error, errorInfo: ErrorInfo) {
    try {
      fetch('/api/log/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          timestamp: new Date().toISOString()
        })
      }).catch(() => {
        // Silently fail - don't want to cause more errors
      })
    } catch {
      // Ignore logging errors
    }
  }

  private scheduleAutoRetry() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }

    this.retryTimeout = setTimeout(() => {
      console.log(`[ErrorBoundary] Auto-retry attempt ${this.state.retryCount + 1}/${MAX_AUTO_RETRIES}`)

      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }))
    }, RETRY_DELAY * (this.state.retryCount + 1))
  }

  public override componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/agente'
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    })
  }

  public override render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image
                src="/mlagent-logo-3d.png"
                alt="ML Agent"
                width={80}
                height={80}
                className="drop-shadow-2xl"
              />
            </div>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-white mb-2">
              Algo deu errado
            </h2>

            {/* Description */}
            <p className="text-gray-400 text-sm mb-6">
              Ocorreu um erro inesperado. Voce pode tentar novamente ou voltar para a pagina inicial.
            </p>

            {/* Error details (dev only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-3 bg-red-900/20 rounded-lg text-left">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-gold via-gold-light to-gold text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full h-11 rounded-xl font-medium bg-white/10 text-white flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
              >
                <Home className="w-5 h-5" />
                Voltar ao Inicio
              </button>

              <button
                onClick={this.handleReload}
                className="w-full h-10 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Recarregar pagina
              </button>
            </div>

            {/* Retry count indicator */}
            {this.state.retryCount > 0 && (
              <p className="mt-4 text-xs text-gray-600">
                Tentativas: {this.state.retryCount}/{MAX_AUTO_RETRIES}
              </p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook para usar error boundary programaticamente
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const handleError = React.useCallback((error: Error) => {
    console.error('[useErrorHandler] Error caught:', error)
    setError(error)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  // Se tiver erro, jogar para o boundary mais próximo
  if (error) {
    throw error
  }

  return { handleError, clearError }
}

/**
 * Wrapper component para facilitar uso
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

"use client"

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from "framer-motion"
import { Lock, User, UserPlus, ShoppingBag, CheckCircle, Shield } from "lucide-react"
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

// Estender tipo do Navigator para incluir standalone (iOS PWA)
declare global {
  interface Navigator {
    standalone?: boolean
  }
}

export default function LoginClient() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const pinInputRef = useRef<HTMLInputElement>(null)

  // Para registro
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerPin, setRegisterPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showConnectML, setShowConnectML] = useState(false)
  const registerPinInputRef = useRef<HTMLInputElement>(null)
  const confirmPinInputRef = useRef<HTMLInputElement>(null)

  // Estados de feedback visual do PIN
  const [pinError, setPinError] = useState(false)
  const [pinSuccess, setPinSuccess] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [focusedPinType, setFocusedPinType] = useState<'login' | 'register' | 'confirm' | null>(null)
  const [ariaMessage, setAriaMessage] = useState('')

  // Haptic feedback para mobile (vibração)
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'error' | 'success') => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10)
          break
        case 'medium':
          navigator.vibrate(20)
          break
        case 'heavy':
          navigator.vibrate(30)
          break
        case 'error':
          navigator.vibrate([50, 50, 50]) // 3 vibrações curtas
          break
        case 'success':
          navigator.vibrate([30, 30, 60]) // 2 curtas + 1 longa
          break
      }
    }
  }

  // 🔴 MODERN PIN INPUT PATTERN (2025 Best Practice)
  // Baseado em pesquisa web: melhores práticas para PIN/OTP input
  const handlePinChange = (value: string, type: 'login' | 'register' | 'confirm') => {
    // Remove caracteres não numéricos e limita a 3 dígitos
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 3)
    const previousLength = type === 'login' ? pin.length : type === 'register' ? registerPin.length : confirmPin.length

    if (type === 'login') {
      setPin(numericValue)
      setError('')
      setPinError(false)

      // Haptic feedback ao digitar
      if (numericValue.length > previousLength) {
        triggerHaptic('light')
      }

      // Feedback de progresso via aria
      if (numericValue.length === 1) setAriaMessage('Primeiro dígito inserido')
      else if (numericValue.length === 2) setAriaMessage('Segundo dígito inserido')
      else if (numericValue.length === 3) {
        setAriaMessage('PIN completo, verificando...')
        setPinSuccess(true)
        triggerHaptic('success')
      }

      // Auto-login quando completar 3 dígitos
      if (numericValue.length === 3) {
        setPinLoading(true)
        handleLogin(numericValue)
      }
    } else if (type === 'register') {
      setRegisterPin(numericValue)
      setError('')

      // Haptic feedback
      if (numericValue.length > previousLength) {
        triggerHaptic('light')
      }

      // Feedback de progresso
      if (numericValue.length === 1) setAriaMessage('Primeiro dígito do PIN')
      else if (numericValue.length === 2) setAriaMessage('Segundo dígito do PIN')
      else if (numericValue.length === 3) {
        setAriaMessage('PIN completo')
        triggerHaptic('medium')
      }
    } else if (type === 'confirm') {
      setConfirmPin(numericValue)
      setError('')

      // Haptic feedback
      if (numericValue.length > previousLength) {
        triggerHaptic('light')
      }

      // Verificar correspondência ao completar
      if (numericValue.length === 3) {
        if (numericValue === registerPin) {
          setAriaMessage('PINs coincidem!')
          triggerHaptic('success')
        } else {
          setAriaMessage('PINs não coincidem')
          triggerHaptic('error')
        }
      }
    }
  }

  // Handle backspace e navegação do teclado
  const handlePinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'login' | 'register' | 'confirm') => {
    // Backspace: remover último dígito
    if (e.key === 'Backspace') {
      e.preventDefault()
      const currentValue = type === 'login' ? pin : type === 'register' ? registerPin : confirmPin
      handlePinChange(currentValue.slice(0, -1), type)

      // Haptic feedback ao apagar
      triggerHaptic('light')

      // Feedback via aria
      if (currentValue.length > 0) {
        setAriaMessage(`Dígito ${currentValue.length} removido`)
      }
    }
    // Delete: limpar tudo
    else if (e.key === 'Delete') {
      e.preventDefault()
      handlePinChange('', type)
      triggerHaptic('medium')
      setAriaMessage('PIN limpo')
    }
  }

  // Foco automático no input quando clicar nas caixas visuais
  const focusPinInput = (type: 'login' | 'register' | 'confirm') => {
    const inputRef = type === 'login' ? pinInputRef : type === 'register' ? registerPinInputRef : confirmPinInputRef

    // Atualizar estado de foco
    setFocusedPinType(type)

    // Timeout mínimo para garantir que o focus funcione em todos os dispositivos
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const handleLogin = async (pinValue?: string) => {
    const finalPin = pinValue || pin

    if (!username.trim()) {
      setError('Digite o nome de usuário')
      setPinLoading(false)
      setPinSuccess(false)
      return
    }

    if (finalPin.length !== 3) {
      setError('Digite o PIN completo')
      setPinLoading(false)
      setPinSuccess(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toUpperCase(), pin: finalPin })
      })

      const data = await response.json()

      if (response.ok) {
        // Sucesso - manter visual de sucesso
        setAriaMessage('Login realizado com sucesso!')
        toast({
          title: 'Login realizado com sucesso',
          description: 'Bem-vindo ao ML Agent PRO'
        })

        if (data.role === 'SUPER_ADMIN') {
          router.push('/admin/dashboard')
        } else {
          router.push('/agente')
        }
      } else {
        // Erro - feedback visual e haptic
        setError(data.error || 'Usuário ou PIN incorretos')
        setAriaMessage('PIN incorreto. Tente novamente.')

        // Ativar animação de erro
        setPinError(true)
        triggerHaptic('error')

        // Limpar estados e resetar PIN
        setPinLoading(false)
        setPinSuccess(false)
        setPin('')

        // Remover animação de erro após 500ms
        setTimeout(() => {
          setPinError(false)
          pinInputRef.current?.focus()
          pinInputRef.current?.select()
        }, 500)
      }
    } catch (_error) {
      setError('Erro ao fazer login. Tente novamente.')
      setAriaMessage('Erro de conexão. Tente novamente.')

      // Feedback de erro
      setPinError(true)
      triggerHaptic('error')
      setPinLoading(false)
      setPinSuccess(false)

      setTimeout(() => {
        setPinError(false)
      }, 500)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!registerUsername.trim()) {
      setError('Digite um nome de usuário')
      return
    }

    if (registerUsername.length < 3) {
      setError('O nome de usuário deve ter pelo menos 3 caracteres')
      return
    }

    if (registerPin.length !== 3) {
      setError('Digite o PIN completo')
      return
    }

    if (registerPin !== confirmPin) {
      setError('Os PINs não coincidem')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerUsername.trim().toUpperCase(),
          pin: registerPin
        })
      })

      const data = await response.json()

      if (response.ok) {
        setShowConnectML(true)
        toast({
          title: 'Conta criada com sucesso',
          description: 'Agora conecte sua conta do Mercado Livre'
        })
      } else {
        setError(data.error || 'Erro ao criar conta')
      }
    } catch (_error) {
      setError('Erro ao registrar. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const connectML = () => {
    window.location.href = '/api/auth/login'
  }

  return (
    <div className="min-h-screen min-h-[100dvh] relative overflow-x-hidden" role="main">
      {/* Premium Background - Multi-Layer */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 -z-10" />
      <div className="fixed inset-0 bg-gradient-to-br from-gray-800/20 via-transparent to-gray-800/20 -z-10" />
      <div className="fixed inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.08),transparent_50%)] pointer-events-none -z-10" />

      {/* Noise Texture */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none -z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      />

      <div className="relative z-10 w-full min-h-screen min-h-[100dvh]">
        {/* Mobile Layout - Vertical */}
        <div className="lg:hidden flex flex-col min-h-screen min-h-[100dvh]">
          {/* Content Container - Centered */}
          <div className="flex-1 flex flex-col justify-center py-6">
            {/* Header - Mobile */}
            <motion.header
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full px-4 sm:px-6"
            >
            <div className="flex flex-col items-center gap-2.5 sm:gap-3">
              {/* Logos Row */}
              <div className="flex items-center gap-5 sm:gap-6 justify-center">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <Image
                    src="/mlagent-logo-3d.png"
                    alt="ML Agent"
                    width={300}
                    height={300}
                    className="h-32 sm:h-36 md:h-40 w-auto object-contain"
                    style={{ filter: 'drop-shadow(0 0 30px rgba(212, 175, 55, 0.4))' }}
                    priority
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 200 }}
                  className="relative flex items-center justify-center"
                >
                  {/* Subtle glow */}
                  <div className="absolute inset-0 bg-gold/30 blur-md scale-150" />

                  {/* Connection Icon - Premium */}
                  <Image
                    src="/connection-icon.png"
                    alt="Conexão ML Agent × Gugaleo"
                    width={36}
                    height={36}
                    className="h-7 sm:h-8 md:h-9 w-auto object-contain relative"
                    style={{ filter: 'drop-shadow(0 2px 10px rgba(212,175,55,0.5))' }}
                    priority
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <Image
                    src="/gugaleo-logo.png"
                    alt="Gugaleo"
                    width={300}
                    height={300}
                    className="h-32 sm:h-36 md:h-40 w-auto object-contain"
                    style={{ filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.2))' }}
                    priority
                  />
                </motion.div>
              </div>

              {/* Title & Subtitle - Logo PRO Completo */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex flex-col items-center gap-0.5 sm:gap-1"
              >
                {/* Logo ML Agent PRO - Imagem Completa - BEM MAIOR E DESTACADA */}
                <div className="flex items-center justify-center">
                  <Image
                    src="/mlagent-pro-logo.png"
                    alt="ML Agent PRO"
                    width={1024}
                    height={230}
                    className="h-14 xs:h-16 sm:h-20 md:h-24 w-auto object-contain"
                    style={{
                      filter: 'drop-shadow(0 0 30px rgba(212, 175, 55, 0.4))',
                      maxWidth: '90%'
                    }}
                    priority
                  />
                </div>

                {/* Subtitle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] sm:text-xs text-gray-500 font-medium">Uma criação</span>
                  <Image
                    src="/axnexlabs-logo.png"
                    alt="AxnexLabs"
                    width={1024}
                    height={450}
                    className="h-6 sm:h-7 md:h-8 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
                    priority
                  />
                </div>
              </motion.div>
              </div>
            </motion.header>

            {/* Main Content - Mobile */}
            <main className="flex items-center justify-center px-4 sm:px-6 mt-4 sm:mt-5">
            <div className="w-full max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                {/* Card Premium */}
                <div className="relative rounded-xl sm:rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none overflow-hidden">

                  <div className="relative z-10 p-6 sm:p-8 md:p-10">
                  {/* Mode Toggle - Premium Style */}
                  <div className="relative inline-flex items-center h-11 sm:h-12 p-1 sm:p-1.5 gap-1 sm:gap-1.5 bg-black/40 backdrop-blur-2xl rounded-xl sm:rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none w-full mb-6 sm:mb-8">
                    <button
                      onClick={() => { setMode('login'); setError('') }}
                      className={`group relative z-10 flex-1 flex items-center justify-center gap-2 h-full rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 border border-transparent ${
                        mode === 'login'
                          ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <User className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-300 ${mode === 'login' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`} strokeWidth={2.5} />
                      <span className="font-semibold tracking-wide">Entrar</span>
                    </button>
                    <button
                      onClick={() => { setMode('register'); setError('') }}
                      className={`group relative z-10 flex-1 flex items-center justify-center gap-2 h-full rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 border border-transparent ${
                        mode === 'register'
                          ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <UserPlus className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-300 ${mode === 'register' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`} strokeWidth={2.5} />
                      <span className="font-semibold tracking-wide">Registrar</span>
                    </button>
                  </div>

                  {/* Login Form */}
                  {mode === 'login' && !showConnectML && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="login"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-5 sm:space-y-6"
                      >
                        {/* Username */}
                        <div>
                          <label htmlFor="username" className="block text-sm font-semibold text-gray-300 mb-2">
                            Nome de Usuário
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-500" strokeWidth={2} />
                            <input
                              id="username"
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value.toUpperCase())}
                              className="w-full pl-10 sm:pl-11 pr-4 py-3 sm:py-3.5 bg-black/60 border border-white/10 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 outline-none transition-all"
                              placeholder="Digite seu usuário"
                              autoComplete="username"
                            />
                          </div>
                        </div>

                        {/* PIN - Modern Single Input Pattern */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            PIN de Segurança
                          </label>
                          <div className="relative">
                            {/* Input invisível mas focável - 2025 Best Practice */}
                            <input
                              ref={pinInputRef}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={3}
                              value={pin}
                              onChange={(e) => handlePinChange(e.target.value, 'login')}
                              onKeyDown={(e) => handlePinKeyDown(e, 'login')}
                              onFocus={() => { pinInputRef.current?.select(); setFocusedPinType('login') }}
                              onBlur={() => setFocusedPinType(null)}
                              className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer text-transparent caret-transparent"
                              autoComplete="one-time-code"
                              aria-label="PIN de segurança - 3 dígitos"
                              aria-describedby="pin-status"
                            />

                            {/* Caixas visuais - clicáveis para focar input */}
                            <motion.div
                              className="flex items-center justify-center gap-3 sm:gap-4"
                              onClick={() => focusPinInput('login')}
                              animate={pinError ? {
                                x: [0, -10, 10, -10, 10, 0],
                                transition: { duration: 0.4 }
                              } : {}}
                            >
                              {[0, 1, 2].map((index) => {
                                const isFilled = pin.length > index
                                const isActive = focusedPinType === 'login' && pin.length === index

                                return (
                                  <motion.div
                                    key={index}
                                    initial={{ scale: 1 }}
                                    animate={{
                                      scale: isActive ? [1, 1.05, 1] : 1,
                                      transition: { duration: 0.3, repeat: isActive ? Infinity : 0, repeatDelay: 0.5 }
                                    }}
                                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 flex items-center justify-center text-lg sm:text-2xl font-bold bg-black/60 border-2 rounded-xl sm:rounded-2xl text-gold transition-all duration-200 cursor-pointer relative"
                                    style={{
                                      borderColor: pinError
                                        ? 'rgba(239, 68, 68, 0.6)'
                                        : pinSuccess && isFilled
                                        ? 'rgba(34, 197, 94, 0.6)'
                                        : isFilled
                                        ? 'rgba(212, 175, 55, 0.5)'
                                        : isActive
                                        ? 'rgba(212, 175, 55, 0.3)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                      boxShadow: pinError && isFilled
                                        ? '0 0 16px rgba(239, 68, 68, 0.3)'
                                        : pinSuccess && isFilled
                                        ? '0 0 16px rgba(34, 197, 94, 0.3)'
                                        : isFilled
                                        ? '0 0 12px rgba(212, 175, 55, 0.2)'
                                        : isActive
                                        ? '0 0 8px rgba(212, 175, 55, 0.15)'
                                        : 'none'
                                    }}
                                  >
                                    {pinLoading && isFilled ? (
                                      <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                                    ) : (
                                      <motion.span
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.2 }}
                                        key={pin[index] || 'empty'}
                                      >
                                        {pin[index] || '●'}
                                      </motion.span>
                                    )}

                                    {/* Indicador de foco ativo */}
                                    {isActive && (
                                      <motion.div
                                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full"
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 32 }}
                                        transition={{ duration: 0.3 }}
                                      />
                                    )}
                                  </motion.div>
                                )
                              })}
                            </motion.div>

                            {/* Aria-live region para screen readers */}
                            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" id="pin-status">
                              {ariaMessage}
                            </div>
                          </div>
                        </div>

                        {/* Error */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                          >
                            <p className="text-sm text-red-400 text-center font-medium">{error}</p>
                          </motion.div>
                        )}

                        {/* Login Button */}
                        <button
                          onClick={() => handleLogin()}
                          disabled={isLoading || !username || pin.length !== 3}
                          className={`w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                            isLoading || !username || pin.length !== 3
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 active:scale-[0.98]'
                          }`}
                        >
                          {isLoading ? (
                            <div className="flex gap-1.5">
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                            </div>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                              <span className="tracking-wide">Entrar</span>
                            </>
                          )}
                        </button>
                      </motion.div>
                    </AnimatePresence>
                  )}

                  {/* Register Form */}
                  {mode === 'register' && !showConnectML && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="register"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-5 sm:space-y-6"
                      >
                        {/* Username */}
                        <div>
                          <label htmlFor="register-username" className="block text-sm font-semibold text-gray-300 mb-2">
                            Escolha seu Nome de Usuário
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-500" strokeWidth={2} />
                            <input
                              id="register-username"
                              type="text"
                              value={registerUsername}
                              onChange={(e) => setRegisterUsername(e.target.value.toUpperCase())}
                              className="w-full pl-10 sm:pl-11 pr-4 py-3 sm:py-3.5 bg-black/60 border border-white/10 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 outline-none transition-all"
                              placeholder="Escolha um nome único"
                              autoComplete="username"
                            />
                          </div>
                        </div>

                        {/* Create PIN - Modern Pattern */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Crie seu PIN
                          </label>
                          <div className="relative">
                            <input
                              ref={registerPinInputRef}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={3}
                              value={registerPin}
                              onChange={(e) => handlePinChange(e.target.value, 'register')}
                              onKeyDown={(e) => handlePinKeyDown(e, 'register')}
                              onFocus={() => { registerPinInputRef.current?.select(); setFocusedPinType('register') }}
                              onBlur={() => setFocusedPinType(null)}
                              className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer text-transparent caret-transparent"
                              autoComplete="new-password"
                              aria-label="Criar PIN - 3 dígitos"
                              aria-describedby="pin-status"
                            />

                            <div
                              className="flex items-center justify-center gap-3 sm:gap-4"
                              onClick={() => focusPinInput('register')}
                            >
                              {[0, 1, 2].map((index) => {
                                const isFilled = registerPin.length > index
                                const isActive = focusedPinType === 'register' && registerPin.length === index
                                const isComplete = registerPin.length === 3

                                return (
                                  <motion.div
                                    key={index}
                                    initial={{ scale: 1 }}
                                    animate={{
                                      scale: isActive ? [1, 1.05, 1] : 1,
                                      transition: { duration: 0.3, repeat: isActive ? Infinity : 0, repeatDelay: 0.5 }
                                    }}
                                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 flex items-center justify-center text-lg sm:text-2xl font-bold bg-black/60 border-2 rounded-xl sm:rounded-2xl text-gold transition-all duration-200 cursor-pointer relative"
                                    style={{
                                      borderColor: isComplete && isFilled
                                        ? 'rgba(34, 197, 94, 0.5)'
                                        : isFilled
                                        ? 'rgba(212, 175, 55, 0.5)'
                                        : isActive
                                        ? 'rgba(212, 175, 55, 0.3)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                      boxShadow: isComplete && isFilled
                                        ? '0 0 14px rgba(34, 197, 94, 0.25)'
                                        : isFilled
                                        ? '0 0 12px rgba(212, 175, 55, 0.2)'
                                        : isActive
                                        ? '0 0 8px rgba(212, 175, 55, 0.15)'
                                        : 'none'
                                    }}
                                  >
                                    <motion.span
                                      initial={{ opacity: 0, scale: 0.5 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.2 }}
                                      key={registerPin[index] || 'empty'}
                                    >
                                      {registerPin[index] || '●'}
                                    </motion.span>

                                    {isActive && (
                                      <motion.div
                                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full"
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 32 }}
                                        transition={{ duration: 0.3 }}
                                      />
                                    )}
                                  </motion.div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Confirm PIN - Modern Pattern */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Confirme seu PIN
                          </label>
                          <div className="relative">
                            <input
                              ref={confirmPinInputRef}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={3}
                              value={confirmPin}
                              onChange={(e) => handlePinChange(e.target.value, 'confirm')}
                              onKeyDown={(e) => handlePinKeyDown(e, 'confirm')}
                              onFocus={() => { confirmPinInputRef.current?.select(); setFocusedPinType('confirm') }}
                              onBlur={() => setFocusedPinType(null)}
                              className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer text-transparent caret-transparent"
                              autoComplete="new-password"
                              aria-label="Confirmar PIN - 3 dígitos"
                              aria-describedby="pin-status"
                            />

                            <motion.div
                              className="flex items-center justify-center gap-3 sm:gap-4"
                              onClick={() => focusPinInput('confirm')}
                              animate={
                                confirmPin.length === 3 && registerPin !== confirmPin
                                  ? { x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.4 } }
                                  : {}
                              }
                            >
                              {[0, 1, 2].map((index) => {
                                const isFilled = confirmPin.length > index
                                const isActive = focusedPinType === 'confirm' && confirmPin.length === index
                                const isComplete = confirmPin.length === 3
                                const isMatching = isComplete && registerPin === confirmPin
                                const isNotMatching = isComplete && registerPin !== confirmPin

                                return (
                                  <motion.div
                                    key={index}
                                    initial={{ scale: 1 }}
                                    animate={{
                                      scale: isActive ? [1, 1.05, 1] : 1,
                                      transition: { duration: 0.3, repeat: isActive ? Infinity : 0, repeatDelay: 0.5 }
                                    }}
                                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 flex items-center justify-center text-lg sm:text-2xl font-bold bg-black/60 border-2 rounded-xl sm:rounded-2xl text-gold transition-all duration-200 cursor-pointer relative"
                                    style={{
                                      borderColor: isNotMatching && isFilled
                                        ? 'rgba(239, 68, 68, 0.6)'
                                        : isMatching && isFilled
                                        ? 'rgba(34, 197, 94, 0.6)'
                                        : isFilled
                                        ? 'rgba(212, 175, 55, 0.5)'
                                        : isActive
                                        ? 'rgba(212, 175, 55, 0.3)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                      boxShadow: isNotMatching && isFilled
                                        ? '0 0 16px rgba(239, 68, 68, 0.3)'
                                        : isMatching && isFilled
                                        ? '0 0 16px rgba(34, 197, 94, 0.3)'
                                        : isFilled
                                        ? '0 0 12px rgba(212, 175, 55, 0.2)'
                                        : isActive
                                        ? '0 0 8px rgba(212, 175, 55, 0.15)'
                                        : 'none'
                                    }}
                                  >
                                    <motion.span
                                      initial={{ opacity: 0, scale: 0.5 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.2 }}
                                      key={confirmPin[index] || 'empty'}
                                    >
                                      {confirmPin[index] || '●'}
                                    </motion.span>

                                    {isActive && (
                                      <motion.div
                                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full"
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 32 }}
                                        transition={{ duration: 0.3 }}
                                      />
                                    )}
                                  </motion.div>
                                )
                              })}
                            </motion.div>
                          </div>
                          <div className="mt-2">
                            {registerPin && confirmPin && registerPin !== confirmPin && confirmPin.length === 3 && (
                              <motion.p
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-red-400 text-center font-medium"
                              >
                                PINs não coincidem
                              </motion.p>
                            )}
                            {registerPin && confirmPin && registerPin === confirmPin && registerPin.length === 3 && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <p className="text-xs text-emerald-400 font-medium">PINs coincidem!</p>
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Error */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                          >
                            <p className="text-sm text-red-400 text-center font-medium">{error}</p>
                          </motion.div>
                        )}

                        {/* Register Button */}
                        <button
                          onClick={handleRegister}
                          disabled={isLoading || !registerUsername || registerPin.length !== 3 || confirmPin.length !== 3 || registerPin !== confirmPin}
                          className={`w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                            isLoading || !registerUsername || registerPin.length !== 3 || confirmPin.length !== 3 || registerPin !== confirmPin
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 active:scale-[0.98]'
                          }`}
                        >
                          {isLoading ? (
                            <div className="flex gap-1.5">
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                            </div>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                              <span className="tracking-wide">Criar Conta</span>
                            </>
                          )}
                        </button>
                      </motion.div>
                    </AnimatePresence>
                  )}

                  {/* Connect ML Screen */}
                  {showConnectML && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6 text-center"
                    >
                      <div className="space-y-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 border-2 border-emerald-500/30">
                          <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white">Conta Criada!</h3>
                        <p className="text-sm sm:text-base text-gray-400">
                          Agora conecte sua conta do Mercado Livre para começar
                        </p>
                      </div>

                      <button
                        onClick={connectML}
                        className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                        <span className="tracking-wide">Conectar Mercado Livre</span>
                      </button>
                    </motion.div>
                  )}

                    {/* Security Badge */}
                    <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-gold/60" strokeWidth={2.5} />
                      <span className="text-xs text-gray-500 font-medium">
                        Criptografia AES-256-GCM
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            </main>
          </div>

          {/* Footer - Mobile (Fixed at bottom) */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="w-full py-4 px-4 sm:px-6"
          >
            <div className="flex items-center justify-center">
              <span className="text-[10px] sm:text-xs text-gray-600 font-light text-center">
                Versão Brasileira 4.1/1911 Hebert Richards
              </span>
            </div>
          </motion.footer>
        </div>

        {/* Desktop Layout - 50/50 Split */}
        <div className="hidden lg:flex min-h-screen min-h-[100dvh] relative">
          <div className="w-full grid grid-cols-2">
            {/* Left Side - Logos & Title */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center justify-center p-8 xl:p-12"
            >
              <div className="flex flex-col items-center gap-2 xl:gap-3">
                {/* Logos Row - Larger on Desktop */}
                <div className="flex items-center gap-8 xl:gap-10">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <Image
                      src="/mlagent-logo-3d.png"
                      alt="ML Agent"
                      width={400}
                      height={400}
                      className="h-52 xl:h-60 2xl:h-72 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 0 40px rgba(212, 175, 55, 0.5))' }}
                      priority
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 200 }}
                    className="relative flex items-center justify-center"
                  >
                    {/* Subtle glow */}
                    <div className="absolute inset-0 bg-gold/40 blur-xl" />

                    {/* Connection Icon - Premium Desktop */}
                    <Image
                      src="/connection-icon.png"
                      alt="Conexão ML Agent × Gugaleo"
                      width={48}
                      height={48}
                      className="h-10 xl:h-11 2xl:h-12 w-auto object-contain relative"
                      style={{ filter: 'drop-shadow(0 0 15px rgba(212,175,55,0.4))' }}
                      priority
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <Image
                      src="/gugaleo-logo.png"
                      alt="Gugaleo"
                      width={400}
                      height={400}
                      className="h-52 xl:h-60 2xl:h-72 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 0 25px rgba(255, 255, 255, 0.25))' }}
                      priority
                    />
                  </motion.div>
                </div>

                {/* Title & Subtitle - Closer to logos */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="flex flex-col items-center gap-0"
                >
                  {/* Logo ML Agent PRO - Imagem Completa - BEM MAIOR E DESTACADA */}
                  <div className="flex items-center justify-center">
                    <Image
                      src="/mlagent-pro-logo.png"
                      alt="ML Agent PRO"
                      width={1024}
                      height={230}
                      className="h-20 xl:h-24 2xl:h-28 w-auto object-contain"
                      style={{
                        filter: 'drop-shadow(0 0 35px rgba(212, 175, 55, 0.5))',
                        maxWidth: '600px'
                      }}
                      priority
                    />
                  </div>

                  {/* Subtitle - Colado na parte inferior */}
                  <div className="flex items-center gap-2 -mt-1">
                    <span className="text-sm xl:text-base text-gray-500 font-medium">Uma criação</span>
                    <Image
                      src="/axnexlabs-logo.png"
                      alt="AxnexLabs"
                      width={1024}
                      height={450}
                      className="h-8 xl:h-9 2xl:h-10 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
                      priority
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Right Side - Login Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center justify-center p-8 xl:p-10"
            >
              <div className="w-full max-w-md">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  {/* Card Premium */}
                  <div className="relative rounded-2xl xl:rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] before:absolute before:inset-0 before:rounded-2xl xl:before:rounded-3xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none after:absolute after:inset-0 after:rounded-2xl xl:after:rounded-3xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none overflow-hidden">

                    <div className="relative z-10 p-8 xl:p-10">
                      {/* Mode Toggle - Premium Style */}
                      <div className="relative inline-flex items-center h-11 xl:h-12 p-1.5 gap-1.5 bg-black/40 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none w-full mb-6">
                        <button
                          onClick={() => { setMode('login'); setError('') }}
                          className={`group relative z-10 flex-1 flex items-center justify-center gap-2 h-full rounded-xl xl:rounded-2xl text-sm xl:text-base font-medium transition-all duration-300 border border-transparent ${
                            mode === 'login'
                              ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                              : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                          }`}
                        >
                          <User className={`w-4 h-4 xl:w-5 xl:h-5 transition-all duration-300 ${mode === 'login' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`} strokeWidth={2.5} />
                          <span className="font-semibold tracking-wide">Entrar</span>
                        </button>
                        <button
                          onClick={() => { setMode('register'); setError('') }}
                          className={`group relative z-10 flex-1 flex items-center justify-center gap-2 h-full rounded-xl xl:rounded-2xl text-sm xl:text-base font-medium transition-all duration-300 border border-transparent ${
                            mode === 'register'
                              ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                              : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                          }`}
                        >
                          <UserPlus className={`w-4 h-4 xl:w-5 xl:h-5 transition-all duration-300 ${mode === 'register' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`} strokeWidth={2.5} />
                          <span className="font-semibold tracking-wide">Registrar</span>
                        </button>
                      </div>

                      {/* Login Form */}
                      {mode === 'login' && !showConnectML && (
                        <AnimatePresence mode="wait">
                          <motion.div
                            key="login"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-5"
                          >
                            {/* Username */}
                            <div>
                              <label htmlFor="username-desktop" className="block text-sm font-semibold text-gray-300 mb-2">
                                Nome de Usuário
                              </label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500" strokeWidth={2} />
                                <input
                                  id="username-desktop"
                                  type="text"
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-base text-white placeholder-gray-500 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 outline-none transition-all"
                                  placeholder="Digite seu usuário"
                                  autoComplete="username"
                                />
                              </div>
                            </div>

                            {/* PIN - Modern Single Input Pattern */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">
                                PIN de Segurança
                              </label>
                              <div className="relative">
                                <input
                                  ref={pinInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={3}
                                  value={pin}
                                  onChange={(e) => handlePinChange(e.target.value, 'login')}
                                  onKeyDown={(e) => handlePinKeyDown(e, 'login')}
                                  onFocus={() => { pinInputRef.current?.select(); setFocusedPinType('login') }}
                                  onBlur={() => setFocusedPinType(null)}
                                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer text-transparent caret-transparent"
                                  autoComplete="one-time-code"
                                  aria-label="PIN de segurança - 3 dígitos"
                                  aria-describedby="pin-status-desktop"
                                />

                                <motion.div
                                  className="flex items-center justify-center gap-3.5"
                                  onClick={() => focusPinInput('login')}
                                  animate={pinError ? {
                                    x: [0, -10, 10, -10, 10, 0],
                                    transition: { duration: 0.4 }
                                  } : {}}
                                >
                                  {[0, 1, 2].map((index) => {
                                    const isFilled = pin.length > index
                                    const isActive = focusedPinType === 'login' && pin.length === index

                                    return (
                                      <motion.div
                                        key={index}
                                        initial={{ scale: 1 }}
                                        animate={{
                                          scale: isActive ? [1, 1.05, 1] : 1,
                                          transition: { duration: 0.3, repeat: isActive ? Infinity : 0, repeatDelay: 0.5 }
                                        }}
                                        className="w-16 h-16 flex items-center justify-center text-2xl font-bold bg-black/60 border-2 rounded-xl text-gold transition-all duration-200 cursor-pointer relative"
                                        style={{
                                          borderColor: pinError
                                            ? 'rgba(239, 68, 68, 0.6)'
                                            : pinSuccess && isFilled
                                            ? 'rgba(34, 197, 94, 0.6)'
                                            : isFilled
                                            ? 'rgba(212, 175, 55, 0.5)'
                                            : isActive
                                            ? 'rgba(212, 175, 55, 0.3)'
                                            : 'rgba(255, 255, 255, 0.1)',
                                          boxShadow: pinError && isFilled
                                            ? '0 0 16px rgba(239, 68, 68, 0.3)'
                                            : pinSuccess && isFilled
                                            ? '0 0 16px rgba(34, 197, 94, 0.3)'
                                            : isFilled
                                            ? '0 0 12px rgba(212, 175, 55, 0.2)'
                                            : isActive
                                            ? '0 0 8px rgba(212, 175, 55, 0.15)'
                                            : 'none'
                                        }}
                                      >
                                        {pinLoading && isFilled ? (
                                          <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                                        ) : (
                                          <motion.span
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.2 }}
                                            key={pin[index] || 'empty'}
                                          >
                                            {pin[index] || '●'}
                                          </motion.span>
                                        )}

                                        {isActive && (
                                          <motion.div
                                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full"
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: 32 }}
                                            transition={{ duration: 0.3 }}
                                          />
                                        )}
                                      </motion.div>
                                    )
                                  })}
                                </motion.div>

                                <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" id="pin-status-desktop">
                                  {ariaMessage}
                                </div>
                              </div>
                            </div>

                            {/* Error */}
                            {error && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                              >
                                <p className="text-sm text-red-400 text-center font-medium">{error}</p>
                              </motion.div>
                            )}

                            {/* Login Button */}
                            <button
                              onClick={() => handleLogin()}
                              disabled={isLoading || !username || pin.length !== 3}
                              className={`w-full h-12 rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                                isLoading || !username || pin.length !== 3
                                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 active:scale-[0.98]'
                              }`}
                            >
                              {isLoading ? (
                                <div className="flex gap-1.5">
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                                </div>
                              ) : (
                                <>
                                  <Lock className="w-4.5 h-4.5" strokeWidth={2.5} />
                                  <span className="tracking-wide">Entrar</span>
                                </>
                              )}
                            </button>
                          </motion.div>
                        </AnimatePresence>
                      )}

                      {/* Register Form */}
                      {mode === 'register' && !showConnectML && (
                        <AnimatePresence mode="wait">
                          <motion.div
                            key="register"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-5"
                          >
                            {/* Username */}
                            <div>
                              <label htmlFor="register-username-desktop" className="block text-sm font-semibold text-gray-300 mb-2">
                                Escolha seu Nome de Usuário
                              </label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500" strokeWidth={2} />
                                <input
                                  id="register-username-desktop"
                                  type="text"
                                  value={registerUsername}
                                  onChange={(e) => setRegisterUsername(e.target.value.toUpperCase())}
                                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-base text-white placeholder-gray-500 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 outline-none transition-all"
                                  placeholder="Escolha um nome único"
                                  autoComplete="username"
                                />
                              </div>
                            </div>

                            {/* Create PIN - Modern Pattern */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">
                                Crie seu PIN
                              </label>
                              <div className="relative">
                                <input
                                  ref={registerPinInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={3}
                                  value={registerPin}
                                  onChange={(e) => handlePinChange(e.target.value, 'register')}
                                  onKeyDown={(e) => handlePinKeyDown(e, 'register')}
                                  onFocus={() => { registerPinInputRef.current?.select(); setFocusedPinType('register') }}
                                  onBlur={() => setFocusedPinType(null)}
                                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer text-transparent caret-transparent"
                                  autoComplete="new-password"
                                  aria-label="Criar PIN - 3 dígitos"
                                  aria-describedby="pin-status-desktop"
                                />

                                <div
                                  className="flex items-center justify-center gap-3.5"
                                  onClick={() => focusPinInput('register')}
                                >
                                  {[0, 1, 2].map((index) => {
                                    const isFilled = registerPin.length > index
                                    const isActive = focusedPinType === 'register' && registerPin.length === index
                                    const isComplete = registerPin.length === 3

                                    return (
                                      <motion.div
                                        key={index}
                                        initial={{ scale: 1 }}
                                        animate={{
                                          scale: isActive ? [1, 1.05, 1] : 1,
                                          transition: { duration: 0.3, repeat: isActive ? Infinity : 0, repeatDelay: 0.5 }
                                        }}
                                        className="w-16 h-16 flex items-center justify-center text-2xl font-bold bg-black/60 border-2 rounded-xl text-gold transition-all duration-200 cursor-pointer relative"
                                        style={{
                                          borderColor: isComplete && isFilled
                                            ? 'rgba(34, 197, 94, 0.5)'
                                            : isFilled
                                            ? 'rgba(212, 175, 55, 0.5)'
                                            : isActive
                                            ? 'rgba(212, 175, 55, 0.3)'
                                            : 'rgba(255, 255, 255, 0.1)',
                                          boxShadow: isComplete && isFilled
                                            ? '0 0 14px rgba(34, 197, 94, 0.25)'
                                            : isFilled
                                            ? '0 0 12px rgba(212, 175, 55, 0.2)'
                                            : isActive
                                            ? '0 0 8px rgba(212, 175, 55, 0.15)'
                                            : 'none'
                                        }}
                                      >
                                        <motion.span
                                          initial={{ opacity: 0, scale: 0.5 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ duration: 0.2 }}
                                          key={registerPin[index] || 'empty'}
                                        >
                                          {registerPin[index] || '●'}
                                        </motion.span>

                                        {isActive && (
                                          <motion.div
                                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full"
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: 32 }}
                                            transition={{ duration: 0.3 }}
                                          />
                                        )}
                                      </motion.div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Confirm PIN - Modern Pattern */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">
                                Confirme seu PIN
                              </label>
                              <div className="relative">
                                <input
                                  ref={confirmPinInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={3}
                                  value={confirmPin}
                                  onChange={(e) => handlePinChange(e.target.value, 'confirm')}
                                  onKeyDown={(e) => handlePinKeyDown(e, 'confirm')}
                                  onFocus={() => { confirmPinInputRef.current?.select(); setFocusedPinType('confirm') }}
                                  onBlur={() => setFocusedPinType(null)}
                                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer text-transparent caret-transparent"
                                  autoComplete="new-password"
                                  aria-label="Confirmar PIN - 3 dígitos"
                                  aria-describedby="pin-status-desktop"
                                />

                                <motion.div
                                  className="flex items-center justify-center gap-3.5"
                                  onClick={() => focusPinInput('confirm')}
                                  animate={
                                    confirmPin.length === 3 && registerPin !== confirmPin
                                      ? { x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.4 } }
                                      : {}
                                  }
                                >
                                  {[0, 1, 2].map((index) => {
                                    const isFilled = confirmPin.length > index
                                    const isActive = focusedPinType === 'confirm' && confirmPin.length === index
                                    const isComplete = confirmPin.length === 3
                                    const isMatching = isComplete && registerPin === confirmPin
                                    const isNotMatching = isComplete && registerPin !== confirmPin

                                    return (
                                      <motion.div
                                        key={index}
                                        initial={{ scale: 1 }}
                                        animate={{
                                          scale: isActive ? [1, 1.05, 1] : 1,
                                          transition: { duration: 0.3, repeat: isActive ? Infinity : 0, repeatDelay: 0.5 }
                                        }}
                                        className="w-16 h-16 flex items-center justify-center text-2xl font-bold bg-black/60 border-2 rounded-xl text-gold transition-all duration-200 cursor-pointer relative"
                                        style={{
                                          borderColor: isNotMatching && isFilled
                                            ? 'rgba(239, 68, 68, 0.6)'
                                            : isMatching && isFilled
                                            ? 'rgba(34, 197, 94, 0.6)'
                                            : isFilled
                                            ? 'rgba(212, 175, 55, 0.5)'
                                            : isActive
                                            ? 'rgba(212, 175, 55, 0.3)'
                                            : 'rgba(255, 255, 255, 0.1)',
                                          boxShadow: isNotMatching && isFilled
                                            ? '0 0 16px rgba(239, 68, 68, 0.3)'
                                            : isMatching && isFilled
                                            ? '0 0 16px rgba(34, 197, 94, 0.3)'
                                            : isFilled
                                            ? '0 0 12px rgba(212, 175, 55, 0.2)'
                                            : isActive
                                            ? '0 0 8px rgba(212, 175, 55, 0.15)'
                                            : 'none'
                                        }}
                                      >
                                        <motion.span
                                          initial={{ opacity: 0, scale: 0.5 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ duration: 0.2 }}
                                          key={confirmPin[index] || 'empty'}
                                        >
                                          {confirmPin[index] || '●'}
                                        </motion.span>

                                        {isActive && (
                                          <motion.div
                                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full"
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: 32 }}
                                            transition={{ duration: 0.3 }}
                                          />
                                        )}
                                      </motion.div>
                                    )
                                  })}
                                </motion.div>
                              </div>
                              <div className="mt-2">
                                {registerPin && confirmPin && registerPin !== confirmPin && confirmPin.length === 3 && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-xs text-red-400 text-center font-medium"
                                  >
                                    PINs não coincidem
                                  </motion.p>
                                )}
                                {registerPin && confirmPin && registerPin === confirmPin && registerPin.length === 3 && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center justify-center gap-1"
                                  >
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    <p className="text-xs text-emerald-400 font-medium">PINs coincidem!</p>
                                  </motion.div>
                                )}
                              </div>
                            </div>

                            {/* Error */}
                            {error && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                              >
                                <p className="text-sm text-red-400 text-center font-medium">{error}</p>
                              </motion.div>
                            )}

                            {/* Register Button */}
                            <button
                              onClick={handleRegister}
                              disabled={isLoading || !registerUsername || registerPin.length !== 3 || confirmPin.length !== 3 || registerPin !== confirmPin}
                              className={`w-full h-12 rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                                isLoading || !registerUsername || registerPin.length !== 3 || confirmPin.length !== 3 || registerPin !== confirmPin
                                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 active:scale-[0.98]'
                              }`}
                            >
                              {isLoading ? (
                                <div className="flex gap-1.5">
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                                </div>
                              ) : (
                                <>
                                  <UserPlus className="w-4.5 h-4.5" strokeWidth={2.5} />
                                  <span className="tracking-wide">Criar Conta</span>
                                </>
                              )}
                            </button>
                          </motion.div>
                        </AnimatePresence>
                      )}

                      {/* Connect ML Screen */}
                      {showConnectML && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="space-y-6 text-center"
                        >
                          <div className="space-y-3">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 border-2 border-emerald-500/30">
                              <CheckCircle className="w-10 h-10 text-emerald-400" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Conta Criada!</h3>
                            <p className="text-base text-gray-400">
                              Agora conecte sua conta do Mercado Livre para começar
                            </p>
                          </div>

                          <button
                            onClick={connectML}
                            className="w-full h-12 rounded-xl font-bold text-base bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
                          >
                            <ShoppingBag className="w-4.5 h-4.5" strokeWidth={2.5} />
                            <span className="tracking-wide">Conectar Mercado Livre</span>
                          </button>
                        </motion.div>
                      )}

                      {/* Security Badge */}
                      <div className="mt-6 flex items-center justify-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-gold/60" strokeWidth={2.5} />
                        <span className="text-xs text-gray-500 font-medium">
                          Criptografia AES-256-GCM
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Footer - Desktop */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="absolute bottom-0 left-0 right-0 py-6"
          >
            <div className="flex items-center justify-center">
              <span className="text-xs xl:text-sm text-gray-600 font-light text-center">
                Versão Brasileira 4.1/1911 Hebert Richards
              </span>
            </div>
          </motion.footer>
        </div>
      </div>
    </div>
  )
}

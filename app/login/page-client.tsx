"use client"

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Lock, User, UserPlus, ShoppingBag, CheckCircle, Sparkles, Users } from "lucide-react"
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
  const [pin, setPin] = useState(['', '', ''])
  const [error, setError] = useState('')
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  // Para registro
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerPin, setRegisterPin] = useState(['', '', ''])
  const [confirmPin, setConfirmPin] = useState(['', '', ''])
  const [showConnectML, setShowConnectML] = useState(false)
  const registerPinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const confirmPinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handlePinChange = (index: number, value: string, type: 'login' | 'register' | 'confirm') => {
    if (!/^[0-9]?$/.test(value)) return

    if (type === 'login') {
      const newPin = [...pin]
      newPin[index] = value
      setPin(newPin)
      setError('')

      // Auto-avança para o próximo campo
      if (value && index < 2) {
        pinRefs[index + 1]?.current?.focus()
      }

      // Se todos os campos estão preenchidos, faz login automaticamente
      if (index === 2 && value && newPin[0] && newPin[1]) {
        handleLogin(newPin.join(''))
      }
    } else if (type === 'register') {
      const newPin = [...registerPin]
      newPin[index] = value
      setRegisterPin(newPin)
      setError('')

      if (value && index < 2) {
        registerPinRefs[index + 1]?.current?.focus()
      }
    } else if (type === 'confirm') {
      const newPin = [...confirmPin]
      newPin[index] = value
      setConfirmPin(newPin)
      setError('')

      if (value && index < 2) {
        confirmPinRefs[index + 1]?.current?.focus()
      }
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, refs: React.RefObject<HTMLInputElement | null>[], pinState: string[]) => {
    if (e.key === 'Backspace' && !pinState[index] && index > 0) {
      refs[index - 1]?.current?.focus()
    }
  }

  const handleLogin = async (pinValue?: string) => {
    const finalPin = pinValue || pin.join('')

    if (!username.trim()) {
      setError('Digite o nome de usuário')
      return
    }

    if (finalPin.length !== 3) {
      setError('Digite o PIN completo')
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
        toast({
          title: 'Login realizado com sucesso',
          description: 'Bem-vindo ao ML Agent PRO'
        })
        router.push('/agente')
      } else {
        setError(data.error || 'Usuário ou PIN incorretos')
        setPin(['', '', ''])
        pinRefs[0]?.current?.focus()
      }
    } catch (_error) {
      setError('Erro ao fazer login. Tente novamente.')
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

    const regPin = registerPin.join('')
    const confPin = confirmPin.join('')

    if (regPin.length !== 3) {
      setError('Digite o PIN completo')
      return
    }

    if (regPin !== confPin) {
      setError('Os PINs não coincidem')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Primeiro registra a organização
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerUsername.trim().toUpperCase(),
          pin: regPin
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
    // Redireciona para OAuth do ML
    window.location.href = '/api/auth/login'
  }

  return (
    <div className="min-h-screen h-screen bg-black relative flex flex-col overflow-hidden" style={{ backgroundColor: '#000000', height: '100vh', minHeight: '100vh' }}>
      {/* Subtle background effects */}
      <div className="absolute inset-0 bg-black" style={{ backgroundColor: '#000000' }}>
        <div className="absolute top-1/4 -left-20 w-64 sm:w-96 h-64 sm:h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-64 sm:w-96 h-64 sm:h-96 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 flex-1 flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top, 16px)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          minHeight: '100dvh'
        }}
      >
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-12 items-center lg:items-center flex-1 py-2 sm:py-4">
          {/* Left side - Branding */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-col items-center lg:items-start space-y-1 sm:space-y-4 lg:space-y-4 mt-4 lg:mt-0 lg:pl-12 lg:relative lg:justify-center"
          >
            {/* Logo - Maior destaque no mobile e desktop */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative mb-1 sm:mb-0 lg:mb-2"
            >
              <Image
                src="/mlagent-logo-3d.svg"
                alt="ML Agent"
                width={320}
                height={320}
                className="h-40 xs:h-44 sm:h-32 lg:h-64 xl:h-72 w-auto object-contain mx-auto lg:mx-0"
                style={{
                  filter: 'drop-shadow(0 0 40px rgba(255, 230, 0, 0.25))'
                }}
              />
            </motion.div>

            {/* Title & Tagline */}
            <div className="space-y-1 sm:space-y-2 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <h1 className="text-3xl xs:text-4xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-white tracking-wide">
                  ML Agent
                </h1>
                <p className="text-sm xs:text-base sm:text-lg lg:text-xl text-gray-400 mt-1 sm:mt-1">
                  Plataforma Inteligente para Vendedores
                </p>
              </motion.div>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="space-y-2 pt-4 hidden lg:block"
              >
                {[
                  { icon: Sparkles, text: "IA Avançada para Respostas" },
                  { icon: Shield, text: "Criptografia AES-256-GCM" },
                  { icon: Users, text: "Gerenciamento de múltiplas contas" }
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                    className="flex items-center gap-3"
                  >
                    <div className="p-2 rounded-lg bg-gold/10 border border-gold/20">
                      <feature.icon className="w-4 h-4 text-gold" />
                    </div>
                    <span className="text-sm text-gray-300">{feature.text}</span>
                  </motion.div>
                ))}
              </motion.div>

            </div>
          </motion.div>

          {/* Right side - Login/Register Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex items-center justify-center lg:justify-end w-full mt-4 xs:mt-4 sm:mt-0">
            <div className="w-full max-w-md px-2 sm:px-0">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="relative"
              >
                {/* Card Container */}
                <div className="bg-zinc-900/95 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/[0.05] p-4 xs:p-5 sm:p-8 shadow-xl">
                  {/* Mode Toggle */}
                  <div className="flex rounded-xl bg-black/70 p-1 mb-4 sm:mb-6">
                    <button
                      onClick={() => {
                        setMode('login')
                        setError('')
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ${
                        mode === 'login'
                          ? 'bg-gradient-to-r from-gold to-gold-light text-black'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span className="text-sm font-semibold">Entrar</span>
                    </button>
                    <button
                      onClick={() => {
                        setMode('register')
                        setError('')
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ${
                        mode === 'register'
                          ? 'bg-gradient-to-r from-gold to-gold-light text-black'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="text-sm font-semibold">Registrar</span>
                    </button>
                  </div>

                  {/* Login Form */}
                  {mode === 'login' && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="login"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-3 xs:space-y-4 sm:space-y-5"
                      >
                        {/* Username Field */}
                        <div>
                          <label htmlFor="login-username" className="block text-sm sm:text-sm font-medium text-gray-400 mb-2 sm:mb-2">
                            Nome de Usuário
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
                            <input
                              id="login-username"
                              name="username"
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value.toUpperCase())}
                              className="w-full pl-10 sm:pl-10 pr-4 sm:pr-4 py-3 sm:py-3 bg-black/50 border border-white/10 rounded-lg sm:rounded-xl text-base sm:text-base text-white placeholder-gray-500 focus:border-gold/50 focus:outline-none transition-colors"
                              placeholder="Digite seu usuário"
                              autoComplete="username"
                            />
                          </div>
                        </div>

                        {/* PIN Field */}
                        <div>
                          <label htmlFor="login-pin-0" className="block text-sm sm:text-sm font-medium text-gray-400 mb-2 sm:mb-2">
                            PIN de Segurança
                          </label>
                          <div className="flex items-center justify-center gap-3 sm:gap-4">
                            {pin.map((digit, index) => (
                              <input
                                key={index}
                                id={`login-pin-${index}`}
                                name={`pin-${index}`}
                                ref={pinRefs[index]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handlePinChange(index, e.target.value, 'login')}
                                onKeyDown={(e) => handlePinKeyDown(index, e, pinRefs, pin)}
                                className="w-14 h-14 sm:w-16 sm:h-16 text-center text-2xl sm:text-3xl font-bold bg-black/50 border-2 border-white/10 rounded-xl sm:rounded-2xl text-gold focus:border-gold/50 focus:outline-none transition-all"
                                placeholder="●"
                                autoComplete="off"
                                aria-label={`PIN dígito ${index + 1}`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-2 sm:p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                          >
                            <p className="text-xs sm:text-sm text-red-400 text-center">{error}</p>
                          </motion.div>
                        )}

                        {/* Login Button */}
                        <motion.button
                          onClick={() => handleLogin()}
                          disabled={isLoading || !username || pin.join('').length !== 3}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            w-full group relative h-11 sm:h-12 px-3 sm:px-6 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base
                            transition-all duration-500 overflow-hidden
                            ${isLoading || !username || pin.join('').length !== 3
                              ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-2xl shadow-gold/30 hover:shadow-gold/40'
                            }
                            flex items-center justify-center gap-2
                          `}
                        >
                          {isLoading ? (
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                            </div>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              <span>Entrar com Segurança</span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    </AnimatePresence>
                  )}

                  {/* Register Form */}
                  {mode === 'register' && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="register"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-3 xs:space-y-4 sm:space-y-5"
                      >
                        {/* Username Field */}
                        <div>
                          <label htmlFor="register-username" className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5 sm:mb-2">
                            Escolha seu Nome de Usuário
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
                            <input
                              id="register-username"
                              name="register-username"
                              type="text"
                              value={registerUsername}
                              onChange={(e) => setRegisterUsername(e.target.value.toUpperCase())}
                              className="w-full pl-10 sm:pl-10 pr-4 sm:pr-4 py-3 sm:py-3 bg-black/50 border border-white/10 rounded-lg sm:rounded-xl text-base sm:text-base text-white placeholder-gray-500 focus:border-gold/50 focus:outline-none transition-colors"
                              placeholder="Escolha um nome único"
                              autoComplete="username"
                            />
                          </div>
                        </div>

                        {/* Create PIN */}
                        <div>
                          <label htmlFor="register-pin-0" className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5 sm:mb-2">
                            Crie seu PIN de 3 dígitos
                          </label>
                          <div className="flex items-center justify-center gap-3 sm:gap-4">
                            {registerPin.map((digit, index) => (
                              <input
                                key={index}
                                id={`register-pin-${index}`}
                                name={`register-pin-${index}`}
                                ref={registerPinRefs[index]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handlePinChange(index, e.target.value, 'register')}
                                onKeyDown={(e) => handlePinKeyDown(index, e, registerPinRefs, registerPin)}
                                className="w-14 h-14 sm:w-16 sm:h-16 text-center text-2xl sm:text-3xl font-bold bg-black/50 border-2 border-white/10 rounded-xl sm:rounded-2xl text-gold focus:border-gold/50 focus:outline-none transition-all"
                                placeholder="●"
                                autoComplete="off"
                                aria-label={`Criar PIN dígito ${index + 1}`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Confirm PIN */}
                        <div>
                          <label htmlFor="confirm-pin-0" className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5 sm:mb-2">
                            Confirme seu PIN
                          </label>
                          <div className="flex items-center justify-center gap-3 sm:gap-4">
                            {confirmPin.map((digit, index) => (
                              <input
                                key={index}
                                id={`confirm-pin-${index}`}
                                name={`confirm-pin-${index}`}
                                ref={confirmPinRefs[index]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handlePinChange(index, e.target.value, 'confirm')}
                                onKeyDown={(e) => handlePinKeyDown(index, e, confirmPinRefs, confirmPin)}
                                className="w-14 h-14 sm:w-16 sm:h-16 text-center text-2xl sm:text-3xl font-bold bg-black/50 border-2 border-white/10 rounded-xl sm:rounded-2xl text-gold focus:border-gold/50 focus:outline-none transition-all"
                                placeholder="●"
                                autoComplete="off"
                                aria-label={`Confirmar PIN dígito ${index + 1}`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-2 sm:p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                          >
                            <p className="text-xs sm:text-sm text-red-400 text-center">{error}</p>
                          </motion.div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          {!showConnectML ? (
                            /* Register Button */
                            <motion.button
                              onClick={handleRegister}
                              disabled={isLoading || !registerUsername || registerPin.join('').length !== 3 || confirmPin.join('').length !== 3}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`
                                w-full group relative h-11 sm:h-12 px-3 sm:px-6 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base
                                transition-all duration-500 overflow-hidden
                                ${isLoading || !registerUsername || registerPin.join('').length !== 3 || confirmPin.join('').length !== 3
                                  ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-2xl shadow-gold/30 hover:shadow-gold/40'
                                }
                                flex items-center justify-center gap-2
                              `}
                            >
                              {isLoading ? (
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                                </div>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  <span>Criar Organização</span>
                                </>
                              )}
                            </motion.button>
                          ) : (
                            /* Connect ML Button - Aparece após criar organização */
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3 }}
                              className="space-y-3"
                            >
                              <div className="text-center space-y-1.5">
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                                  className="flex items-center justify-center"
                                >
                                  <CheckCircle className="w-10 h-10 text-green-500" />
                                </motion.div>
                                <h3 className="text-base font-bold text-white">Organização Criada!</h3>
                                <p className="text-xs text-gray-400">
                                  Agora conecte sua conta do Mercado Livre para ativar o ML Agent
                                </p>
                              </div>
                              <motion.button
                                onClick={connectML}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full group relative h-11 px-3 sm:px-6 rounded-2xl font-bold text-xs sm:text-base
                                  transition-all duration-700 overflow-hidden flex items-center justify-center gap-3
                                  bg-gradient-to-r from-gold via-yellow-400 to-gold text-black
                                  shadow-2xl shadow-gold/50 hover:shadow-gold/60
                                  border border-gold/30 hover:border-gold/50"
                              >
                                {/* Premium glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-gold/20 via-transparent to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                {/* Animated shine effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                                {/* Content */}
                                <div className="relative flex items-center gap-3">
                                  <div className="relative">
                                    <ShoppingBag className="w-5 h-5" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  </div>
                                  <span className="font-extrabold text-base tracking-wide">
                                    Conectar com Mercado Livre
                                  </span>
                                  <span className="text-lg">→</span>
                                </div>
                              </motion.button>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}

                  {/* Security Badge */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="mt-4 sm:mt-6 flex items-center justify-center gap-2 sm:gap-2"
                  >
                    <Shield className="w-4 h-4 sm:w-4 sm:h-4 text-gold/50" />
                    <span className="text-xs sm:text-xs text-gray-500">
                      Criptografia AES-256-GCM
                    </span>
                  </motion.div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-px left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Footer - Visible on all devices */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-auto pt-2 text-center pb-safe flex-shrink-0"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <p className="text-[10px] sm:text-xs text-gray-600/50">
            © 2025 ML Agent • Versão 2.0.0
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
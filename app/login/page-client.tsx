"use client"

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Lock, User, UserPlus, ShoppingBag, CheckCircle, Sparkles, Users } from "lucide-react"
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

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
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin: finalPin })
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
          username: registerUsername.trim().toLowerCase(),
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
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-black via-gray-950 to-black relative overflow-hidden">
      {/* Subtle background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-20 w-64 sm:w-96 h-64 sm:h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-64 sm:w-96 h-64 sm:h-96 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8"
      >
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center min-h-[90vh]">
          {/* Left side - Branding */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-col items-center lg:items-start space-y-2 sm:space-y-4 lg:space-y-8"
          >
            {/* Logo - Maior destaque no mobile */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative mb-4 sm:mb-0"
            >
              <Image
                src="/mlagent-logo-3d.svg"
                alt="ML Agent"
                width={256}
                height={256}
                className="h-40 sm:h-32 lg:h-48 w-auto object-contain mx-auto lg:mx-0"
                style={{
                  filter: 'drop-shadow(0 0 40px rgba(255, 230, 0, 0.25))'
                }}
              />
            </motion.div>

            {/* Title & Tagline */}
            <div className="space-y-3 sm:space-y-4 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <h1 className="text-4xl sm:text-4xl lg:text-5xl font-light text-white tracking-wide">
                  ML Agent
                </h1>
                <p className="text-sm sm:text-lg text-gray-400 mt-1 sm:mt-2">
                  Plataforma Inteligente para Vendedores
                </p>
              </motion.div>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 hidden sm:block"
              >
                {[
                  { icon: Sparkles, text: "IA Avançada para Respostas" },
                  { icon: Shield, text: "Segurança com PIN de 3 dígitos" },
                  { icon: Users, text: "Até 10 contas ML no plano PRO" }
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
            className="flex items-center justify-center lg:justify-end w-full"
          >
            <div className="w-full max-w-md">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="relative"
              >
                {/* Card Container */}
                <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-lg rounded-xl sm:rounded-3xl border border-white/[0.03] p-5 sm:p-8 shadow-xl">
                  {/* Mode Toggle */}
                  <div className="flex rounded-xl bg-black/50 p-1 mb-6">
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
                        className="space-y-5"
                      >
                        {/* Username Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Nome de Usuário
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-gold/50 focus:outline-none transition-colors"
                              placeholder="Digite seu usuário"
                              autoComplete="username"
                            />
                          </div>
                        </div>

                        {/* PIN Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            PIN de Segurança
                          </label>
                          <div className="flex items-center justify-center gap-3">
                            {pin.map((digit, index) => (
                              <input
                                key={index}
                                ref={pinRefs[index]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handlePinChange(index, e.target.value, 'login')}
                                onKeyDown={(e) => handlePinKeyDown(index, e, pinRefs, pin)}
                                className="w-14 h-14 text-center text-2xl font-bold bg-black/50 border-2 border-white/10 rounded-xl text-gold focus:border-gold/50 focus:outline-none transition-all"
                                placeholder="•"
                              />
                            ))}
                          </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                          >
                            <p className="text-sm text-red-400 text-center">{error}</p>
                          </motion.div>
                        )}

                        {/* Login Button */}
                        <motion.button
                          onClick={() => handleLogin()}
                          disabled={isLoading || !username || pin.join('').length !== 3}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            w-full group relative h-11 sm:h-12 px-3 sm:px-6 rounded-xl font-bold text-sm sm:text-base
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
                        className="space-y-5"
                      >
                        {/* Username Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Escolha seu Nome de Usuário
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                              type="text"
                              value={registerUsername}
                              onChange={(e) => setRegisterUsername(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-gold/50 focus:outline-none transition-colors"
                              placeholder="Escolha um nome único"
                            />
                          </div>
                        </div>

                        {/* Create PIN */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Crie seu PIN de 3 dígitos
                          </label>
                          <div className="flex items-center justify-center gap-3">
                            {registerPin.map((digit, index) => (
                              <input
                                key={index}
                                ref={registerPinRefs[index]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handlePinChange(index, e.target.value, 'register')}
                                onKeyDown={(e) => handlePinKeyDown(index, e, registerPinRefs, registerPin)}
                                className="w-14 h-14 text-center text-2xl font-bold bg-black/50 border-2 border-white/10 rounded-xl text-gold focus:border-gold/50 focus:outline-none transition-all"
                                placeholder="•"
                              />
                            ))}
                          </div>
                        </div>

                        {/* Confirm PIN */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Confirme seu PIN
                          </label>
                          <div className="flex items-center justify-center gap-3">
                            {confirmPin.map((digit, index) => (
                              <input
                                key={index}
                                ref={confirmPinRefs[index]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handlePinChange(index, e.target.value, 'confirm')}
                                onKeyDown={(e) => handlePinKeyDown(index, e, confirmPinRefs, confirmPin)}
                                className="w-14 h-14 text-center text-2xl font-bold bg-black/50 border-2 border-white/10 rounded-xl text-gold focus:border-gold/50 focus:outline-none transition-all"
                                placeholder="•"
                              />
                            ))}
                          </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                          >
                            <p className="text-sm text-red-400 text-center">{error}</p>
                          </motion.div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3">
                          {!showConnectML ? (
                            /* Register Button */
                            <motion.button
                              onClick={handleRegister}
                              disabled={isLoading || !registerUsername || registerPin.join('').length !== 3 || confirmPin.join('').length !== 3}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`
                                w-full group relative h-11 sm:h-12 px-3 sm:px-6 rounded-xl font-bold text-sm sm:text-base
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
                              className="space-y-4"
                            >
                              <div className="text-center space-y-2">
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                                  className="flex items-center justify-center"
                                >
                                  <CheckCircle className="w-12 h-12 text-green-500" />
                                </motion.div>
                                <h3 className="text-lg font-bold text-white">Organização Criada!</h3>
                                <p className="text-sm text-gray-400">
                                  Agora conecte sua conta do Mercado Livre para ativar o ML Agent
                                </p>
                              </div>
                              <motion.button
                                onClick={connectML}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full group relative h-11 sm:h-12 px-3 sm:px-6 rounded-xl font-bold text-sm sm:text-base
                                  bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-black shadow-2xl shadow-yellow-500/30 hover:shadow-yellow-500/40
                                  transition-all duration-500 overflow-hidden flex items-center justify-center gap-2"
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span>Conectar Mercado Livre</span>
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
                    className="mt-4 sm:mt-6 flex items-center justify-center gap-1.5 sm:gap-2"
                  >
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold/50" />
                    <span className="text-[10px] sm:text-xs text-gray-500">
                      Proteção com PIN de 3 dígitos
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

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-6 sm:mt-12 lg:mt-16 text-center"
        >
          <p className="text-[10px] sm:text-xs text-gray-600">
            © 2025 ML Agent • Versão 2.0.0
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
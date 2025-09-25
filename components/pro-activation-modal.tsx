'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Shield, TrendingUp, Users, Clock, CheckCircle, ArrowRight } from 'lucide-react'
import Image from 'next/image'

interface ProActivationModalProps {
  isOpen: boolean
  onClose: () => void
  onActivate: () => void
}

export function ProActivationModal({ isOpen, onClose, onActivate }: ProActivationModalProps) {
  const [isActivating, setIsActivating] = useState(false)

  const handleActivate = async () => {
    setIsActivating(true)
    try {
      // Ativar plano PRO para a organização
      const response = await fetch('/api/agent/upgrade-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'PRO' })
      })

      if (response.ok) {
        onActivate()
        setTimeout(onClose, 2000) // Fecha após 2 segundos para mostrar sucesso
      }
    } catch (error) {
      console.error('Erro ao ativar PRO:', error)
    } finally {
      setIsActivating(false)
    }
  }

  const features = [
    { icon: Users, title: 'Até 10 Contas ML', description: 'Gerencie múltiplas lojas' },
    { icon: Clock, title: 'Respostas 24/7', description: 'Automação sem pausas' },
    { icon: TrendingUp, title: 'Análises Avançadas', description: 'Métricas detalhadas' },
    { icon: Shield, title: 'Suporte Prioritário', description: 'Atendimento premium' }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50 px-4"
          >
            <div className="relative bg-gradient-to-br from-gray-950 via-gray-900 to-black rounded-2xl shadow-2xl overflow-hidden">
              {/* Glow effect */}
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-gold/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              {/* Content */}
              <div className="relative p-6 sm:p-8">
                {/* Header */}
                <div className="text-center space-y-4 mb-8">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="inline-flex"
                  >
                    <div className="relative">
                      <Image
                        src="/mlagent-logo-3d.svg"
                        alt="ML Agent"
                        width={100}
                        height={100}
                        className="w-20 h-20 sm:w-24 sm:h-24"
                      />
                      <div className="absolute -inset-4 bg-gold/20 rounded-full blur-2xl animate-pulse" />
                    </div>
                  </motion.div>

                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                      Bem-vindo ao ML Agent!
                    </h2>
                    <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
                      Ative o plano PRO gratuitamente e desbloqueie todo o potencial da sua operação no Mercado Livre
                    </p>
                  </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
                  {features.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.1 }}
                      className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"
                    >
                      <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-gold mb-2" />
                      <h3 className="text-white font-semibold text-sm sm:text-base">{feature.title}</h3>
                      <p className="text-gray-500 text-xs sm:text-sm mt-1">{feature.description}</p>
                    </motion.div>
                  ))}
                </div>

                {/* PRO Badge */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center mb-6"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/20 to-purple-500/20 rounded-full border border-purple-500/30">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300 font-semibold text-sm">
                      1 ANO GRÁTIS - OFERTA LIMITADA
                    </span>
                  </div>
                </motion.div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    onClick={handleActivate}
                    disabled={isActivating}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      flex-1 group relative h-12 px-6 rounded-xl font-bold
                      transition-all duration-500 overflow-hidden
                      ${isActivating
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-2xl shadow-gold/30 hover:shadow-gold/40'
                      }
                      flex items-center justify-center gap-2
                    `}
                  >
                    {isActivating ? (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                        <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Ativar ML Agent PRO</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>

                  <button
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-6 h-12 rounded-xl font-semibold text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300 transition-all"
                  >
                    Continuar no Plano Básico
                  </button>
                </div>

                {/* Footer note */}
                <p className="text-center text-xs text-gray-600 mt-4">
                  Sem cartão de crédito • Sem compromisso • Cancele quando quiser
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
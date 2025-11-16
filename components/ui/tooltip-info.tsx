/**
 * Tooltip Info Component - ENTERPRISE EDITION
 * ✅ Renderização via React Portal (full-screen)
 * ✅ Design alinhado com AddAccountModal
 * ✅ Branding: Preto/Dourado/Amarelo
 * ✅ Responsivo e Acessível
 * October 2025 - Production Ready
 */

'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, Calculator, X, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TooltipInfoProps {
  title: string
  description: string
  calculation?: string
  example?: string
  whyItMatters?: string
}

export function TooltipInfo({ title, description, calculation, example, whyItMatters }: TooltipInfoProps) {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Garantir que está montado no cliente (hydration-safe)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Fechar com ESC e gerenciar scroll
  useEffect(() => {
    if (!show) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false)
    }

    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [show])

  // Não renderizar nada no servidor ou se não montado
  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gold transition-colors cursor-help"
        aria-label={`Info: ${title}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
    )
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gold transition-colors cursor-help"
        aria-label={`Info: ${title}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* Modal usando React Portal - Renderiza FORA do container */}
      {show && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShow(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.25 }}
              className="relative w-full max-w-2xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow Effect Externo */}
              <div className="absolute -inset-1 bg-gradient-to-r from-gold via-gold-light to-gold rounded-3xl blur-xl opacity-30" />

              <div className="relative bg-gradient-to-br from-black via-gray-900 to-black border-2 border-gold/60 rounded-3xl shadow-2xl shadow-gold/50 overflow-hidden">
                {/* Header com gradiente dourado */}
                <div className="bg-gradient-to-r from-gold via-gold-light to-gold p-4 sm:p-5 relative overflow-hidden">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0, 0, 0, 0.15) 1px, transparent 0)',
                      backgroundSize: '24px 24px'
                    }} />
                  </div>

                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 sm:p-2.5 bg-black/40 rounded-xl backdrop-blur-sm">
                        <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-gold-light" />
                      </div>
                      <div>
                        <h4 className="text-base sm:text-lg font-black text-black tracking-tight">
                          {title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Sparkles className="w-3 h-3 text-black/70" />
                          <span className="text-xs font-bold text-black/70">Inteligência Full</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShow(false)}
                      className="p-2 bg-black/40 hover:bg-black/60 rounded-xl transition-colors backdrop-blur-sm"
                      aria-label="Fechar"
                    >
                      <X className="w-5 h-5 text-black" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto custom-scrollbar">
                  {/* Descrição Principal */}
                  <div className="p-4 sm:p-5 bg-gradient-to-br from-gray-800 to-gray-900 border border-gold/20 rounded-2xl shadow-lg">
                    <p className="text-sm sm:text-base text-gray-200 leading-relaxed">
                      {description}
                    </p>
                  </div>

                  {/* Por que importa */}
                  {whyItMatters && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="p-4 sm:p-5 bg-gradient-to-r from-gold/10 to-gold-light/10 border-l-4 border-gold rounded-2xl shadow-lg"
                    >
                      <p className="text-sm leading-relaxed">
                        <span className="font-black text-gold flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4" />
                          POR QUE IMPORTA
                        </span>
                        <span className="text-gray-200">{whyItMatters}</span>
                      </p>
                    </motion.div>
                  )}

                  {/* Cálculo */}
                  {calculation && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="p-4 bg-black/60 border border-gold/30 rounded-xl"
                    >
                      <p className="text-xs text-gold mb-2 font-black flex items-center gap-1.5 uppercase tracking-wide">
                        <Calculator className="w-3.5 h-3.5" />
                        Fórmula de Cálculo
                      </p>
                      <p className="text-sm font-mono text-gold-light leading-relaxed bg-black/40 p-3 rounded-lg border border-gold/20">
                        {calculation}
                      </p>
                    </motion.div>
                  )}

                  {/* Exemplo prático */}
                  {example && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="p-4 bg-gradient-to-r from-gray-800 to-gray-900 border border-gold/20 rounded-xl"
                    >
                      <p className="text-xs text-gold mb-2 font-black uppercase tracking-wide">
                        Exemplo Prático
                      </p>
                      <p className="text-sm text-gray-200 leading-relaxed">
                        {example}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-900 to-black border-t border-gold/20">
                  <button
                    onClick={() => setShow(false)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-gold via-gold-light to-gold text-black rounded-xl text-sm font-black hover:shadow-2xl hover:shadow-gold/50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Entendi
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #ffd700, #fcd34d);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #fcd34d, #fde047);
        }
      `}</style>
    </>
  )
}

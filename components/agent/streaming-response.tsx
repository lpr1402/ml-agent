/**
 * StreamingResponse - Premium Typewriter Effect
 *
 * Experiência de streaming refinada com efeito de digitação natural.
 * O texto aparece caractere por caractere como se estivesse sendo digitado.
 *
 * FLUXO:
 * 1. Skeleton loader sutil durante "pensando"
 * 2. Texto aparece com efeito typewriter suave
 * 3. Cursor gold pulsa durante digitação
 * 4. Container cresce suavemente sem distorção
 *
 * @author ML Agent Team
 * @date 2025-11-25
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'

interface StreamingResponseProps {
  isStreaming: boolean
  fullResponse: string
  isDone: boolean
  error: string | null
  /** Indica se está no modo de apagar texto (erasing) */
  isErasing?: boolean
}

// Configurações do efeito typewriter
const TYPEWRITER_CONFIG = {
  // Velocidade base: caracteres por segundo (ajustável)
  BASE_CHARS_PER_SECOND: 60, // ~60 chars/s = sensação de digitação humana rápida
  // Variação aleatória para parecer mais natural (em ms)
  MIN_DELAY: 8,
  MAX_DELAY: 25,
  // Pausa extra após pontuação
  PUNCTUATION_PAUSE: 50,
  // Batch size para performance (quantos chars adicionar por vez quando atrasado)
  CATCH_UP_BATCH: 5,
}

export function StreamingResponse({
  isStreaming,
  fullResponse,
  isDone,
  error,
  isErasing = false,
}: StreamingResponseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showThinking, setShowThinking] = useState(true)

  // 🎯 NOVO: Estado local para efeito typewriter
  const [displayedText, setDisplayedText] = useState('')
  const typewriterRef = useRef<NodeJS.Timeout | null>(null)
  const lastFullResponseRef = useRef('')

  // Reset estado quando novo streaming começar
  useEffect(() => {
    if (isStreaming && fullResponse.length === 0) {
      setShowThinking(true)
      setDisplayedText('')
      lastFullResponseRef.current = ''
    }
  }, [isStreaming, fullResponse.length])

  // Transição suave: pensando → tokens
  useEffect(() => {
    if (fullResponse && fullResponse.length > 0) {
      setShowThinking(false)
    }

    if (!isStreaming && (!fullResponse || fullResponse.length === 0) && !isErasing) {
      setShowThinking(true)
    }
  }, [fullResponse, isStreaming, isErasing])

  // 🎬 EFEITO TYPEWRITER: Adiciona caracteres gradualmente
  const typeNextChar = useCallback(() => {
    setDisplayedText(prev => {
      const targetText = lastFullResponseRef.current

      // Se já exibimos tudo, parar
      if (prev.length >= targetText.length) {
        return prev
      }

      // Calcular quantos chars estamos atrasados
      const behind = targetText.length - prev.length

      // Se muito atrasado, fazer catch-up mais rápido
      if (behind > 50) {
        // Modo catch-up: adicionar batch de chars
        const charsToAdd = Math.min(TYPEWRITER_CONFIG.CATCH_UP_BATCH, behind)
        return targetText.substring(0, prev.length + charsToAdd)
      }

      // Modo normal: adicionar 1 char por vez
      return targetText.substring(0, prev.length + 1)
    })
  }, [])

  // 🔄 Loop do typewriter
  useEffect(() => {
    // Atualizar referência do texto alvo
    lastFullResponseRef.current = fullResponse

    // Se não há texto ou já terminamos, limpar interval
    if (!fullResponse || displayedText.length >= fullResponse.length) {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current)
        typewriterRef.current = null
      }

      // Se streaming terminou, garantir que todo texto está exibido
      if (isDone && fullResponse && displayedText !== fullResponse) {
        setDisplayedText(fullResponse)
      }
      return
    }

    // Calcular delay base com variação natural
    let delay = TYPEWRITER_CONFIG.MIN_DELAY +
                Math.random() * (TYPEWRITER_CONFIG.MAX_DELAY - TYPEWRITER_CONFIG.MIN_DELAY)

    // Pausa extra após pontuação para parecer mais natural
    if (displayedText.length > 0) {
      const lastChar = displayedText.charAt(displayedText.length - 1)
      if (['.', '!', '?', '\n'].includes(lastChar)) {
        delay += TYPEWRITER_CONFIG.PUNCTUATION_PAUSE
      } else if ([',', ';', ':'].includes(lastChar)) {
        delay += TYPEWRITER_CONFIG.PUNCTUATION_PAUSE / 2
      }
    }

    // Se estamos atrasados, acelerar
    const behind = fullResponse.length - displayedText.length
    if (behind > 20) {
      delay = Math.max(2, delay / 3)
    }

    typewriterRef.current = setTimeout(typeNextChar, delay)

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current)
      }
    }
  }, [fullResponse, displayedText, isDone, typeNextChar])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current)
      }
    }
  }, [])

  // Auto-scroll suave durante streaming
  useEffect(() => {
    if ((isStreaming || displayedText.length < fullResponse.length) && containerRef.current) {
      const element = containerRef.current
      const isMobile = window.innerWidth < 640
      const scrollThreshold = isMobile ? 150 : 100
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight

      if (distanceFromBottom < scrollThreshold) {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }, [displayedText, isStreaming, fullResponse.length])

  // Determinar se ainda está "digitando" (tem texto para exibir)
  const isTyping = displayedText.length < fullResponse.length || isStreaming

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isErasing ? 'erasing' : showThinking ? 'thinking' : 'response'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        ref={containerRef}
        className="relative"
      >
        {/* Estado: Pensando - Skeleton Loader Premium */}
        {showThinking && !fullResponse && !error && !isErasing && (
          <div className="space-y-3 py-2">
            {[95, 100, 80, 60].map((width, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15, duration: 0.3 }}
                className="h-3.5 sm:h-4 rounded-md bg-white/[0.03] overflow-hidden"
                style={{ width: `${width}%` }}
              >
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: i * 0.2
                  }}
                  className="h-full w-1/3 bg-gradient-to-r from-transparent via-gold/10 to-transparent"
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Estado: Apagando (preparando revisão) - Agora com skeleton loader */}
        {isErasing && (
          <div className="space-y-3 py-2">
            {[90, 100, 70].map((width, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.1
                }}
                className="h-3.5 sm:h-4 rounded-md bg-gold/5 overflow-hidden"
                style={{ width: `${width}%` }}
              >
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: i * 0.15
                  }}
                  className="h-full w-1/2 bg-gradient-to-r from-transparent via-gold/15 to-transparent"
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Texto da resposta - Typewriter Effect Premium */}
        {!showThinking && (fullResponse || displayedText) && !isErasing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            // Layout animation para crescer suavemente
            layout="position"
            className="relative"
          >
            <p className="text-sm sm:text-base leading-relaxed text-gray-200 whitespace-pre-wrap">
              {displayedText}

              {/* Cursor de digitação premium - só aparece enquanto digita */}
              {isTyping && (
                <motion.span
                  className="inline-block w-[2px] h-[1.1em] ml-0.5 bg-gold rounded-sm align-middle"
                  animate={{
                    opacity: [1, 0.2, 1],
                    scaleY: [1, 0.8, 1]
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              )}
            </p>
          </motion.div>
        )}

        {/* Erro - Compacto */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 py-2 text-red-400"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

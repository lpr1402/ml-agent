'use client'

/**
 * 🎯 PREMIUM LOADER - Enterprise Loading Screen
 *
 * Página de carregamento premium com:
 * - Logo ML Agent PRO completa
 * - Animações suaves e modernas
 * - Mobile-first responsive (320px → 4K)
 * - Progress bar com shimmer effect
 * - Branding AxnexLabs
 *
 * @author ML Agent Team
 * @date 2025-11-23
 */

import Image from 'next/image'
import { useEffect, useState } from 'react'

interface PremiumLoaderProps {
  isPro?: boolean // Deprecated - sempre mostra PRO agora
}

export function PremiumLoader(_props: PremiumLoaderProps) {
  const [progress, setProgress] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Smooth progress animation - More realistic
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        // Faster start, slower end
        const increment = prev < 30 ? Math.random() * 20 + 10 :
                         prev < 70 ? Math.random() * 10 + 5 :
                         Math.random() * 5 + 2
        return Math.min(prev + increment, 100)
      })
    }, 150)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen min-h-[100dvh] relative overflow-hidden bg-black">
      {/* Subtle gradient background - Premium dark */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950/50 to-black" />

      {/* Ambient glow effect - Dourado sutil */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[500px] md:w-[600px] h-[400px] sm:h-[500px] md:h-[600px] bg-gold/5 rounded-full blur-[100px] sm:blur-[120px] animate-pulse"
             style={{ animationDuration: '4s' }} />
      </div>

      {/* Noise texture - Metallic grain (matching main app) */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      />

      {/* Main content */}
      <div className="relative z-10 min-h-screen min-h-[100dvh] flex items-center justify-center px-4 sm:px-6"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className={`flex flex-col items-center gap-8 xs:gap-10 sm:gap-12 md:gap-14 lg:gap-16 w-full max-w-2xl transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

          {/* Logo 3D ML Agent - Icon with Premium Animation */}
          <div className="relative group animate-in fade-in zoom-in-95 duration-700" style={{ animationDelay: '100ms' }}>
            {/* Glow ring animation - Mais sutil */}
            <div className="absolute inset-0 -m-6 sm:-m-8 md:-m-10 rounded-full bg-gradient-to-br from-gold/20 via-gold-light/10 to-transparent opacity-50 blur-2xl transition-all duration-1000 animate-pulse"
                 style={{ animationDuration: '4s' }} />

            {/* Logo 3D container */}
            <div className="relative">
              <Image
                src="/mlagent-logo-3d.png"
                alt="ML Agent"
                width={200}
                height={200}
                className="h-20 xs:h-24 sm:h-28 md:h-32 lg:h-36 xl:h-40 w-auto object-contain relative z-10 transition-transform duration-700 group-hover:scale-105"
                style={{
                  filter: 'drop-shadow(0 0 40px rgba(212, 175, 55, 0.3))'
                }}
                priority
                loading="eager"
                quality={100}
              />
            </div>
          </div>

          {/* Logo ML Agent PRO - Texto completo */}
          <div className="flex flex-col items-center gap-2 xs:gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-center px-4">
              <Image
                src="/mlagent-pro-logo.png"
                alt="ML Agent PRO"
                width={1024}
                height={230}
                className="h-9 xs:h-11 sm:h-13 md:h-15 lg:h-17 xl:h-20 w-auto object-contain"
                style={{
                  filter: 'drop-shadow(0 0 25px rgba(212, 175, 55, 0.4))',
                  maxWidth: 'min(90vw, 400px)'
                }}
                priority
                loading="eager"
                quality={100}
              />
            </div>

            {/* Subtitle - Enterprise */}
            <p className="text-[10px] xs:text-xs sm:text-sm font-light text-gray-500 tracking-[0.3em] uppercase opacity-70">
              Enterprise Edition
            </p>
          </div>

          {/* Progress bar - Premium & Responsive */}
          <div className="w-full max-w-[280px] xs:max-w-xs sm:max-w-sm md:max-w-md space-y-3 xs:space-y-4 px-4 animate-in fade-in slide-in-from-bottom-2 duration-700" style={{ animationDelay: '500ms' }}>
            {/* Progress track - Mobile First */}
            <div className="relative h-[2px] sm:h-[2.5px] md:h-[3px] w-full bg-white/5 overflow-hidden rounded-full">
              {/* Progress fill with gradient */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/60 via-gold to-gold-light transition-all duration-300 ease-out rounded-full will-change-[width]"
                style={{ width: `${progress}%` }}
              >
                {/* Shine effect - GPU accelerated */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer will-change-transform" />
              </div>

              {/* Glow effect on progress - Performance optimized */}
              <div
                className="absolute inset-y-0 left-0 h-full bg-gold blur-[6px] opacity-60 transition-all duration-300 ease-out will-change-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Loading text - Mobile optimized */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs xs:text-sm sm:text-base font-light text-gray-400 tracking-wider">
                {progress < 100 ? 'Carregando' : 'Quase lá'}
              </span>
              {progress < 100 && (
                <div className="flex gap-1">
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gold/70 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gold/70 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gold/70 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
                </div>
              )}
            </div>

            {/* Progress percentage - Premium */}
            <div className="text-center">
              <span className="text-[10px] xs:text-xs sm:text-sm font-mono text-gold/60 tracking-wider">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Powered by AxnexLabs - Premium Branding */}
          <div className="absolute bottom-6 xs:bottom-8 sm:bottom-10 md:bottom-12 lg:bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-in fade-in duration-1000" style={{ animationDelay: '800ms', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <p className="text-[9px] xs:text-[10px] sm:text-xs font-light text-gray-500 tracking-[0.2em] uppercase">
              Uma criação
            </p>
            <Image
              src="/axnexlabs-logo.png"
              alt="AxnexLabs"
              width={1024}
              height={450}
              className="h-6 xs:h-7 sm:h-8 md:h-9 lg:h-10 w-auto object-contain opacity-60 hover:opacity-90 transition-all duration-500"
              style={{
                filter: 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.08))',
                maxWidth: 'min(60vw, 200px)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Add shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}

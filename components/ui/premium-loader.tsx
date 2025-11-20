'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

interface PremiumLoaderProps {
  isPro?: boolean
}

export function PremiumLoader({ isPro = false }: PremiumLoaderProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Smooth progress animation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        const increment = Math.random() * 15 + 5
        return Math.min(prev + increment, 100)
      })
    }, 150)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950/50 to-black" />

      {/* Ambient glow effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px] animate-pulse"
             style={{ animationDuration: '4s' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-12 sm:gap-16">

          {/* Logo with premium glow */}
          <div className="relative group">
            {/* Glow ring animation */}
            <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-gold/20 via-gold-light/10 to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-1000 animate-pulse"
                 style={{ animationDuration: '3s' }} />

            {/* Logo container */}
            <div className="relative">
              <Image
                src="/mlagent-logo-3d.svg"
                alt="ML Agent"
                width={120}
                height={120}
                className="h-24 sm:h-28 lg:h-32 w-auto object-contain relative z-10 transition-transform duration-700 group-hover:scale-105"
                style={{
                  filter: 'drop-shadow(0 0 30px rgba(212, 175, 55, 0.2))'
                }}
                priority
              />
            </div>
          </div>

          {/* Title - Matching login page style */}
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className="flex items-baseline gap-2.5 sm:gap-3 pr-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-wide leading-none">
                ML Agent
              </h1>
              {isPro && (
                <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold italic bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent tracking-wider pr-1 leading-none">
                  PRO
                </span>
              )}
            </div>

            {/* Subtitle */}
            <p className="text-[10px] sm:text-xs font-light text-gray-500 tracking-wider">
              Enterprise Edition
            </p>
          </div>

          {/* Progress bar - Minimal and sophisticated */}
          <div className="w-full max-w-xs sm:max-w-sm space-y-4">
            {/* Progress track */}
            <div className="relative h-[1px] w-full bg-white/5 overflow-hidden rounded-full">
              {/* Progress fill with gradient */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/50 via-gold to-gold-light transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>

              {/* Glow effect on progress */}
              <div
                className="absolute inset-y-0 left-0 h-full bg-gold blur-sm opacity-50 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Loading text */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs sm:text-sm font-light text-gray-400 tracking-wider">
                Loading
              </span>
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                <span className="w-1 h-1 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
                <span className="w-1 h-1 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
              </div>
            </div>
          </div>

          {/* Powered by - Ultra subtle */}
          <div className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2">
            <p className="text-[9px] sm:text-[10px] font-extralight text-gray-600 tracking-[0.25em] uppercase">
              Powered by AxnexLabs
            </p>
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

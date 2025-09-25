'use client'

import Image from 'next/image'

interface PremiumLoaderProps {
  isPro?: boolean
}

export function PremiumLoader({ isPro = false }: PremiumLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-950 to-black">
      <div className="flex flex-col items-center gap-8">
        {/* Logo - Same as header */}
        <Image
          src="/mlagent-logo-3d.svg"
          alt="ML Agent"
          width={96}
          height={96}
          className="h-24 w-auto object-contain"
          style={{
            filter: 'drop-shadow(0 0 25px rgba(255, 230, 0, 0.15))'
          }}
        />

        {/* Title */}
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-light text-white tracking-wide">
            ML Agent
          </h1>
          {isPro && (
            <span className="text-3xl font-bold italic bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent tracking-wider pr-2">
              PRO
            </span>
          )}
        </div>

        {/* Loading Indicator - Tab-like style */}
        <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          {/* Simple loading dots */}
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-gold/70 rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-gold/70 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gold/70 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-gray-400 font-medium">
            Carregando
          </span>
        </div>
      </div>
    </div>
  )
}

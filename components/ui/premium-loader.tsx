import React from "react"

interface PremiumLoaderProps {
  text?: string
  size?: "sm" | "md" | "lg"
  fullScreen?: boolean
}

export function PremiumLoader({ 
  text = "Carregando", 
  size = "md",
  fullScreen = false 
}: PremiumLoaderProps) {
  const sizeMap = {
    sm: 40,
    md: 60,
    lg: 80
  }

  const content = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 0'
    }}>
      {/* Logo sem fundo */}
      <div style={{
        width: `${sizeMap[size]}px`,
        height: `${sizeMap[size]}px`,
        position: 'relative',
        marginBottom: '24px'
      }}>
        <img 
          src="/mlagent-logo-3d.png" 
          alt="ML Agent" 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
        {/* Loading Ring minimalista */}
        <div style={{
          position: 'absolute',
          inset: '-8px',
          borderRadius: '50%',
          border: '1px solid rgba(255, 230, 0, 0.1)',
          borderTopColor: '#FFE600'
        }} className="animate-spin"></div>
      </div>
      
      {/* Texto simples */}
      {text && (
        <p style={{
          fontSize: '12px',
          fontWeight: '300',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#666666',
          textAlign: 'center'
        }}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    // Para carregamento de dados - não bloqueia a página toda, só a área de conteúdo
    return (
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0A'
      }}>
        {content}
      </div>
    )
  }

  return content
}

// Mini loader for inline use
export function MiniLoader({ className = "" }: { className?: string }) {
  return (
    <svg 
      className={`animate-spin h-4 w-4 text-[#FFE600] ${className}`}
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
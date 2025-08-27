"use client"

import "./login-override.css"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Shield, Globe } from "lucide-react"

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = "/api/auth/login"
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 50%, #0A0A0A 100%)'}}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-7xl"
      >
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left side - Logo & Tagline */}
          <div className="flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="relative flex flex-col items-center -mt-16"
            >
              {/* Logo with radial light */}
              <div className="relative z-10 mb-2">
                {/* Radial light from center */}
                <div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle at center, rgba(255, 230, 0, 0.08) 0%, rgba(255, 230, 0, 0.04) 25%, rgba(255, 230, 0, 0.02) 50%, transparent 70%)',
                    filter: 'blur(40px)',
                    pointerEvents: 'none'
                  }}
                />
                
                <img 
                  src="/mlagent-logo-3d.png" 
                  alt="ML Agent" 
                  className="h-40 w-auto lg:h-80 object-contain relative"
                  style={{
                    filter: 'drop-shadow(0 0 20px rgba(255, 230, 0, 0.2))',
                  }}
                />
              </div>
              
              {/* Tagline - Closer to logo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center relative z-10 max-w-md -mt-4"
              >
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '300',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#999999',
                  marginBottom: '12px'
                }}>
                  Gerencie sua conta do <span style={{color: '#FFE600', fontWeight: '700'}}>Mercado Livre</span>
                </h2>
                <p style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#666666'
                }}>
                  com inteligência e eficiência
                </p>
              </motion.div>
            </motion.div>
          </div>

          {/* Right side - Login Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <Card className="w-full max-w-md" style={{
              background: 'linear-gradient(135deg, #111111 0%, #0A0A0A 100%)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(255, 230, 0, 0.1)'
            }}>
              <CardHeader className="pb-6 pt-10">
                <div className="text-center">
                  <h1 style={{
                    fontSize: '24px',
                    fontWeight: '300',
                    letterSpacing: '0.3em',
                    color: '#FFE600',
                    textTransform: 'uppercase',
                    marginBottom: '2px'
                  }}>ML AGENT</h1>
                  <p style={{
                    fontSize: '12px',
                    fontWeight: '200',
                    letterSpacing: '0.2em',
                    color: '#999999',
                    textTransform: 'uppercase'
                  }}>Platform</p>
                </div>
                <p className="text-center pt-3" style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#666666'
                }}>
                  Faça login com sua conta do Mercado Livre
                </p>
              </CardHeader>
              <CardContent className="pb-8 px-8">
                <Button
                  onClick={handleLogin}
                  className="w-full"
                  style={{
                    background: 'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)',
                    color: '#0A0A0A',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 32px',
                    fontWeight: '500',
                    fontSize: '14px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 230, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Entrar
                </Button>
                
                <div className="flex items-center justify-center gap-6 mt-6">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" style={{color: '#FFE600'}}/>
                    <span style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#666666'
                    }}>OAuth 2.0</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" style={{color: '#FFE600'}}/>
                    <span style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#666666'
                    }}>IA Integrada</span>
                  </div>
                </div>
                
                <p className="text-center mt-6" style={{
                  fontSize: '9px',
                  letterSpacing: '0.02em',
                  color: '#444444',
                  lineHeight: '1.4'
                }}>
                  Ao fazer login, você concorda com os termos de uso e política de privacidade
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
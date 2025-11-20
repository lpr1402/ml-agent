'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  Sparkles,
  Zap,
  MessageSquare,
  Bot,
  TrendingUp,
  Shield,
  Workflow,
  Brain,
  Users,
  Target,
  Rocket,
  Smartphone,
  Bell,
  Trophy,
  Sliders,
  Calendar,
  RefreshCw,
  Eye,
  Star
} from 'lucide-react'

export function PlatformInfo() {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Premium com Logos - SEMPRE HORIZONTAL */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gold/10 via-gold/5 to-transparent border border-gold/20 p-4 sm:p-6 lg:p-7 overflow-hidden"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.1),transparent_50%)]" />

        <div className="relative z-10">
          {/* Logos Row - SEMPRE HORIZONTAL mesmo no mobile */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 lg:gap-6 mb-4 sm:mb-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Image
                src="/mlagent-logo-3d.svg"
                alt="ML Agent"
                width={140}
                height={140}
                className="h-14 sm:h-20 lg:h-28 w-auto object-contain"
                style={{ filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.4))' }}
                priority
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 200 }}
              className="relative flex items-center justify-center flex-shrink-0"
            >
              <div className="absolute inset-0 bg-gold/30 blur-md scale-150" />
              <div className="relative font-extrabold text-xl sm:text-2xl lg:text-3xl leading-none" style={{
                transform: 'rotate(-10deg)',
                fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
                textShadow: '0 2px 10px rgba(212,175,55,0.5)',
                background: 'linear-gradient(135deg, #f4d03f 0%, #d4af37 50%, #c9a961 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.05em'
              }}>
                ×
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Image
                src="/gugaleo-logo.png"
                alt="Gugaleo"
                width={140}
                height={140}
                className="h-12 sm:h-18 lg:h-24 w-auto object-contain"
                style={{ filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))' }}
                priority
              />
            </motion.div>
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1.5">
              Sobre a Plataforma
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto">
              Seu assistente de IA que responde clientes no Mercado Livre automaticamente
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Como Funciona + Recursos - Container Consolidado */}
      <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] overflow-hidden">
        <div className="relative z-10">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20 flex-shrink-0">
                <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-black" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white">Como Funciona</h3>
                <p className="text-xs text-gray-400 mt-0.5">Entenda como o ML Agent te ajuda</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 space-y-5 sm:space-y-6">
            {/* Funcionamento - Grid Compacto SEM bordas extras */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {[
                { num: '1', title: 'Conecta Automático', desc: 'Liga na sua conta ML e recebe todas as perguntas dos clientes' },
                { num: '2', title: 'Analisa Rápido', desc: 'IA lê a pergunta, produto e estoque em menos de 3 segundos' },
                { num: '3', title: 'Responde Profissional', desc: 'Cria resposta clara em português e envia (ou pede sua aprovação)' },
                { num: '4', title: 'Você Controla Tudo', desc: 'Acompanha métricas e aprova respostas quando quiser' }
              ].map((step) => (
                <div key={step.num} className="flex gap-2.5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] rounded-lg p-2.5 sm:p-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-gold">{step.num}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs sm:text-sm font-bold text-white mb-0.5">{step.title}</h5>
                    <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Recursos Atuais - 2 colunas mobile, 3 desktop */}
            <div>
              <h4 className="text-sm sm:text-base font-bold text-gold mb-3 sm:mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={2.5} />
                O que você tem agora
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {[
                  { icon: MessageSquare, title: 'Resposta em 3s', desc: 'Super rápido e inteligente' },
                  { icon: Users, title: 'Até 10 Contas', desc: 'Gerencia tudo junto (PRO)' },
                  { icon: Bot, title: 'IA Avançada', desc: 'Entende produto e estoque' },
                  { icon: TrendingUp, title: 'Métricas Detalhadas', desc: 'Vê tudo que acontece' },
                  { icon: Shield, title: 'Você Aprova', desc: 'Controle antes de enviar' },
                  { icon: Workflow, title: 'Integração N8N', desc: 'Automações personalizadas' }
                ].map((feature, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] rounded-lg p-2.5 sm:p-3 hover:border-gold/20 transition-all duration-300 group">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <feature.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs sm:text-sm font-bold text-white mb-0.5 leading-tight">{feature.title}</h5>
                        <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 VEM POR AÍ - VERSÃO 5.0 COMPLETA */}
      <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gold/[0.06] via-gold/[0.03] to-transparent border border-gold/20 overflow-hidden">
        {/* Glow Effects Premium */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-50" />
        <div className="absolute top-0 right-0 w-40 h-40 sm:w-56 sm:h-56 bg-gold/10 blur-3xl rounded-full" />

        <div className="relative z-10">
          {/* Header Premium */}
          <div className="p-4 sm:p-5 lg:p-6 border-b border-gold/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/30 flex-shrink-0">
                  <Rocket className="w-5 h-5 sm:w-5.5 sm:h-5.5 lg:w-6 lg:h-6 text-black" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold tracking-tight">Vem por aí</h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Evolução Completa - Versão 5.0</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gold/20 border border-gold/30 w-fit">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gold" strokeWidth={2.5} />
                <span className="text-xs sm:text-sm font-bold text-gold">v5.0</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
            {/* 🌟 DESTAQUE PREMIUM - Agente Autônomo (Hero Card) */}
            <div className="relative bg-gradient-to-br from-gold/[0.1] to-gold/[0.03] border-2 border-gold/25 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-7 overflow-hidden group hover:border-gold/35 transition-all duration-300 shadow-xl shadow-gold/10">
              {/* Badge "Próxima Geração" */}
              <div className="absolute top-0 right-0">
                <div className="bg-gradient-to-br from-gold to-gold-light text-black text-[9px] sm:text-[10px] font-bold px-2.5 py-1 rounded-bl-xl rounded-tr-xl sm:rounded-tr-2xl flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} />
                  PRÓXIMA GERAÇÃO
                </div>
              </div>

              {/* Premium glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.05] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 pt-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 sm:gap-5 lg:gap-7">
                  {/* Ícone Grande */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-xl shadow-gold/25 flex-shrink-0">
                    <Bot className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-black" strokeWidth={2.5} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 space-y-3 sm:space-y-4">
                    {/* Título */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="text-base sm:text-lg lg:text-2xl font-bold text-gold tracking-tight">
                          Agente Totalmente Autônomo
                        </h4>
                        <div className="px-2 py-0.5 rounded-md bg-gold/25 border border-gold/40">
                          <span className="text-[9px] sm:text-[10px] font-bold text-gold uppercase tracking-wider">
                            Premium
                          </span>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm lg:text-base text-gray-200 font-medium">
                        Assistente de vendas com IA que pensa, aprende e age como humano
                      </p>
                    </div>

                    {/* Descrição Rica */}
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                      Powered by <span className="text-gold font-bold">LangChain 1.0</span> e <span className="text-gold font-bold">Google Gemini 3.0 Pro</span>,
                      utiliza as arquiteturas mais avançadas de sistemas agnéticos de Nov/Dez 2025.
                      Opera autonomamente em todas as contas, com aprendizado contínuo, memória de longo prazo e tomada de decisão inteligente.
                    </p>

                    {/* Tech Stack Pills */}
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-black/50 border border-gold/25 rounded-lg text-[10px] sm:text-xs text-gold font-semibold backdrop-blur-sm">
                        <Brain className="w-3 h-3" strokeWidth={2.5} />
                        LangChain 1.0
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-black/50 border border-gold/25 rounded-lg text-[10px] sm:text-xs text-gold font-semibold backdrop-blur-sm">
                        <Zap className="w-3 h-3" strokeWidth={2.5} />
                        Gemini 3.0 Pro
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-black/50 border border-gold/25 rounded-lg text-[10px] sm:text-xs text-gold font-semibold backdrop-blur-sm">
                        <Brain className="w-3 h-3" strokeWidth={2.5} />
                        Memória Longo Prazo
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-black/50 border border-gold/25 rounded-lg text-[10px] sm:text-xs text-gold font-semibold backdrop-blur-sm">
                        <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
                        Decisão Autônoma
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider Sutil */}
            <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

            {/* Grid de Novas Features - Mobile: 1 col | Tablet: 2 cols | Desktop: 3 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Notificações iOS */}
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-blue-500/30 hover:from-blue-500/12 transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-blue-500/25 to-blue-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Smartphone className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-400" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">Notificações iOS</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Configuração completa de notificações direto no app iOS. Controle total sobre alertas de perguntas, vendas e performance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Diária */}
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-purple-500/30 hover:from-purple-500/12 transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500/25 to-purple-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-purple-400" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">Performance Diária</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Resumos personalizados da performance do vendedor a cada dia. Insights automáticos sobre vendas, respostas e métricas.
                    </p>
                  </div>
                </div>
              </div>

              {/* XP e Recompensas */}
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-amber-500/30 hover:from-amber-500/12 transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-amber-500/25 to-amber-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Trophy className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-amber-400" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">XP & Gamificação</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Sistema completo de experiência, níveis, conquistas e recompensas reais. Gamificação otimizada e progressiva.
                    </p>
                  </div>
                </div>
              </div>

              {/* Personalidade da Marca */}
              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-gold/20 hover:from-white/[0.08] transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Sliders className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gold" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">DNA da Marca</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Personalize completamente o tom de voz: formal, casual, técnico. O agente se adapta 100% à sua marca.
                    </p>
                  </div>
                </div>
              </div>

              {/* Automação Horários */}
              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-gold/20 hover:from-white/[0.08] transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Calendar className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gold" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">Automação 24/7</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Configure horários para envio automático sem aprovação. Madrugada, finais de semana - você decide tudo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Aprendizado Inteligente */}
              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-gold/20 hover:from-white/[0.08] transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <RefreshCw className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gold" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">Aprende com Você</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Cada edição que você faz, a IA aprende e evolui. Respostas ficam cada vez mais alinhadas ao seu estilo.
                    </p>
                  </div>
                </div>
              </div>

              {/* IA Transparente */}
              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-gold/20 hover:from-white/[0.08] transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Eye className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gold" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">Veja a IA Pensando</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Acompanhe em tempo real o agente criando respostas, palavra por palavra. Transparência total.
                    </p>
                  </div>
                </div>
              </div>

              {/* Comunicação Humana */}
              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-gold/20 hover:from-white/[0.08] transition-all duration-300 group">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gold" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1">100% Natural</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Conversa fluida e humanizada que converte. Seus clientes não vão perceber que é uma IA respondendo.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

            {/* Footer - Status e Mensagem */}
            <div className="space-y-3">
              {/* Status Badge */}
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-gold/15 border border-gold/25 rounded-lg backdrop-blur-sm">
                  <div className="w-2 h-2 bg-gold rounded-full animate-pulse shadow-lg shadow-gold/50" />
                  <span className="text-xs sm:text-sm text-gold font-bold uppercase tracking-wide">
                    Em Desenvolvimento Ativo
                  </span>
                </div>
              </div>

              {/* Mensagem Final */}
              <p className="text-xs sm:text-sm text-center text-gray-400 leading-relaxed max-w-2xl mx-auto">
                A <span className="text-gold font-bold">Versão 5.0</span> representa uma evolução completa do ML Agent PRO com as tecnologias mais avançadas de 2025.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

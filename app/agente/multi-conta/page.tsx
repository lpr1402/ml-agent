'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MLAccountSwitcher } from '@/components/ml-account-switcher'
import { MultiAccountMetrics } from '@/components/agent/multi-account-metrics'
import { MultiAccountQuestionsV2 as MultiAccountQuestions } from '@/components/agent/multi-account-questions-v2'
import { EditWithAIModal } from '@/components/edit-with-ai-modal'
import { PremiumLoader } from '@/components/ui/premium-loader'
import {
  Building2,
  MessageSquare,
  Activity,
  Trophy,
  TrendingUp,
  LogOut,
  Settings,
  Info
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface QuestionWithAccount {
  id: string
  mlQuestionId: string
  text: string
  itemTitle: string | null
  itemPrice: number
  itemId: string
  itemPermalink?: string | null
  status: string
  aiResponse?: string | null
  finalResponse?: string | null
  receivedAt: string
  account: {
    id: string
    nickname: string
    thumbnail?: string | null
    siteId: string
  }
}

export default function MultiContaDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithAccount | null>(null)
  const [editWithAIQuestion, setEditWithAIQuestion] = useState<QuestionWithAccount | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [isRevising, setIsRevising] = useState(false)
  const [organizationName, setOrganizationName] = useState<string>('')

  // Verificar autenticação e carregar dados iniciais
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await apiClient.get('/api/auth/session')
        if (!session?.organizationId) {
          router.push('/login')
          return
        }
        setOrganizationName(session.organizationName || 'Minha Organização')
        setLoading(false)
      } catch (error) {
        logger.error('Auth check failed:', { error })
        router.push('/login')
      }
    }
    checkAuth()
  }, [router])

  // SSE para atualizações em tempo real
  useEffect(() => {
    const eventSource = new EventSource('/api/agent/events')
    
    eventSource.addEventListener('questions', (event) => {
      const data = JSON.parse(event.data)
      logger.info('[SSE] New questions event:', { data })
      // Trigger re-fetch nos componentes filhos através de um estado ou contexto
    })
    
    eventSource.addEventListener('metrics', (event) => {
      const data = JSON.parse(event.data)
      logger.info('[SSE] Metrics update:', { data })
      // Trigger re-fetch nos componentes filhos
    })
    
    eventSource.onerror = (error) => {
      logger.error('[SSE] Connection error:', { error })
    }
    
    return () => {
      eventSource.close()
    }
  }, [])

  // Função removida pois não é mais utilizada
  // const handleQuestionSelect

  const handleApproveQuestion = async (questionId: string) => {
    try {
      await apiClient.post('/api/agent/approve-question', { 
        questionId,
        accountId: selectedQuestion?.account.id 
      })
      
      // Fechar modal e atualizar lista
      setSelectedQuestion(null)
      // Trigger refresh dos componentes
    } catch (error) {
      logger.error('Error approving question:', { error })
    }
  }

  const handleReviseQuestion = async () => {
    if (!selectedQuestion || !revisionFeedback) return
    
    setIsRevising(true)
    try {
      await apiClient.post('/api/agent/revise-question', {
        questionId: selectedQuestion.id,
        feedback: revisionFeedback,
        accountId: selectedQuestion.account.id
      })
      
      setSelectedQuestion(null)
      setRevisionFeedback('')
      // Trigger refresh
    } catch (error) {
      logger.error('Error revising question:', { error })
    } finally {
      setIsRevising(false)
    }
  }

  const handleEditWithAI = (question: QuestionWithAccount) => {
    setEditWithAIQuestion(question)
  }

  const handleLogout = async () => {
    try {
      const response = await apiClient.post('/api/auth/logout')
      logger.info('Logout successful', response)
      // Redirecionar para login após logout bem-sucedido
      router.push('/login')
    } catch (error) {
      logger.error('Logout failed:', { error })
      // Mesmo com erro, tentar redirecionar
      router.push('/login')
    }
  }

  if (loading) {
    return <PremiumLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Building2 className="h-6 w-6" style={{ color: '#FFE600' }} />
              <div>
                <h1 className="text-xl font-bold">{organizationName}</h1>
                <p className="text-xs text-gray-500">Dashboard Multi-Conta</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <MLAccountSwitcher />
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/settings')}>
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Alert Informativo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Dashboard Multi-Conta Ativo</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Visualizando dados consolidados de todas as suas contas do Mercado Livre. 
                Clique em uma conta nas métricas para filtrar as perguntas.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Perguntas
            </TabsTrigger>
            <TabsTrigger value="gamification" className="gap-2">
              <Trophy className="h-4 w-4" />
              Gamificação
            </TabsTrigger>
            <TabsTrigger value="roi" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              ROI & Insights
            </TabsTrigger>
          </TabsList>

          {/* Tab: Visão Geral */}
          <TabsContent value="overview" className="space-y-6">
            <MultiAccountMetrics 
              onAccountSelect={setSelectedAccountId}
              selectedAccountId={selectedAccountId}
            />
            
            {/* Preview de Perguntas Pendentes */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Perguntas Pendentes Recentes</h3>
              <MultiAccountQuestions
                selectedAccountId={selectedAccountId}
                filterStatus="pending"
              />
            </Card>
          </TabsContent>

          {/* Tab: Perguntas */}
          <TabsContent value="questions">
            <MultiAccountQuestions
              selectedAccountId={selectedAccountId}
            />
          </TabsContent>

          {/* Tab: Gamificação */}
          <TabsContent value="gamification">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Gamificação em Desenvolvimento</h3>
              <p className="text-gray-500">Sistema de gamificação multi-conta será implementado em breve.</p>
            </Card>
          </TabsContent>

          {/* Tab: ROI */}
          <TabsContent value="roi">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">ROI & Insights</h3>
              <p className="text-gray-500">Análise de ROI multi-conta será implementada em breve.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal de Pergunta Selecionada */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">Detalhes da Pergunta</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      style={{ 
                        background: '#FFE600',
                        color: '#000'
                      }}
                    >
                      {selectedQuestion.account.nickname}
                    </Badge>
                    <Badge variant="outline">
                      {selectedQuestion.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedQuestion(null)}
                >
                  ✕
                </Button>
              </div>

              {/* Produto */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm font-semibold mb-1">Produto:</p>
                <p>{selectedQuestion.itemTitle || 'Produto sem título'}</p>
                <p className="text-sm text-gray-500">
                  R$ {selectedQuestion.itemPrice.toFixed(2).replace('.', ',')}
                </p>
              </div>

              {/* Pergunta */}
              <div>
                <p className="text-sm font-semibold mb-1">Pergunta:</p>
                <p className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  {selectedQuestion.text}
                </p>
              </div>

              {/* Resposta AI */}
              {selectedQuestion.aiResponse && (
                <div>
                  <p className="text-sm font-semibold mb-1">Sugestão da IA:</p>
                  <p className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    {selectedQuestion.aiResponse}
                  </p>
                </div>
              )}

              {/* Área de Revisão */}
              {selectedQuestion.status === 'AWAITING_APPROVAL' && (
                <div>
                  <p className="text-sm font-semibold mb-1">Feedback para Revisão (opcional):</p>
                  <Textarea
                    value={revisionFeedback}
                    onChange={(e) => setRevisionFeedback(e.target.value)}
                    placeholder="Digite aqui se quiser revisar a resposta..."
                    rows={3}
                  />
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedQuestion.status === 'AWAITING_APPROVAL' && (
                  <>
                    <Button
                      className="flex-1"
                      onClick={() => handleApproveQuestion(selectedQuestion.id)}
                    >
                      Aprovar Resposta
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleReviseQuestion}
                      disabled={!revisionFeedback || isRevising}
                    >
                      {isRevising ? 'Revisando...' : 'Revisar'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedQuestion(null)
                        handleEditWithAI(selectedQuestion)
                      }}
                    >
                      Editar com IA
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Edição com IA */}
      {editWithAIQuestion && (
        <EditWithAIModal
          isOpen={true}
          question={editWithAIQuestion}
          onClose={() => setEditWithAIQuestion(null)}
          onSuccess={() => {
            setEditWithAIQuestion(null)
            // Trigger refresh
          }}
        />
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { 
  CheckCircle, 
  Edit2, 
  Clock, 
  AlertCircle, 
  Package, 
  MessageSquare, 
  Send, 
  ChevronRight, 
  Sparkles,
  Store,
  X
} from "lucide-react"

interface Question {
  id: string
  sequentialId: number
  mlQuestionId: string
  text: string
  aiResponse: string
  itemTitle: string
  itemPrice: number
  itemPermalink: string
  status: string
  approvedAt?: string
}

export default function PublicApprovalPage() {
  const params = useParams()
  const questionId = params.questionId as string
  
  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revisionFeedback, setRevisionFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [action, setAction] = useState<"approve" | "revise" | null>(null)
  const [showRevision, setShowRevision] = useState(false)
  const [editedResponse, setEditedResponse] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetchQuestion()
  }, [questionId])

  const fetchQuestion = async () => {
    try {
      const response = await fetch(`/api/public/question/${questionId}`)
      
      if (response.status === 410) {
        const data = await response.json()
        setError(data.error === "AlreadyUsed" ? "AlreadyUsed" : "expired")
        setLoading(false)
        return
      }
      
      if (!response.ok) {
        setError("not_found")
        setLoading(false)
        return
      }
      
      const data = await response.json()
      setQuestion(data)
      setEditedResponse(data.aiResponse)
      
      // Check if already processed
      if (data.status === "COMPLETED" || data.status === "APPROVED") {
        setError("already_processed")
      }
      
    } catch (err) {
      setError("error")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/public/approve/${questionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "approve",
          editedResponse: isEditing ? editedResponse : null
        })
      })
      
      if (response.ok) {
        setAction("approve")
      } else {
        alert("Erro ao aprovar resposta")
      }
    } catch (err) {
      alert("Erro ao processar")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevise = async () => {
    if (!revisionFeedback.trim() && editedResponse === question?.aiResponse) {
      alert("Por favor, forneça feedback ou edite a resposta")
      return
    }
    
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/public/approve/${questionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "revise",
          feedback: revisionFeedback,
          editedResponse: isEditing ? editedResponse : null
        })
      })
      
      if (response.ok) {
        setAction("revise")
      } else {
        alert("Erro ao solicitar revisão")
      }
    } catch (err) {
      alert("Erro ao processar")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#FFE600]"></div>
          <span className="text-gray-600">Carregando pergunta...</span>
        </motion.div>
      </div>
    )
  }

  if (error === "expired" || error === "AlreadyUsed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="max-w-md w-full bg-white border-2 border-gray-800">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Clock className="h-10 w-10 text-gray-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Link Já Utilizado</h2>
              <p className="text-gray-600 mb-6">
                Este link já foi utilizado para processar a pergunta.
              </p>
              <Button 
                onClick={() => window.location.href = "/login"}
                className="bg-[#FFE600] hover:bg-[#FFD600] text-gray-900 font-semibold px-8"
              >
                Acessar Plataforma
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (error === "already_processed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="max-w-md w-full bg-white border-2 border-gray-800">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Pergunta Já Processada</h2>
              <p className="text-gray-600 mb-2">
                Esta pergunta já foi respondida e enviada ao cliente.
              </p>
              {question && (
                <div className="mt-6 p-4 bg-gray-100 rounded-xl text-left">
                  <p className="text-xs text-gray-500 mb-1 font-medium">PERGUNTA #{question.sequentialId}</p>
                  <p className="text-sm font-semibold text-gray-900">{question.itemTitle}</p>
                </div>
              )}
              <Button 
                onClick={() => window.location.href = "/login"}
                className="mt-6 bg-[#FFE600] hover:bg-[#FFD600] text-gray-900 font-semibold px-8"
              >
                Ver Todas as Perguntas
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (error || !question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="max-w-md w-full bg-white border-2 border-gray-800">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Pergunta Não Encontrada</h2>
              <p className="text-gray-600">
                Esta pergunta não existe ou o link é inválido.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (action === "approve") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="max-w-md w-full bg-white border-2 border-gray-800">
            <CardContent className="pt-8 pb-6 text-center">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="h-10 w-10 text-green-600" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Resposta Aprovada!</h2>
              <p className="text-gray-600 mb-6">
                A resposta foi enviada com sucesso ao cliente no Mercado Livre.
              </p>
              <div className="p-4 bg-gray-100 rounded-xl text-left">
                <p className="text-xs text-gray-500 mb-1 font-medium">PERGUNTA #{question.sequentialId}</p>
                <p className="text-sm font-semibold mb-3 text-gray-900">{question.itemTitle}</p>
                <p className="text-sm text-gray-700 italic">&ldquo;{isEditing ? editedResponse : question.aiResponse}&rdquo;</p>
              </div>
              <Button 
                onClick={() => window.close()}
                className="mt-6 bg-[#FFE600] hover:bg-[#FFD600] text-gray-900 font-semibold px-8"
              >
                Fechar
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (action === "revise") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="max-w-md w-full bg-white border-2 border-gray-800">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                <Edit2 className="h-10 w-10 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Revisão Solicitada</h2>
              <p className="text-gray-600 mb-6">
                O ML Agent está gerando uma nova resposta baseada no seu feedback.
              </p>
              <div className="p-4 bg-gray-100 rounded-xl text-left">
                <p className="text-xs text-gray-500 mb-1 font-medium">SEU FEEDBACK:</p>
                <p className="text-sm text-gray-700">{revisionFeedback || "Edição manual da resposta"}</p>
              </div>
              <p className="text-sm text-gray-600 mt-6 mb-6">
                Acesse a Central de Atendimento para visualizar e aprovar a resposta revisada.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => window.location.href = `/api/auth/auto-login?token=${questionId}&action=review`}
                  className="w-full bg-[#FFE600] hover:bg-[#FFD600] text-gray-900 font-semibold py-3"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Acessar Central de Atendimento
                </Button>
                <Button 
                  onClick={() => window.close()}
                  variant="outline"
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#FFE600] p-2 rounded-lg">
              <Store className="h-6 w-6 text-gray-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ML Agent</h1>
              <p className="text-xs text-gray-500">Aprovação Rápida</p>
            </div>
          </div>
          <Badge className="bg-[#FFE600]/10 text-gray-900 border-0">
            Pergunta #{question?.sequentialId}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-white border-2 border-gray-800">
            <CardContent className="p-6 space-y-6">
              {/* Product Info */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-gray-600" />
                      <span className="font-semibold text-gray-900 text-sm sm:text-base">{question.itemTitle}</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      R$ {question.itemPrice.toFixed(2)}
                    </p>
                  </div>
                  {question.itemPermalink && (
                    <a 
                      href={question.itemPermalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                    >
                      Ver no ML
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Question */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-600" />
                  Pergunta do Cliente:
                </h3>
                <div className="bg-[#FFE600]/10 border-l-4 border-[#FFE600] p-4 rounded-r-lg">
                  <p className="text-gray-700 text-sm sm:text-base">
                    {question.text}
                  </p>
                </div>
              </div>

              {/* ML Agent Response - Editable */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#FFE600]" />
                    Resposta Sugerida pelo ML Agent:
                  </h3>
                  {!showRevision && (
                    <Button
                      onClick={() => setIsEditing(!isEditing)}
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      {isEditing ? "Cancelar" : "Editar"}
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Textarea
                    value={editedResponse}
                    onChange={(e) => setEditedResponse(e.target.value)}
                    className="min-h-[120px] bg-white border-gray-300 text-gray-900 focus:border-[#FFE600] focus:ring-1 focus:ring-[#FFE600]"
                    placeholder="Edite a resposta aqui..."
                  />
                ) : (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                    <p className="text-gray-700 text-sm sm:text-base whitespace-pre-wrap">
                      {editedResponse}
                    </p>
                  </div>
                )}
              </div>

              {/* Revision Feedback - Only shown when revision is clicked */}
              {showRevision && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="font-semibold mb-3 text-gray-900">
                    Descreva as alterações necessárias:
                  </h3>
                  <Textarea
                    value={revisionFeedback}
                    onChange={(e) => setRevisionFeedback(e.target.value)}
                    placeholder="Descreva o que precisa ser ajustado na resposta..."
                    className="min-h-[80px] bg-white border-gray-300 text-gray-900 focus:border-[#FFE600] focus:ring-1 focus:ring-[#FFE600]"
                  />
                </motion.div>
              )}

              {/* Actions */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                {!showRevision ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 text-sm sm:text-base"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {isEditing ? "Aprovar com Edições" : "Aprovar e Enviar"}
                    </Button>
                    <Button
                      onClick={() => setShowRevision(true)}
                      disabled={isSubmitting}
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold py-3 text-sm sm:text-base"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Solicitar Revisão
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={handleRevise}
                      disabled={(!revisionFeedback.trim() && editedResponse === question.aiResponse) || isSubmitting}
                      className="bg-[#FFE600] hover:bg-[#FFD600] text-gray-900 font-semibold py-3"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar para Revisão
                    </Button>
                    <Button
                      onClick={() => {
                        setShowRevision(false)
                        setRevisionFeedback("")
                      }}
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold py-3"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                )}

                {/* Notice */}
                <div className="text-center text-xs sm:text-sm text-gray-500 pt-2">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Este link será desativado após o processamento
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
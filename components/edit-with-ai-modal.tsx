'use client'

import { useState } from 'react'
import { logger } from '@/lib/logger'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
// import { toast } from '@/hooks/use-toast' // Removido - apenas notificações do dispositivo
import { apiClient } from '@/lib/api-client'
import { 
  Sparkles,
  Loader2,
  Send
} from 'lucide-react'

interface EditWithAIModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  question: {
    id: string
    text: string
    productTitle?: string
    currentAnswer?: string
  }
}

export function EditWithAIModal({
  isOpen,
  onClose,
  onSuccess,
  question
}: EditWithAIModalProps) {
  const [editInstruction, setEditInstruction] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const handleSubmit = async () => {
    if (!editInstruction.trim()) {
      // Removido toast - apenas notificações do dispositivo
      console.error('[AI Edit] No instruction provided')
      return
    }
    
    setIsLoading(true)
    
    try {
      const response = await apiClient.post('/api/agent/edit-with-ai', {
        questionId: question.id,
        editInstruction: editInstruction.trim(),
        previousAnswer: question.currentAnswer
      })
      
      if (response.success) {
        // Removido toast - apenas notificações do dispositivo
        console.log('[AI Edit] Request sent successfully')
        
        onSuccess()
        onClose()
        setEditInstruction('')
      } else {
        throw new Error(response.error || 'Erro ao processar solicitação')
      }
    } catch (error) {
      logger.error('Failed to request AI edit:', { error })
      // Removido toast - apenas notificações do dispositivo
      console.error('[AI Edit] Failed to request edit')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[600px]"
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '2px solid rgba(255, 230, 0, 0.3)',
          color: '#fff',
          borderRadius: '12px',
          padding: '24px'
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6" style={{ color: '#FFE600' }} />
              Editar Resposta com IA
            </div>
          </DialogTitle>
          <DialogDescription style={{ color: '#999', marginTop: '8px' }}>
            Descreva como você gostaria que a IA editasse a resposta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Pergunta Original */}
          <div 
            className="p-3 rounded-lg"
            style={{
              background: 'rgba(255, 230, 0, 0.05)',
              border: '1px solid rgba(255, 230, 0, 0.15)'
            }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: '#FFE600' }}>
              PERGUNTA DO CLIENTE:
            </p>
            <p className="text-sm" style={{ color: '#ddd' }}>
              {question.text}
            </p>
          </div>
          
          {/* Resposta Atual */}
          {question.currentAnswer && (
            <div 
              className="p-3 rounded-lg"
              style={{
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.15)'
              }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: '#3b82f6' }}>
                RESPOSTA ATUAL:
              </p>
              <p className="text-sm" style={{ color: '#ddd' }}>
                {question.currentAnswer}
              </p>
            </div>
          )}
          
          {/* Campo de Instrução */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: '#fff' }}>
              Como você gostaria de editar esta resposta?
            </label>
            <Textarea
              placeholder="Ex: Torne a resposta mais amigável e adicione informações sobre garantia..."
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              className="min-h-[120px]"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff'
              }}
              disabled={isLoading}
            />
            <p className="text-xs mt-2" style={{ color: '#666' }}>
              Seja específico sobre as mudanças que deseja
            </p>
          </div>
          
          {/* Exemplos de Instruções */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: '#888' }}>
              EXEMPLOS DE INSTRUÇÕES:
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setEditInstruction('Torne a resposta mais amigável e pessoal')}
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: 'rgba(255, 230, 0, 0.1)',
                  border: '1px solid rgba(255, 230, 0, 0.2)',
                  color: '#FFE600'
                }}
                disabled={isLoading}
              >
                Mais amigável
              </button>
              <button
                onClick={() => setEditInstruction('Adicione informações sobre prazo de entrega')}
                className="text-xs px-2 py-1 rounded ml-2"
                style={{
                  background: 'rgba(255, 230, 0, 0.1)',
                  border: '1px solid rgba(255, 230, 0, 0.2)',
                  color: '#FFE600'
                }}
                disabled={isLoading}
              >
                + Prazo entrega
              </button>
              <button
                onClick={() => setEditInstruction('Seja mais direto e objetivo')}
                className="text-xs px-2 py-1 rounded ml-2"
                style={{
                  background: 'rgba(255, 230, 0, 0.1)',
                  border: '1px solid rgba(255, 230, 0, 0.2)',
                  color: '#FFE600'
                }}
                disabled={isLoading}
              >
                Mais objetivo
              </button>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#999'
            }}
          >
            Cancelar
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !editInstruction.trim()}
            style={{
              background: '#FFE600',
              color: '#0a0a0a',
              fontWeight: 600
            }}
            className="hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar para IA
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
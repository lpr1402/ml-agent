"use client"

/**
 * Modal de Pagamento PIX
 * R$ 500/mês - Assinatura Premium
 */

import { logger } from '@/lib/logger'
import { useState } from 'react'
import { X, Copy, Check, QrCode } from 'lucide-react'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  onSuccess?: () => void
}

// Informações PIX hardcoded conforme solicitado
const PIX_INFO = {
  code: "00020101021126330014br.gov.bcb.pix0111496118808555204000053039865406500.005802BR5925LUIS FERNANDO PEREIRA ROD6009SAO PAULO622905251K3PC743YN7DR3JGS3EXE3RPW630449B9",
  key: "496118808-55",
  qrUrl: "https://www.dropbox.com/scl/fi/r6zrsjvz2pbo6pgc0tlgw/IMG_3881.jpeg?rlkey=yyrtf2n0nz4zt6ogqx2a8870h&st=q3rhjrkk&raw=1",
  amount: 500.00,
  recipient: "LUIS FERNANDO PEREIRA ROD"
}

export function PaymentModal({ 
  isOpen, 
  onClose, 
  organizationId,
  onSuccess 
}: PaymentModalProps) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (!isOpen) return null

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(PIX_INFO.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (error) {
      logger.error('Failed to copy:', { error })
    }
  }

  const confirmPayment = async () => {
    setConfirming(true)
    try {
      const response = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          organizationId,
          amount: PIX_INFO.amount,
          method: 'PIX'
        })
      })

      if (response.ok) {
        onSuccess?.()
        onClose()
      }
    } catch (error) {
      logger.error('Failed to confirm payment:', { error })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black-rich border border-yellow-glow-20 rounded-2xl max-w-md w-full p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-light text-yellow-primary tracking-wider">
              ASSINATURA PREMIUM
            </h2>
            <p className="text-gray-medium text-sm mt-1">
              Acesso completo ao ML Agent
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-yellow-glow-10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-medium" />
          </button>
        </div>

        {/* Price */}
        <div className="text-center mb-6">
          <div className="inline-flex items-baseline gap-2">
            <span className="text-gray-medium text-lg">R$</span>
            <span className="text-5xl font-light text-white">500</span>
            <span className="text-gray-medium text-lg">/mês</span>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-black-pure rounded-xl p-6 mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-yellow-primary mb-4">
            <QrCode className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">
              QR Code PIX
            </span>
          </div>
          
          <div className="relative w-48 h-48 mx-auto bg-white rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PIX_INFO.qrUrl}
              alt="QR Code PIX"
              className="w-full h-full object-cover"
            />
          </div>
          
          <p className="text-xs text-gray-dark mt-3">
            Escaneie o código com seu app de pagamento
          </p>
        </div>

        {/* PIX Copy */}
        <div className="bg-black-pure rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-medium mb-2 uppercase tracking-wider">
            PIX Copia e Cola
          </p>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={PIX_INFO.code}
              readOnly
              className="flex-1 bg-black-rich text-white text-xs p-3 rounded-lg border border-yellow-glow-10 font-mono"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-yellow-glow-20 hover:bg-yellow-glow-30 text-yellow-primary rounded-lg transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Copiar</span>
                </>
              )}
            </button>
          </div>
          
          <div className="mt-3 text-xs text-gray-dark">
            <p>Chave PIX: <span className="text-gray-medium">{PIX_INFO.key}</span></p>
            <p>Beneficiário: <span className="text-gray-medium">{PIX_INFO.recipient}</span></p>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          onClick={confirmPayment}
          disabled={confirming}
          className="w-full py-3 bg-gradient-to-r from-yellow-primary to-yellow-gold text-black-pure font-semibold rounded-lg hover:shadow-lg hover:shadow-yellow-glow-30 transition-all disabled:opacity-50"
        >
          {confirming ? 'Confirmando...' : 'Já Paguei - Confirmar Pagamento'}
        </button>

        {/* Info */}
        <div className="mt-4 p-3 bg-yellow-glow-10 rounded-lg">
          <p className="text-xs text-yellow-primary text-center">
            ⚡ Ativação imediata após confirmação do pagamento
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-6 pt-6 border-t border-yellow-glow-10">
          <p className="text-xs text-gray-medium uppercase tracking-wider mb-3">
            Incluído na assinatura:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-medium">
              <Check className="w-4 h-4 text-yellow-primary flex-shrink-0" />
              Múltiplas contas ML
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-medium">
              <Check className="w-4 h-4 text-yellow-primary flex-shrink-0" />
              Resposta automática com IA
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-medium">
              <Check className="w-4 h-4 text-yellow-primary flex-shrink-0" />
              Dashboard completo
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-medium">
              <Check className="w-4 h-4 text-yellow-primary flex-shrink-0" />
              Suporte prioritário 24/7
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
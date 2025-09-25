import { subscriptionValidator } from '@/lib/subscription/plan-validator'
import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"

// Mock templates data
const templates = [
  {
    id: "1",
    category: "greeting",
    trigger: ["olá", "oi", "bom dia", "boa tarde", "boa noite"],
    template: "Olá! Obrigado pelo seu interesse em {product_name}. Como posso ajudá-lo?",
    language: "pt-BR",
    active: true,
    usageCount: 45,
  },
  {
    id: "2",
    category: "shipping",
    trigger: ["envio", "frete", "entrega", "prazo"],
    template: "O envio deste produto é feito via Mercado Envios e leva aproximadamente 3-5 dias úteis para sua região. O frete é calculado automaticamente no carrinho.",
    language: "pt-BR",
    active: true,
    usageCount: 123,
  },
  {
    id: "3",
    category: "price",
    trigger: ["preço", "desconto", "promoção", "valor"],
    template: "O preço atual é {price}. Oferecemos parcelamento em até 12x sem juros pelo Mercado Pago.",
    language: "pt-BR",
    active: true,
    usageCount: 67,
  },
  {
    id: "4",
    category: "stock",
    trigger: ["estoque", "disponível", "quantidade", "unidades"],
    template: "Temos {stock} unidades disponíveis em estoque para pronta entrega.",
    language: "pt-BR",
    active: true,
    usageCount: 89,
  },
  {
    id: "5",
    category: "warranty",
    trigger: ["garantia", "defeito", "troca", "devolução"],
    template: "Este produto possui garantia de 12 meses contra defeitos de fabricação. Em caso de problemas, oferecemos troca ou devolução conforme política do Mercado Livre.",
    language: "pt-BR",
    active: true,
    usageCount: 34,
  },
]

export async function GET(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()
    
    // Validate subscription limits
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    const validation = await subscriptionValidator.validateAction(
      auth.organizationId,
      'question'
    )
    
    if (!validation.allowed) {
      return NextResponse.json({
        error: validation.reason,
        upgradeRequired: validation.upgradeRequired
      }, { status: 403 })
    }
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(templates)
  } catch (error) {
    logger.error("Error fetching templates:", { error })
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

export async function POST(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()
    
    // Validate subscription limits
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    const validation = await subscriptionValidator.validateAction(
      auth.organizationId,
      'question'
    )
    
    if (!validation.allowed) {
      return NextResponse.json({
        error: validation.reason,
        upgradeRequired: validation.upgradeRequired
      }, { status: 403 })
    }
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await _request.json()
    
    // Mock save - in production, save to database
    const newTemplate = {
      id: Date.now().toString(),
      ...body,
      trigger: body.triggers.split(",").map((t: string) => t.trim()),
      language: "pt-BR",
      active: true,
      usageCount: 0,
    }

    templates.push(newTemplate)

    return NextResponse.json({
      success: true,
      template: newTemplate,
    })
  } catch (error) {
    logger.error("Error saving template:", { error })
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 }
    )
  }
}
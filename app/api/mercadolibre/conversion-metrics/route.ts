import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user info first to get the user ID
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch user" }, { status: 401 })
    }

    const user = await userResponse.json()
    const userId = user.id

    // Buscar perguntas dos últimos 30 dias
    const endDate = new Date()
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    // Buscar perguntas respondidas
    const questionsResponse = await fetch(
      `https://api.mercadolibre.com/questions/search?seller_id=${userId}&status=answered&date_created_from=${startDate.toISOString()}&date_created_to=${endDate.toISOString()}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      }
    )
    
    if (!questionsResponse.ok) {
      console.error('Failed to fetch questions')
      return NextResponse.json({ 
        summary: {
          total_questions: 0,
          unique_questioners: 0,
          total_converters: 0,
          conversion_rate: 0,
          total_orders: 0,
          total_buyers: 0
        }
      })
    }
    
    const questionsData = await questionsResponse.json()
    const questions = questionsData.questions || []
    
    // Extrair IDs únicos de quem fez perguntas
    const questionerIds = new Set(
      questions.map((q: any) => q.from?.id).filter(Boolean)
    )
    
    // Buscar vendas dos últimos 30 dias
    const ordersResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${startDate.toISOString()}&order.date_created.to=${endDate.toISOString()}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      }
    )
    
    if (!ordersResponse.ok) {
      console.error('Failed to fetch orders')
      return NextResponse.json({ 
        summary: {
          total_questions: questions.length,
          unique_questioners: questionerIds.size,
          total_converters: 0,
          conversion_rate: 0,
          total_orders: 0,
          total_buyers: 0
        }
      })
    }
    
    const ordersData = await ordersResponse.json()
    const orders = ordersData.results || []
    
    // Extrair IDs de compradores
    const buyerIds = new Set(
      orders.map((o: any) => o.buyer?.id).filter(Boolean)
    )
    
    // Calcular conversões (quantos que perguntaram também compraram)
    const converters = new Set(
      [...questionerIds].filter(id => buyerIds.has(id))
    )
    
    // Calcular métricas detalhadas por item
    const itemConversions: Record<string, any> = {}
    
    questions.forEach((q: any) => {
      const itemId = q.item_id
      const askerId = q.from?.id
      
      if (!itemConversions[itemId]) {
        itemConversions[itemId] = {
          item_id: itemId,
          questions: 0,
          questioners: new Set(),
          converters: new Set(),
          sales: 0
        }
      }
      
      itemConversions[itemId].questions++
      itemConversions[itemId].questioners.add(askerId)
      
      // Verificar se este usuário comprou este item específico
      const userBoughtItem = orders.some((o: any) => 
        o.buyer?.id === askerId && 
        o.order_items?.some((item: any) => item.item.id === itemId)
      )
      
      if (userBoughtItem) {
        itemConversions[itemId].converters.add(askerId)
      }
    })
    
    // Calcular vendas por item
    orders.forEach((o: any) => {
      o.order_items?.forEach((orderItem: any) => {
        const itemId = orderItem.item.id
        if (itemConversions[itemId]) {
          itemConversions[itemId].sales++
        }
      })
    })
    
    // Formatar métricas finais
    const itemMetrics = Object.values(itemConversions).map(item => ({
      item_id: item.item_id,
      total_questions: item.questions,
      unique_questioners: item.questioners.size,
      converters: item.converters.size,
      total_sales: item.sales,
      conversion_rate: item.questioners.size > 0 
        ? (item.converters.size / item.questioners.size) * 100 
        : 0
    }))
    
    // Ordenar por taxa de conversão
    itemMetrics.sort((a, b) => b.conversion_rate - a.conversion_rate)
    
    return NextResponse.json({
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      summary: {
        total_questions: questions.length,
        unique_questioners: questionerIds.size,
        total_converters: converters.size,
        conversion_rate: questionerIds.size > 0 
          ? (converters.size / questionerIds.size) * 100 
          : 0,
        total_orders: orders.length,
        total_buyers: buyerIds.size
      },
      top_converting_items: itemMetrics.slice(0, 5),
      all_items: itemMetrics
    })
    
  } catch (error) {
    console.error('Error in conversion metrics endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Failed to calculate conversion metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        summary: {
          total_questions: 0,
          unique_questioners: 0,
          total_converters: 0,
          conversion_rate: 0,
          total_orders: 0,
          total_buyers: 0
        }
      },
      { status: 500 }
    )
  }
}
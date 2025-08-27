"use client"

import React from 'react'

interface RecentOrdersPremiumProps {
  orders: any[]
}

export function RecentOrdersPremium({ orders }: RecentOrdersPremiumProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="container-pedidos" style={{
        background: 'linear-gradient(135deg, #111111 0%, #0A0A0A 100%)',
        border: '1px solid rgba(255, 230, 0, 0.15)',
        borderRadius: '24px',
        padding: '32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="container-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255, 230, 0, 0.1)'
        }}>
          <div className="container-title-wrapper">
            <h3 className="container-title" style={{
              fontSize: '24px',
              fontWeight: '300',
              letterSpacing: '0.1em',
              color: '#FFE600',
              margin: 0
            }}>Pedidos Recentes</h3>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: '#666666' }}>
          Nenhum pedido recente encontrado
        </div>
      </div>
    )
  }

  // Mapear status REAIS da API do ML conforme documentação oficial
  const getStatusStyle = (status: string) => {
    // Status oficiais da API do Mercado Livre
    switch (status) {
      case 'confirmed':
        return { color: '#3B82F6', label: 'Confirmado', icon: '○' }
      case 'payment_required':
        return { color: '#F59E0B', label: 'Pagamento Pendente', icon: '⏱' }
      case 'payment_in_process':
        return { color: '#FFE600', label: 'Processando Pagamento', icon: '⟲' }
      case 'partially_paid':
        return { color: '#FB923C', label: 'Parcialmente Pago', icon: '◐' }
      case 'paid':
        return { color: '#4ADE80', label: 'Pago', icon: '✓' }
      case 'partially_refunded':
        return { color: '#F59E0B', label: 'Reembolso Parcial', icon: '↩' }
      case 'pending_cancel':
        return { color: '#EF4444', label: 'Cancelamento Pendente', icon: '⊗' }
      case 'cancelled':
        return { color: '#F87171', label: 'Cancelado', icon: '✕' }
      case 'invalid':
        return { color: '#991B1B', label: 'Inválido', icon: '⚠' }
      default:
        return { color: '#999999', label: status, icon: '•' }
    }
  }

  // Mapear métodos de pagamento REAIS da API do ML conforme documentação
  const getPaymentMethodName = (method: string) => {
    const methods: any = {
      'account_money': 'Mercado Pago',
      'credit_card': 'Cartão de Crédito',
      'debit_card': 'Cartão de Débito',
      'master': 'Mastercard',
      'visa': 'Visa',
      'elo': 'Elo',
      'hipercard': 'Hipercard',
      'amex': 'American Express',
      'ticket': 'Boleto',
      'bolbradesco': 'Boleto Bradesco',
      'pix': 'PIX',
      'bank_transfer': 'Transferência',
      'prepaid_card': 'Cartão Pré-pago',
      'digital_wallet': 'Carteira Digital',
      'crypto_transfer': 'Criptomoeda',
      'consumer_credits': 'Mercado Crédito',
      'mercadopago_account': 'Saldo MP'
    }
    return methods[method] || method
  }

  // Mapear tipos de anúncio REAIS da API
  const getListingTypeName = (type: string) => {
    const types: any = {
      'gold_special': 'Clássico',
      'gold_pro': 'Premium',
      'gold_premium': 'Premium',
      'silver': 'Grátis',
      'bronze': 'Bronze',
      'free': 'Gratuito'
    }
    return types[type] || type
  }

  // Calcular métricas REAIS baseadas na documentação ML
  const displayOrders = orders.slice(0, 10)
  const totalRevenue = displayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
  const totalPaid = displayOrders.reduce((sum, order) => sum + (order.paid_amount || 0), 0)
  const totalItems = displayOrders.reduce((sum, order) => 
    sum + (order.order_items?.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0) || 0), 0
  )
  const totalFees = displayOrders.reduce((sum, order) => 
    sum + (order.order_items?.reduce((feeSum: number, item: any) => feeSum + (item.sale_fee || 0), 0) || 0), 0
  )
  const successRate = displayOrders.length > 0 ? 
    (displayOrders.filter(o => o.status === 'paid' || o.status === 'confirmed').length / displayOrders.length) * 100 : 0

  return (
    <div className="container-pedidos" style={{
      background: 'linear-gradient(135deg, #111111 0%, #0A0A0A 100%)',
      border: '1px solid rgba(255, 230, 0, 0.15)',
      borderRadius: '24px',
      padding: '32px',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header PADRONIZADO com outros containers */}
      <div className="container-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 230, 0, 0.1)'
      }}>
        <div className="container-title-wrapper">
          <h3 className="container-title" style={{
            fontSize: '24px',
            fontWeight: '300',
            letterSpacing: '0.1em',
            color: '#FFE600',
            margin: 0
          }}>Pedidos Recentes</h3>
        </div>
        {/* Badge de status alinhado à direita */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div style={{
            padding: '6px 12px',
            background: 'rgba(255, 230, 0, 0.1)',
            border: '1px solid rgba(255, 230, 0, 0.2)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#FFE600',
            fontWeight: '600',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            {orders.length} pedidos
          </div>
          {successRate >= 90 && (
            <div style={{
              padding: '6px 12px',
              background: 'rgba(74, 222, 128, 0.1)',
              border: '1px solid rgba(74, 222, 128, 0.2)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#4ADE80',
              fontWeight: '600',
              letterSpacing: '0.05em'
            }}>
              {successRate.toFixed(0)}% sucesso
            </div>
          )}
        </div>
      </div>

      {/* Métricas Resumidas - PADRONIZADO com outros containers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Receita Total */}
        <div style={{
          background: 'rgba(255, 230, 0, 0.03)',
          border: '1px solid rgba(255, 230, 0, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <p style={{ 
            fontSize: '10px', 
            color: '#666666', 
            marginBottom: '8px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            fontWeight: '500'
          }}>
            Receita Total
          </p>
          <p style={{ 
            fontSize: '28px', 
            fontWeight: '200', 
            background: 'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            {totalRevenue.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
          </p>
          <p style={{ fontSize: '9px', color: '#999999', marginTop: '4px' }}>
            últimos 10 pedidos
          </p>
        </div>

        {/* Valor Pago */}
        <div style={{
          background: 'rgba(255, 230, 0, 0.03)',
          border: '1px solid rgba(255, 230, 0, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <p style={{ 
            fontSize: '10px', 
            color: '#666666', 
            marginBottom: '8px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            fontWeight: '500'
          }}>
            Valor Pago
          </p>
          <p style={{ 
            fontSize: '28px', 
            fontWeight: '200', 
            color: '#4ADE80',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            {totalPaid.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
          </p>
          <p style={{ fontSize: '9px', color: '#999999', marginTop: '4px' }}>
            confirmados
          </p>
        </div>

        {/* Comissões ML */}
        <div style={{
          background: 'rgba(255, 230, 0, 0.03)',
          border: '1px solid rgba(255, 230, 0, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <p style={{ 
            fontSize: '10px', 
            color: '#666666', 
            marginBottom: '8px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            fontWeight: '500'
          }}>
            Comissões ML
          </p>
          <p style={{ 
            fontSize: '28px', 
            fontWeight: '200', 
            color: '#F87171',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            {totalFees.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
          </p>
          <p style={{ fontSize: '9px', color: '#999999', marginTop: '4px' }}>
            taxa de venda
          </p>
        </div>

        {/* Ticket Médio */}
        <div style={{
          background: 'rgba(255, 230, 0, 0.03)',
          border: '1px solid rgba(255, 230, 0, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <p style={{ 
            fontSize: '10px', 
            color: '#666666', 
            marginBottom: '8px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            fontWeight: '500'
          }}>
            Ticket Médio
          </p>
          <p style={{ 
            fontSize: '28px', 
            fontWeight: '200', 
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            {displayOrders.length > 0 ? 
              (totalRevenue / displayOrders.length).toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }) : 'R$ 0'}
          </p>
          <p style={{ fontSize: '9px', color: '#999999', marginTop: '4px' }}>
            por pedido
          </p>
        </div>
      </div>

      {/* Lista de Pedidos - DADOS 100% REAIS DA API */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '500px',
        overflowY: 'auto',
        paddingRight: '8px',
        borderTop: '1px solid rgba(255, 230, 0, 0.1)',
        paddingTop: '24px'
      }}>
        {displayOrders.map((order) => {
          const statusInfo = getStatusStyle(order.status)
          const orderDate = new Date(order.date_created)
          const closeDate = order.date_closed ? new Date(order.date_closed) : null
          const lastUpdate = order.last_updated ? new Date(order.last_updated) : null
          
          // Dados de pagamento REAIS
          const payment = order.payments?.[0]
          const paymentMethod = payment?.payment_method_id
          const paymentStatus = payment?.status
          const paymentStatusDetail = payment?.status_detail
          
          // Dados do comprador REAIS
          const buyerName = order.buyer?.nickname || 
                           `${order.buyer?.first_name || ''} ${order.buyer?.last_name || ''}`.trim() ||
                           'Comprador'
          
          // Calcular valores REAIS do pedido
          const totalFee = order.order_items?.reduce((sum: number, item: any) => sum + (item.sale_fee || 0), 0) || 0
          const shippingCost = payment?.shipping_cost || 0
          const taxesAmount = payment?.taxes_amount || order.taxes?.amount || 0
          
          return (
            <div
              key={order.id}
              style={{
                background: 'rgba(255, 230, 0, 0.02)',
                border: '1px solid rgba(255, 230, 0, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)'
                e.currentTarget.style.borderColor = 'rgba(255, 230, 0, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)'
                e.currentTarget.style.borderColor = 'rgba(255, 230, 0, 0.1)'
              }}
            >
              {/* Order Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#FFFFFF'
                    }}>
                      #{order.id}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      background: `${statusInfo.color}15`,
                      border: `1px solid ${statusInfo.color}30`,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: statusInfo.color,
                      fontWeight: '500'
                    }}>
                      <span>{statusInfo.icon}</span>
                      {statusInfo.label}
                    </span>
                    {/* Pack ID se for pedido de carrinho */}
                    {order.pack_id && (
                      <span style={{
                        padding: '2px 6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '4px',
                        fontSize: '9px',
                        color: '#3B82F6'
                      }}>
                        Carrinho
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontSize: '11px',
                    color: '#666666'
                  }}>
                    Criado: {orderDate.toLocaleDateString('pt-BR')} às {orderDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {closeDate && (
                      <span style={{ marginLeft: '8px', color: '#999999' }}>
                        | Fechado: {closeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontSize: '20px',
                    fontWeight: '300',
                    color: '#FFE600',
                    marginBottom: '2px'
                  }}>
                    {(order.total_amount || 0).toLocaleString('pt-BR', { 
                      style: 'currency', 
                      currency: order.currency_id || 'BRL'
                    })}
                  </p>
                  {/* Valor pago se diferente do total */}
                  {order.paid_amount !== order.total_amount && (
                    <p style={{
                      fontSize: '10px',
                      color: '#4ADE80'
                    }}>
                      Pago: {(order.paid_amount || 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: order.currency_id || 'BRL'
                      })}
                    </p>
                  )}
                  {paymentMethod && (
                    <p style={{
                      fontSize: '10px',
                      color: '#999999'
                    }}>
                      {getPaymentMethodName(paymentMethod)}
                    </p>
                  )}
                  {/* Status do pagamento */}
                  {paymentStatus && paymentStatus !== 'approved' && (
                    <p style={{
                      fontSize: '9px',
                      color: paymentStatus === 'pending' ? '#FFE600' : 
                             paymentStatus === 'rejected' ? '#F87171' : '#999999'
                    }}>
                      Pgto: {paymentStatus}
                    </p>
                  )}
                  {totalFee > 0 && (
                    <p style={{
                      fontSize: '9px',
                      color: '#F87171',
                      marginTop: '2px'
                    }}>
                      Comissão: -{totalFee.toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL'
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div style={{
                borderTop: '1px solid rgba(255, 230, 0, 0.05)',
                paddingTop: '12px',
                marginBottom: '12px'
              }}>
                {order.order_items?.slice(0, 2).map((item: any, index: number) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontSize: '12px',
                        color: '#FFFFFF',
                        marginBottom: '2px'
                      }}>
                        {item.item.title.slice(0, 50)}
                        {item.item.title.length > 50 ? '...' : ''}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <p style={{
                          fontSize: '10px',
                          color: '#666666'
                        }}>
                          {item.quantity} {item.quantity > 1 ? 'unidades' : 'unidade'} × {item.unit_price.toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: item.currency_id || 'BRL'
                          })}
                        </p>
                        {/* Variações do produto */}
                        {item.item.variation_attributes?.map((attr: any, idx: number) => (
                          <span key={idx} style={{
                            fontSize: '9px',
                            color: '#999999',
                            padding: '1px 4px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '3px'
                          }}>
                            {attr.name}: {attr.value_name}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {/* Tipo de anúncio */}
                        {item.listing_type_id && (
                          <span style={{
                            fontSize: '9px',
                            color: '#FFE600',
                            padding: '1px 4px',
                            background: 'rgba(255, 230, 0, 0.1)',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            {getListingTypeName(item.listing_type_id)}
                          </span>
                        )}
                        {/* Condição do produto */}
                        {item.item.condition && (
                          <span style={{
                            fontSize: '9px',
                            color: item.item.condition === 'new' ? '#4ADE80' : '#F59E0B',
                            padding: '1px 4px',
                            background: item.item.condition === 'new' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            borderRadius: '4px'
                          }}>
                            {item.item.condition === 'new' ? 'Novo' : 'Usado'}
                          </span>
                        )}
                        {/* Taxa de venda */}
                        {item.sale_fee > 0 && (
                          <span style={{
                            fontSize: '9px',
                            color: '#F87171',
                            padding: '1px 4px',
                            background: 'rgba(248, 113, 113, 0.1)',
                            borderRadius: '4px'
                          }}>
                            -{item.sale_fee.toLocaleString('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{
                      fontSize: '13px',
                      color: '#999999',
                      marginLeft: '12px'
                    }}>
                      {(item.quantity * item.unit_price).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: item.currency_id || 'BRL'
                      })}
                    </p>
                  </div>
                ))}
                {order.order_items?.length > 2 && (
                  <p style={{
                    fontSize: '10px',
                    color: '#666666',
                    marginTop: '4px'
                  }}>
                    +{order.order_items.length - 2} {order.order_items.length - 2 > 1 ? 'itens' : 'item'}
                  </p>
                )}
              </div>

              {/* Order Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 230, 0, 0.05)',
                paddingTop: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(255, 230, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    color: '#FFE600'
                  }}>
                    {buyerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{
                      fontSize: '11px',
                      color: '#FFFFFF'
                    }}>
                      {buyerName}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      {/* ID do comprador */}
                      {order.buyer?.id && (
                        <p style={{
                          fontSize: '9px',
                          color: '#666666'
                        }}>
                          ID: {order.buyer.id}
                        </p>
                      )}
                      {/* ID do envio */}
                      {order.shipping?.id && (
                        <p style={{
                          fontSize: '9px',
                          color: '#666666'
                        }}>
                          Envio: #{order.shipping.id}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Tags REAIS do pedido da API ML */}
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  flexWrap: 'wrap'
                }}>
                  {/* Tags de entrega */}
                  {order.tags?.includes('delivered') && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(74, 222, 128, 0.1)',
                      border: '1px solid rgba(74, 222, 128, 0.2)',
                      borderRadius: '4px',
                      fontSize: '9px',
                      color: '#4ADE80'
                    }}>
                      Entregue
                    </span>
                  )}
                  {order.tags?.includes('not_delivered') && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(251, 146, 60, 0.1)',
                      border: '1px solid rgba(251, 146, 60, 0.2)',
                      borderRadius: '4px',
                      fontSize: '9px',
                      color: '#FB923C'
                    }}>
                      Não Entregue
                    </span>
                  )}
                  {/* Tags de origem */}
                  {order.tags?.includes('mshops') && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(155, 89, 246, 0.1)',
                      border: '1px solid rgba(155, 89, 246, 0.2)',
                      borderRadius: '4px',
                      fontSize: '9px',
                      color: '#9B59F6'
                    }}>
                      MeShops
                    </span>
                  )}
                  {order.tags?.includes('pack_order') && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '4px',
                      fontSize: '9px',
                      color: '#3B82F6'
                    }}>
                      Carrinho
                    </span>
                  )}
                  {/* Tag de fraude */}
                  {order.tags?.includes('fraud_risk_detected') && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '4px',
                      fontSize: '9px',
                      color: '#EF4444',
                      fontWeight: '600'
                    }}>
                      ⚠ Risco Fraude
                    </span>
                  )}
                  {/* Tag de teste */}
                  {order.tags?.includes('test_order') && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(156, 163, 175, 0.1)',
                      border: '1px solid rgba(156, 163, 175, 0.2)',
                      borderRadius: '4px',
                      fontSize: '9px',
                      color: '#9CA3AF'
                    }}>
                      Teste
                    </span>
                  )}
                  {/* Canal de venda */}
                  {order.context?.channel && order.context.channel !== 'marketplace' && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(255, 230, 0, 0.1)',
                      border: '1px solid rgba(255, 230, 0, 0.2)',
                      borderRadius: '4px',
                      fontSize: '9px',
                      color: '#FFE600'
                    }}>
                      {order.context.channel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Load More */}
      {orders.length > 10 && (
        <div style={{
          textAlign: 'center',
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 230, 0, 0.1)'
        }}>
          <p style={{
            fontSize: '11px',
            color: '#666666'
          }}>
            Mostrando 10 de {orders.length} pedidos
          </p>
        </div>
      )}
    </div>
  )
}
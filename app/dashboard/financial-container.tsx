import React from 'react'

export function FinancialContainer({ financialSummary }: any) {
  if (!financialSummary) return null

  return (
    <div className="container-financeiro">
      {/* Header */}
      <div className="container-header">
        <div className="container-title-wrapper">
          <h3 className="container-title">Central Financeira</h3>
        </div>
        <div className="container-action-hint">
          {financialSummary.revenue?.growthRate7Days > 0 ? '↑' : '↓'} {Math.abs(financialSummary.revenue?.growthRate7Days || 0).toFixed(1)}% vs 7 dias
        </div>
      </div>

      {/* Main Revenue Metrics - 4 columns optimized */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="metric-box">
          <p className="metric-box-label">Faturamento Bruto</p>
          <p className="metric-box-value">
            {financialSummary.revenue?.gross30Days ? 
              Math.round(financialSummary.revenue.gross30Days).toLocaleString('pt-BR') : 
              'N/A'}
          </p>
          <p className="metric-box-sub">Últimos 30 dias</p>
        </div>

        <div className="metric-box">
          <p className="metric-box-label">Receita Líquida</p>
          <p className="metric-box-value">
            {financialSummary.revenue?.net30Days ? 
              Math.round(financialSummary.revenue.net30Days).toLocaleString('pt-BR') : 
              'N/A'}
          </p>
          <p className="metric-box-sub">Margem: {financialSummary.fees?.netMargin?.toFixed(1) || 'N/A'}%</p>
        </div>

        <div className="metric-box">
          <p className="metric-box-label">Vendas Hoje</p>
          <p className="metric-box-value">
            {financialSummary.revenue?.grossToday ? 
              Math.round(financialSummary.revenue.grossToday).toLocaleString('pt-BR') : 
              'N/A'}
          </p>
          <p className="metric-box-sub">{financialSummary.orders?.totalToday || 0} pedidos</p>
        </div>

        <div className="metric-box">
          <p className="metric-box-label">Projeção Mensal</p>
          <p className="metric-box-value">
            {financialSummary.revenue?.projectedMonthly ? 
              Math.round(financialSummary.revenue.projectedMonthly).toLocaleString('pt-BR') : 
              'N/A'}
          </p>
          <p className="metric-box-sub">~{financialSummary.orders?.projectedMonthly || 0} vendas</p>
        </div>
      </div>

      {/* Details Section */}
      <div className="container-details">
        {/* Fees and Taxes Analysis */}
        <div className="detail-section">
          <p className="detail-section-title">Análise de Custos e Taxas</p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '11px',
                color: '#666666',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px'
              }}>Comissões ML</p>
              <p style={{
                fontSize: '24px',
                fontWeight: '300',
                color: '#FFFFFF',
                margin: '0 0 8px 0'
              }}>
                R$ {financialSummary.fees?.totalFees30Days?.toFixed(2) || 'N/A'}
              </p>
              <p style={{
                fontSize: '10px',
                color: '#999999'
              }}>
                Taxa: {financialSummary.fees?.effectiveRate?.toFixed(1) || 'N/A'}%
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '11px',
                color: '#666666',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px'
              }}>Impostos</p>
              <p style={{
                fontSize: '24px',
                fontWeight: '300',
                color: '#FFFFFF',
                margin: '0 0 8px 0'
              }}>
                R$ {financialSummary.fees?.totalPerceptions?.toFixed(2) || 'N/A'}
              </p>
              <p style={{
                fontSize: '10px',
                color: '#999999'
              }}>
                ICMS, IVA e outros
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '11px',
                color: '#666666',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px'
              }}>Bonificações</p>
              <p style={{
                fontSize: '24px',
                fontWeight: '300',
                color: '#FFFFFF',
                margin: '0 0 8px 0'
              }}>
                R$ {financialSummary.fees?.totalBonuses?.toFixed(2) || 'N/A'}
              </p>
              <p style={{
                fontSize: '10px',
                color: '#999999'
              }}>
                Descontos recebidos
              </p>
            </div>
          </div>

          {/* Pending Payments */}
          <div style={{
            padding: '20px',
            background: 'rgba(255, 230, 0, 0.03)',
            border: '1px solid rgba(255, 230, 0, 0.1)',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <p style={{
                fontSize: '11px',
                color: '#666666',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px'
              }}>Valores a Receber</p>
              <p style={{
                fontSize: '28px',
                fontWeight: '200',
                background: 'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}>
                R$ {financialSummary.payments?.totalPending?.toFixed(2) || 'N/A'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontSize: '11px',
                color: '#666666',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '4px'
              }}>Liberação Média</p>
              <p style={{
                fontSize: '20px',
                fontWeight: '300',
                color: '#FFFFFF'
              }}>
                ~{financialSummary.payments?.avgReleasedays || 'N/A'} dias
              </p>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="detail-section">
          <p className="detail-section-title">Indicadores de Performance</p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ fontSize: '11px', color: '#999999', marginBottom: '4px' }}>Velocidade de Vendas</p>
                <p style={{ fontSize: '24px', fontWeight: '300', color: '#FFE600', margin: 0 }}>
                  {financialSummary.orders?.salesVelocity?.toFixed(1) || 'N/A'}
                </p>
                <p style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>vendas/dia</p>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ fontSize: '11px', color: '#999999', marginBottom: '4px' }}>Taxa de Conversão</p>
                <p style={{ fontSize: '24px', fontWeight: '300', color: '#FFE600', margin: 0 }}>
                  {financialSummary.orders?.conversionRate?.toFixed(2) || 'N/A'}%
                </p>
                <p style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>visitas → vendas</p>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ fontSize: '11px', color: '#999999', marginBottom: '4px' }}>Ticket Médio</p>
                <p style={{ fontSize: '24px', fontWeight: '300', color: '#FFE600', margin: 0 }}>
                  R$ {financialSummary.revenue?.avgTicket?.toFixed(2) || 'N/A'}
                </p>
                <p style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>por venda</p>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ fontSize: '11px', color: '#999999', marginBottom: '4px' }}>Visitas Totais</p>
                <p style={{ fontSize: '24px', fontWeight: '300', color: '#FFE600', margin: 0 }}>
                  {financialSummary.visits?.total30Days?.toLocaleString('pt-BR') || 'N/A'}
                </p>
                <p style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>últimos 30 dias</p>
              </div>
            </div>
          </div>

          <div className="detail-row">
            <span className="detail-label">Vendas (30 dias)</span>
            <span className="detail-value">{financialSummary.orders?.total30Days || 'N/A'}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Vendas (7 dias)</span>
            <span className="detail-value">{financialSummary.orders?.total7Days || 'N/A'}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Receita (7 dias)</span>
            <span className="detail-value">R$ {financialSummary.revenue?.gross7Days ? 
              Math.round(financialSummary.revenue.gross7Days).toLocaleString('pt-BR') : 'N/A'}</span>
          </div>
        </div>
        {/* Insights and Recommendations */}
        {financialSummary.insights?.recommendations?.length > 0 && (
          <div className="detail-section">
            <p className="detail-section-title">Insights e Recomendações</p>
            
            {financialSummary.insights.recommendations.map((rec: string, index: number) => (
              <div key={index} style={{
                padding: '12px 16px',
                background: 'rgba(255, 230, 0, 0.03)',
                border: '1px solid rgba(255, 230, 0, 0.1)',
                borderRadius: '8px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  background: '#FFE600',
                  borderRadius: '50%',
                  flexShrink: 0
                }}></div>
                <p style={{
                  fontSize: '13px',
                  color: '#FFFFFF',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  {rec}
                </p>
              </div>
            ))}
          </div>
        )}
        
        {/* Payment Methods */}
        {financialSummary.payments?.methodsBreakdown && Object.keys(financialSummary.payments.methodsBreakdown).length > 0 && (
          <div className="detail-section">
            <p className="detail-section-title">Mix de Pagamentos</p>
            {Object.entries(financialSummary.payments.methodsBreakdown).map(([method, count]: [string, any]) => (
              <div key={method} className="detail-row">
                <span className="detail-label">{method}</span>
                <span className="detail-value">{count} transações</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
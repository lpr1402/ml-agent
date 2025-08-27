import React from 'react'

export function ReputationContainer({ reputationMetrics }: any) {
  if (!reputationMetrics) return null

  // Determinar cor e status do termômetro
  const getThermometerInfo = () => {
    const level = reputationMetrics.reputation?.level || reputationMetrics.thermometer?.level
    if (!level) return { color: '#666666', label: 'Sem vendas', value: 0, status: 'newbie' }
    
    switch(level) {
      case '5_green':
        return { color: '#10B981', label: 'Verde', value: 100, status: 'excellent' }
      case '4_light_green':
        return { color: '#4ADE80', label: 'Verde Claro', value: 80, status: 'good' }
      case '3_yellow':
        return { color: '#FFE600', label: 'Amarelo', value: 60, status: 'regular' }
      case '2_orange':
        return { color: '#F59E0B', label: 'Laranja', value: 40, status: 'attention' }
      case '1_red':
        return { color: '#EF4444', label: 'Vermelho', value: 20, status: 'critical' }
      default:
        return { color: '#666666', label: 'Sem vendas', value: 0, status: 'newbie' }
    }
  }

  const thermometer = getThermometerInfo()

  // Determinar se é MercadoLíder
  const getMercadoLiderBadge = () => {
    const status = reputationMetrics.reputation?.powerSeller
    if (!status) return null
    
    const badges = {
      'platinum': { color: '#E5E7EB', label: 'Platinum', gradient: 'linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)' },
      'gold': { color: '#FFE600', label: 'Gold', gradient: 'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)' },
      'silver': { color: '#D1D5DB', label: 'Silver', gradient: 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)' }
    }
    
    return badges[status] || null
  }

  const mercadoLider = getMercadoLiderBadge()

  // Calcular saúde geral da reputação
  const calculateHealthScore = () => {
    const claims = reputationMetrics.metrics?.claims?.rate || 0
    const delays = reputationMetrics.metrics?.delays?.rate || 0
    const cancellations = reputationMetrics.metrics?.cancellations?.rate || 0
    
    // Score baseado nos limites do MLB (mais rigorosos)
    let score = 100
    
    // Penalização por reclamações (peso maior)
    if (claims > 8) score -= 40
    else if (claims > 4.5) score -= 25
    else if (claims > 2) score -= 15
    else if (claims > 1) score -= 10
    
    // Penalização por atrasos
    if (delays > 22) score -= 30
    else if (delays > 18) score -= 20
    else if (delays > 10) score -= 10
    else if (delays > 6) score -= 5
    
    // Penalização por cancelamentos
    if (cancellations > 4) score -= 30
    else if (cancellations > 3.5) score -= 20
    else if (cancellations > 1.5) score -= 10
    else if (cancellations > 0.5) score -= 5
    
    return Math.max(0, score)
  }

  const healthScore = calculateHealthScore()

  return (
    <div className="container-reputation" style={{
      background: 'linear-gradient(135deg, #111111 0%, #0A0A0A 100%)',
      border: '1px solid rgba(255, 230, 0, 0.1)',
      borderRadius: '20px',
      padding: '32px',
      cursor: 'default',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Glow Effect */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255, 230, 0, 0.03) 0%, transparent 70%)',
        pointerEvents: 'none',
        opacity: 0.8
      }}></div>

      {/* Header */}
      <div className="container-header" style={{ 
        marginBottom: '28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div className="container-title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 className="container-title" style={{
            fontSize: '24px',
            fontWeight: '300',
            letterSpacing: '0.1em',
            textTransform: 'none',
            color: '#FFE600',
            margin: 0
          }}>Reputação</h3>
          
          {/* Termômetro Badge */}
          <div style={{
            padding: '6px 12px',
            background: `${thermometer.color}15`,
            border: `1px solid ${thermometer.color}30`,
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: thermometer.color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {thermometer.label}
            </span>
          </div>
        </div>
        
        {/* MercadoLíder Badge */}
        {mercadoLider && (
          <div style={{
            padding: '8px 16px',
            background: mercadoLider.gradient,
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#0A0A0A',
              textTransform: 'none',
              letterSpacing: '0.05em'
            }}>
              MercadoLíder {mercadoLider.label}
            </span>
          </div>
        )}
      </div>

      {/* Main Metrics Grid - 4 columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="metric-box">
          <p className="metric-box-label" style={{
            fontSize: '10px',
            color: '#666666',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
            fontWeight: '500'
          }}>Saúde Geral</p>
          <p className="metric-box-value" style={{
            fontSize: '32px',
            fontWeight: '200',
            letterSpacing: '-0.02em',
            color: healthScore >= 80 ? '#10B981' :
                   healthScore >= 60 ? '#FFE600' :
                   healthScore >= 40 ? '#F59E0B' : '#EF4444',
            margin: '0 0 8px 0'
          }}>
            {healthScore}%
          </p>
          <p className="metric-box-sub" style={{
            fontSize: '10px',
            color: '#999999'
          }}>
            Score de qualidade
          </p>
        </div>
        
        <div className="metric-box">
          <p className="metric-box-label" style={{
            fontSize: '10px',
            color: '#666666',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
            fontWeight: '500'
          }}>Vendas Completas</p>
          <p className="metric-box-value" style={{
            fontSize: '32px',
            fontWeight: '200',
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            margin: '0 0 8px 0'
          }}>
            {reputationMetrics.transactions?.completed ?? 'N/A'}
          </p>
          <p className="metric-box-sub" style={{
            fontSize: '10px',
            color: '#999999'
          }}>
            {reputationMetrics.transactions?.period === 'historic' ? 'Histórico total' : 
             reputationMetrics.transactions?.period || 'N/A'}
          </p>
        </div>
        
        <div className="metric-box">
          <p className="metric-box-label" style={{
            fontSize: '10px',
            color: '#666666',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
            fontWeight: '500'
          }}>Taxa de Sucesso</p>
          <p className="metric-box-value" style={{
            fontSize: '32px',
            fontWeight: '200',
            letterSpacing: '-0.02em',
            color: reputationMetrics.transactions?.completed && reputationMetrics.transactions?.total ?
                   ((reputationMetrics.transactions.completed / reputationMetrics.transactions.total) * 100) >= 95 ? '#10B981' :
                   ((reputationMetrics.transactions.completed / reputationMetrics.transactions.total) * 100) >= 90 ? '#FFE600' :
                   '#F59E0B' : '#999999',
            margin: '0 0 8px 0'
          }}>
            {reputationMetrics.transactions?.completed && reputationMetrics.transactions?.total ?
              `${((reputationMetrics.transactions.completed / reputationMetrics.transactions.total) * 100).toFixed(1)}%` : 'N/A'}
          </p>
          <p className="metric-box-sub" style={{
            fontSize: '10px',
            color: '#999999'
          }}>
            Vendas concretizadas
          </p>
        </div>

        <div className="metric-box">
          <p className="metric-box-label" style={{
            fontSize: '10px',
            color: '#666666',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
            fontWeight: '500'
          }}>Avaliações Positivas</p>
          <p className="metric-box-value" style={{
            fontSize: '32px',
            fontWeight: '200',
            letterSpacing: '-0.02em',
            color: reputationMetrics.transactions?.ratings?.positive >= 95 ? '#10B981' :
                   reputationMetrics.transactions?.ratings?.positive >= 85 ? '#FFE600' :
                   reputationMetrics.transactions?.ratings?.positive ? '#F59E0B' : '#999999',
            margin: '0 0 8px 0'
          }}>
            {reputationMetrics.transactions?.ratings?.positive ? 
              `${reputationMetrics.transactions.ratings.positive.toFixed(0)}%` : 'N/A'}
          </p>
          <p className="metric-box-sub" style={{
            fontSize: '10px',
            color: '#999999'
          }}>
            Do total de avaliações
          </p>
        </div>
      </div>

      {/* Métricas de Qualidade Detalhadas */}
      <div className="container-details" style={{
        borderTop: '1px solid rgba(255, 230, 0, 0.1)',
        paddingTop: '24px'
      }}>
        {/* Métricas Críticas */}
        <div className="detail-section" style={{ marginBottom: '24px' }}>
          <p className="detail-section-title" style={{
            fontSize: '11px',
            fontWeight: '300',
            color: '#FFE600',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: '16px'
          }}>Métricas de Qualidade ({reputationMetrics.metrics?.sales?.period || '60 dias'})</p>
          
          {/* Grid de métricas críticas */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* Reclamações */}
            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              position: 'relative'
            }}>
              {/* Indicador de status */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: (reputationMetrics.metrics?.claims?.rate || 0) <= 1 ? '#10B981' :
                           (reputationMetrics.metrics?.claims?.rate || 0) <= 2 ? '#FFE600' :
                           (reputationMetrics.metrics?.claims?.rate || 0) <= 4.5 ? '#F59E0B' : '#EF4444'
              }}></div>
              
              <p style={{ fontSize: '10px', color: '#999999', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reclamações
              </p>
              <p style={{ 
                fontSize: '24px', 
                fontWeight: '300', 
                color: (reputationMetrics.metrics?.claims?.rate || 0) <= 1 ? '#10B981' :
                       (reputationMetrics.metrics?.claims?.rate || 0) <= 2 ? '#FFE600' :
                       (reputationMetrics.metrics?.claims?.rate || 0) <= 4.5 ? '#F59E0B' : '#EF4444',
                margin: '0 0 4px 0' 
              }}>
                {reputationMetrics.metrics?.claims?.rate?.toFixed(1) || '0.0'}%
              </p>
              <p style={{ fontSize: '9px', color: '#666666' }}>
                {reputationMetrics.metrics?.claims?.value || 0} casos
              </p>
              {/* Limite para MercadoLíder */}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 230, 0, 0.05)' }}>
                <p style={{ fontSize: '9px', color: '#666666' }}>
                  Limite ML: ≤1%
                </p>
              </div>
            </div>

            {/* Cancelamentos */}
            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              position: 'relative'
            }}>
              {/* Indicador de status */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: (reputationMetrics.metrics?.cancellations?.rate || 0) <= 0.5 ? '#10B981' :
                           (reputationMetrics.metrics?.cancellations?.rate || 0) <= 1.5 ? '#FFE600' :
                           (reputationMetrics.metrics?.cancellations?.rate || 0) <= 3.5 ? '#F59E0B' : '#EF4444'
              }}></div>
              
              <p style={{ fontSize: '10px', color: '#999999', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cancelamentos
              </p>
              <p style={{ 
                fontSize: '24px', 
                fontWeight: '300',
                color: (reputationMetrics.metrics?.cancellations?.rate || 0) <= 0.5 ? '#10B981' :
                       (reputationMetrics.metrics?.cancellations?.rate || 0) <= 1.5 ? '#FFE600' :
                       (reputationMetrics.metrics?.cancellations?.rate || 0) <= 3.5 ? '#F59E0B' : '#EF4444',
                margin: '0 0 4px 0' 
              }}>
                {reputationMetrics.metrics?.cancellations?.rate?.toFixed(1) || '0.0'}%
              </p>
              <p style={{ fontSize: '9px', color: '#666666' }}>
                {reputationMetrics.metrics?.cancellations?.value || 0} casos
              </p>
              {/* Limite para MercadoLíder */}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 230, 0, 0.05)' }}>
                <p style={{ fontSize: '9px', color: '#666666' }}>
                  Limite ML: ≤0.5%
                </p>
              </div>
            </div>

            {/* Atrasos na Entrega */}
            <div style={{
              background: 'rgba(255, 230, 0, 0.03)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              position: 'relative'
            }}>
              {/* Indicador de status */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: (reputationMetrics.metrics?.delays?.rate || 0) <= 6 ? '#10B981' :
                           (reputationMetrics.metrics?.delays?.rate || 0) <= 10 ? '#FFE600' :
                           (reputationMetrics.metrics?.delays?.rate || 0) <= 18 ? '#F59E0B' : '#EF4444'
              }}></div>
              
              <p style={{ fontSize: '10px', color: '#999999', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Atrasos na Entrega
              </p>
              <p style={{ 
                fontSize: '24px', 
                fontWeight: '300',
                color: (reputationMetrics.metrics?.delays?.rate || 0) <= 6 ? '#10B981' :
                       (reputationMetrics.metrics?.delays?.rate || 0) <= 10 ? '#FFE600' :
                       (reputationMetrics.metrics?.delays?.rate || 0) <= 18 ? '#F59E0B' : '#EF4444',
                margin: '0 0 4px 0' 
              }}>
                {reputationMetrics.metrics?.delays?.rate?.toFixed(1) || '0.0'}%
              </p>
              <p style={{ fontSize: '9px', color: '#666666' }}>
                {reputationMetrics.metrics?.delays?.value || 0} envios
              </p>
              {/* Limite para MercadoLíder */}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 230, 0, 0.05)' }}>
                <p style={{ fontSize: '9px', color: '#666666' }}>
                  Limite ML: ≤6%
                </p>
              </div>
            </div>
          </div>

          {/* Resumo de Vendas */}
          <div className="detail-row" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid rgba(255, 230, 0, 0.05)'
          }}>
            <span className="detail-label" style={{
              fontSize: '12px',
              color: '#999999'
            }}>Vendas Concretizadas ({reputationMetrics.metrics?.sales?.period?.replace(' days', ' dias') || 'período'})</span>
            <span className="detail-value" style={{
              fontSize: '16px',
              fontWeight: '300',
              color: '#FFFFFF'
            }}>
              {reputationMetrics.metrics?.sales?.completed ?? 'N/A'} vendas
            </span>
          </div>
          
          <div className="detail-row" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid rgba(255, 230, 0, 0.05)'
          }}>
            <span className="detail-label" style={{
              fontSize: '12px',
              color: '#999999'
            }}>Vendas Canceladas (histórico)</span>
            <span className="detail-value" style={{
              fontSize: '16px',
              fontWeight: '300',
              color: reputationMetrics.transactions?.canceled > 0 ? '#F59E0B' : '#999999'
            }}>
              {reputationMetrics.transactions?.canceled ?? 'N/A'}
            </span>
          </div>
          
          <div className="detail-row" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid rgba(255, 230, 0, 0.05)'
          }}>
            <span className="detail-label" style={{
              fontSize: '12px',
              color: '#999999'
            }}>Total de Transações (histórico)</span>
            <span className="detail-value" style={{
              fontSize: '16px',
              fontWeight: '300',
              color: '#FFFFFF'
            }}>
              {reputationMetrics.transactions?.total ?? 'N/A'}
            </span>
          </div>

          {/* Breakdown de Avaliações */}
          {reputationMetrics.transactions?.ratings && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: 'rgba(255, 230, 0, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 230, 0, 0.1)'
            }}>
              <p style={{ fontSize: '11px', color: '#FFE600', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Distribuição de Avaliações
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: '300', color: '#10B981', marginBottom: '4px' }}>
                    {reputationMetrics.transactions.ratings.positive?.toFixed(0) || 0}%
                  </p>
                  <p style={{ fontSize: '10px', color: '#666666' }}>Positivas</p>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: '300', color: '#FFE600', marginBottom: '4px' }}>
                    {reputationMetrics.transactions.ratings.neutral?.toFixed(0) || 0}%
                  </p>
                  <p style={{ fontSize: '10px', color: '#666666' }}>Neutras</p>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: '300', color: '#EF4444', marginBottom: '4px' }}>
                    {reputationMetrics.transactions.ratings.negative?.toFixed(0) || 0}%
                  </p>
                  <p style={{ fontSize: '10px', color: '#666666' }}>Negativas</p>
                </div>
              </div>
            </div>
          )}

          {/* Status de Proteção */}
          {reputationMetrics.reputation?.protected && (
            <div style={{
              marginTop: '20px',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '14px', color: '#3B82F6' }}>🛡️</span>
              <div>
                <p style={{ fontSize: '12px', color: '#FFFFFF', marginBottom: '4px' }}>
                  Reputação Protegida
                </p>
                <p style={{ fontSize: '10px', color: '#999999' }}>
                  Proteção até: {new Date(reputationMetrics.reputation.protectionEndDate).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
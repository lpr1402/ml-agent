import React from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'

interface AnunciosContainerProps {
  metrics: any
  advancedMetrics: any
  salesVelocity: any
  itemsVisits: any
  conversionMetrics: any
}

export function AnunciosContainer({ 
  metrics, 
  advancedMetrics, 
  salesVelocity, 
  itemsVisits,
  conversionMetrics 
}: AnunciosContainerProps) {
  const router = useRouter()
  
  // Calcular métricas de anúncios parados
  const totalActive = metrics?.items?.active || 0
  const totalSold = metrics?.items?.sold_quantity || 0
  const stalledItems = totalActive > 0 && salesVelocity?.topProducts?.length === 0
  
  return (
    <div 
      onClick={() => router.push("/anuncios")}
      className="container-anuncios"
    >
      {/* Header */}
      <div className="container-header">
        <div className="container-title-wrapper">
          <h3 className="container-title">Meus Anúncios</h3>
        </div>
        <div className="container-action-hint">
          Gerenciar →
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="container-metrics-grid">
        <div className="metric-box">
          <p className="metric-box-label">Ativos</p>
          <p className="metric-box-value">
            {totalActive}
          </p>
          {stalledItems && (
            <p className="metric-box-sub" style={{color: '#F87171'}}>
              ⚠ Sem vendas recentes
            </p>
          )}
        </div>
        <div className="metric-box">
          <p className="metric-box-label">Vendidos (30d)</p>
          <p className="metric-box-value">
            {totalSold}
          </p>
        </div>
        <div className="metric-box">
          <p className="metric-box-label">Conversão</p>
          <p className="metric-box-value">
            {formatPercentage(metrics?.visits?.conversionRate || 0)}
          </p>
        </div>
      </div>

      {/* Análise Avançada */}
      <div className="container-details">
        {/* Velocidade de Vendas e Receita */}
        <div className="detail-section">
          <p className="detail-section-title">Performance Financeira</p>
          
          <div className="detail-row">
            <span className="detail-label">Receita Hoje</span>
            <span className="detail-value highlight">
              {advancedMetrics?.metrics?.salesVelocity?.today?.revenue 
                ? `R$ ${advancedMetrics.metrics.salesVelocity.today.revenue}` 
                : 'N/A'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Receita (7 dias)</span>
            <span className="detail-value">
              {advancedMetrics?.metrics?.salesVelocity?.last7Days?.revenue 
                ? `R$ ${advancedMetrics.metrics.salesVelocity.last7Days.revenue}` 
                : 'N/A'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Ticket Médio</span>
            <span className="detail-value">
              {advancedMetrics?.metrics?.salesVelocity?.averages?.ticketSize 
                ? `R$ ${advancedMetrics.metrics.salesVelocity.averages.ticketSize}` 
                : 'N/A'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Crescimento</span>
            <span className={`detail-value ${
              parseFloat(advancedMetrics?.metrics?.salesVelocity?.patterns?.growthRate || '0') >= 0 
                ? 'positive' : 'negative'
            }`}>
              {advancedMetrics?.metrics?.salesVelocity?.patterns?.growthRate || 'N/A'}
            </span>
          </div>
        </div>

        {/* Análise de Qualidade */}
        {advancedMetrics?.metrics?.quality && (
          <div className="detail-section">
            <p className="detail-section-title">Saúde dos Anúncios</p>
            
            <div className="detail-row">
              <span className="detail-label">Score de Qualidade</span>
              <span className={`detail-value ${
                advancedMetrics.metrics.quality.overallScore >= 70 
                  ? 'positive' 
                  : advancedMetrics.metrics.quality.overallScore >= 40 
                    ? 'highlight' 
                    : 'negative'
              }`}>
                {advancedMetrics.metrics.quality.overallScore}/100
              </span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Anúncios Premium</span>
              <span className="detail-value">
                {advancedMetrics.metrics.quality.metrics.premiumListings.percentage}%
              </span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Com Frete</span>
              <span className="detail-value">
                {advancedMetrics.metrics.quality.metrics.withShipping.percentage}%
              </span>
            </div>
            
            {advancedMetrics.metrics.quality.recommendations?.[0] && (
              <div className="detail-row">
                <span className="detail-label">Ação Prioritária</span>
                <span className="detail-value" style={{fontSize: '11px'}}>
                  {advancedMetrics.metrics.quality.recommendations[0].action}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Análise Competitiva */}
        {advancedMetrics?.metrics?.competitive?.items?.[0] && (
          <div className="detail-section">
            <p className="detail-section-title">Posição no Mercado</p>
            {advancedMetrics.metrics.competitive.items.slice(0, 2).map((item: any, idx: number) => (
              <div key={idx}>
                <div className="detail-row">
                  <span className="detail-label" style={{fontSize: '11px'}}>
                    {item.title}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Seu Preço vs Média</span>
                  <span className={`detail-value ${
                    item.marketAnalysis.pricePosition === 'below_average' 
                      ? 'positive' 
                      : item.marketAnalysis.pricePosition === 'above_average'
                        ? 'negative'
                        : ''
                  }`}>
                    {item.marketAnalysis.priceCompetitiveness}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface CentralContainerProps {
  questions: any
  responseTime: any
  attendanceMetrics: any
  conversionMetrics: any
}

export function CentralContainer({ 
  questions, 
  responseTime, 
  attendanceMetrics,
  conversionMetrics 
}: CentralContainerProps) {
  const router = useRouter()
  
  return (
    <div 
      onClick={() => router.push("/agente")}
      className="container-central"
    >
      {/* Header */}
      <div className="container-header">
        <div className="container-title-wrapper">
          <h3 className="container-title">Central de Atendimento</h3>
        </div>
        <div className="container-action-hint">
          Responder →
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="container-metrics-grid">
        <div className="metric-box">
          <p className="metric-box-label">Urgentes</p>
          <p className="metric-box-value">
            {attendanceMetrics?.metrics?.priority?.critical || 0}
          </p>
          {attendanceMetrics?.metrics?.priority?.critical > 0 && (
            <p className="metric-box-sub" style={{color: '#F87171'}}>
              Cliente VIP esperando
            </p>
          )}
        </div>
        <div className="metric-box">
          <p className="metric-box-label">Pendentes</p>
          <p className="metric-box-value">
            {attendanceMetrics?.metrics?.priority?.total || questions?.stats?.unanswered || 0}
          </p>
        </div>
        <div className="metric-box">
          <p className="metric-box-label">Taxa Conv.</p>
          <p className="metric-box-value">
            {attendanceMetrics?.metrics?.effectiveness?.conversionRate || '0'}%
          </p>
        </div>
      </div>

      {/* Análise Detalhada */}
      <div className="container-details">
        {/* Perguntas de Alto Valor */}
        {attendanceMetrics?.metrics?.priority?.questions && 
         attendanceMetrics.metrics.priority.questions.length > 0 && (
          <div className="detail-section">
            <p className="detail-section-title">Perguntas Prioritárias</p>
            {attendanceMetrics.metrics.priority.questions.slice(0, 2).map((q: any, idx: number) => (
              <div key={idx} className="question-item">
                <p className="question-text">
                  "{q.text?.substring(0, 80)}..."
                </p>
                <div className="question-meta">
                  <span style={{
                    color: q.priority === 'critical' ? '#F87171' : 
                           q.priority === 'high' ? '#FFE600' : '#666666',
                    fontSize: '11px'
                  }}>
                    {q.reason}
                  </span>
                  <span className="question-date">
                    {q.hoursWaiting}h esperando
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Perda por Não Responder */}
        {attendanceMetrics?.metrics?.lostRevenue && (
          <div className="detail-section">
            <p className="detail-section-title">Impacto Financeiro</p>
            
            <div className="detail-row">
              <span className="detail-label">Perda Estimada (30d)</span>
              <span className="detail-value negative">
                R$ {attendanceMetrics.metrics.lostRevenue.estimatedLoss || '0'}
              </span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Perguntas Expiradas</span>
              <span className="detail-value">
                {attendanceMetrics.metrics.lostRevenue.expiredQuestions || 0}
              </span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Perda Diária</span>
              <span className="detail-value negative">
                R$ {attendanceMetrics?.metrics?.summary?.estimatedDailyLoss || '0'}
              </span>
            </div>
          </div>
        )}

        {/* Padrões e Insights */}
        {attendanceMetrics?.metrics?.patterns && (
          <div className="detail-section">
            <p className="detail-section-title">Análise de Padrões</p>
            
            <div className="detail-row">
              <span className="detail-label">Pico de Perguntas</span>
              <span className="detail-value">
                {attendanceMetrics.metrics.patterns.peakHour || 'N/A'}
              </span>
            </div>
            
            {attendanceMetrics.metrics.patterns.topConcerns?.[0] && (
              <div className="detail-row">
                <span className="detail-label">Principal Dúvida</span>
                <span className="detail-value">
                  {attendanceMetrics.metrics.patterns.topConcerns[0].keyword} ({attendanceMetrics.metrics.patterns.topConcerns[0].percentage}%)
                </span>
              </div>
            )}
            
            <div className="detail-row">
              <span className="detail-label">Média/Dia</span>
              <span className="detail-value">
                {attendanceMetrics.metrics.patterns.avgPerDay || '0'} perguntas
              </span>
            </div>
          </div>
        )}

        {/* Health Score */}
        {attendanceMetrics?.metrics?.summary?.overallHealth && (
          <div className="status-indicator">
            <div className="status-info">
              <div 
                className="status-dot" 
                style={{
                  background: attendanceMetrics.metrics.summary.overallHealth.color
                }}
              ></div>
              <span className="status-text">
                Score: {attendanceMetrics.metrics.summary.overallHealth.score}/100
              </span>
            </div>
            <span className="status-badge">
              {attendanceMetrics.metrics.summary.overallHealth.status === 'excellent' ? 'Excelente' :
               attendanceMetrics.metrics.summary.overallHealth.status === 'good' ? 'Bom' :
               attendanceMetrics.metrics.summary.overallHealth.status === 'attention' ? 'Atenção' :
               'Crítico'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
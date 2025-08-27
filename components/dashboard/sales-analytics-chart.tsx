"use client"

import React from 'react'
import {
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
  Line
} from "recharts"

interface SalesAnalyticsChartProps {
  data: any
}

export function SalesAnalyticsChart({ data }: SalesAnalyticsChartProps) {
  if (!data) return null

  // Função para determinar status da tendência
  const getTrendStatus = (trend: string) => {
    switch(trend) {
      case 'Bull':
      case 'Bullish':
        return { label: 'Em Alta', color: '#4ADE80', description: 'Vendas crescendo' }
      case 'Bear':
      case 'Bearish':
        return { label: 'Em Baixa', color: '#F87171', description: 'Vendas caindo' }
      case 'Stable':
        return { label: 'Estável', color: '#FFE600', description: 'Vendas constantes' }
      default:
        return { label: 'Estável', color: '#FFE600', description: 'Vendas constantes' }
    }
  }

  const trendInfo = getTrendStatus(data.insights?.trends?.marketTrend)

  // Determinar cor da projeção baseada na tendência
  const getProjectionColor = () => {
    const projection7Days = data.insights?.trends?.projection7Days || 0
    const last7DaysRevenue = data.summary?.last7Days?.revenue || 0
    
    if (projection7Days > last7DaysRevenue * 1.1) return '#4ADE80' // Verde se crescimento > 10%
    if (projection7Days < last7DaysRevenue * 0.9) return '#F87171' // Vermelho se queda > 10%
    return '#FFE600' // Amarelo se estável
  }

  return (
    <div className="container-vendas-chart">
      {/* Header */}
      <div className="container-header">
        <div className="container-title-wrapper">
          <h3 className="container-title">Análise de Vendas</h3>
        </div>
        {/* Trend Status Badge - Right aligned */}
        <div style={{
          padding: '6px 12px',
          background: trendInfo.color === '#4ADE80' ? 'rgba(74, 222, 128, 0.1)' :
                     trendInfo.color === '#F87171' ? 'rgba(248, 113, 113, 0.1)' :
                     'rgba(255, 230, 0, 0.1)',
          border: `1px solid ${trendInfo.color}30`,
          borderRadius: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: trendInfo.color,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {trendInfo.label}
          </span>
        </div>
      </div>

      {/* Main Metrics - 4 columns optimized */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="metric-box">
          <p className="metric-box-label">Vendas Hoje</p>
          <p className="metric-box-value">
            {data.summary?.today?.sales || 0}
          </p>
          <p className="metric-box-sub" style={{
            color: data.summary?.today?.vsYesterday?.sales > 0 ? '#4ADE80' : 
                   data.summary?.today?.vsYesterday?.sales < 0 ? '#F87171' : '#999999'
          }}>
            {data.summary?.today?.vsYesterday?.sales > 0 ? '↑' : 
             data.summary?.today?.vsYesterday?.sales < 0 ? '↓' : '='} 
            {Math.abs(data.summary?.today?.vsYesterday?.sales || 0).toFixed(0)}% vs ontem
          </p>
        </div>

        <div className="metric-box">
          <p className="metric-box-label">Faturamento Hoje</p>
          <p className="metric-box-value">
            {data.summary?.today?.revenue ? 
              Math.round(data.summary.today.revenue).toLocaleString('pt-BR') : '0'}
          </p>
          <p className="metric-box-sub" style={{
            color: data.summary?.today?.vsYesterday?.revenue > 0 ? '#4ADE80' : 
                   data.summary?.today?.vsYesterday?.revenue < 0 ? '#F87171' : '#999999'
          }}>
            {data.summary?.today?.vsYesterday?.revenue > 0 ? '↑' : 
             data.summary?.today?.vsYesterday?.revenue < 0 ? '↓' : '='} 
            {Math.abs(data.summary?.today?.vsYesterday?.revenue || 0).toFixed(0)}% vs ontem
          </p>
        </div>

        <div className="metric-box">
          <p className="metric-box-label">Projeção 7 Dias</p>
          <p className="metric-box-value" style={{ color: getProjectionColor() }}>
            {data.insights?.trends?.projection7Days ? 
              Math.round(data.insights.trends.projection7Days).toLocaleString('pt-BR') : '0'}
          </p>
          <p className="metric-box-sub">
            Baseado em histórico
          </p>
        </div>

        <div className="metric-box">
          <p className="metric-box-label">Velocidade de Vendas</p>
          <p className="metric-box-value">
            {((data.summary?.last7Days?.sales || 0) / 7).toFixed(1)}
          </p>
          <p className="metric-box-sub">
            vendas por dia (média 7d)
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div style={{
        background: 'rgba(255, 230, 0, 0.02)',
        border: '1px solid rgba(255, 230, 0, 0.1)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        position: 'relative'
      }}>
        {/* TODAY MARKER */}
        {data.chartData?.some((item: any) => {
          const date = new Date(item.date)
          const today = new Date()
          return date.toDateString() === today.toDateString()
        }) && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 12px',
            background: 'rgba(255, 230, 0, 0.2)',
            border: '1px solid #FFE600',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            color: '#FFE600',
            zIndex: 10
          }}>
            HOJE
          </div>
        )}
        
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data.chartData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFE600" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#FFE600" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorProjection" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFE600" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#FFE600" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#4ADE80" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 230, 0, 0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#666666' }}
              tickFormatter={(value) => {
                const date = new Date(value)
                const today = new Date()
                const isToday = date.toDateString() === today.toDateString()
                return isToday ? 'HOJE' : `${date.getDate()}/${date.getMonth() + 1}`
              }}
              stroke="rgba(255, 230, 0, 0.1)"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#666666' }}
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              stroke="rgba(255, 230, 0, 0.1)"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#666666' }}
              stroke="rgba(255, 230, 0, 0.1)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1A1A',
                border: '1px solid rgba(255, 230, 0, 0.2)',
                borderRadius: '8px',
                color: '#FFFFFF'
              }}
              formatter={(value: any, name: string) => {
                if (name === "revenue" || name.includes('Receita')) {
                  return [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']
                }
                if (name.includes('Projeção')) {
                  return [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Projeção']
                }
                return [value, 'Vendas']
              }}
              labelFormatter={(label) => {
                const date = new Date(label)
                return date.toLocaleDateString("pt-BR")
              }}
            />
            <Legend 
              wrapperStyle={{ 
                paddingTop: '8px',
                fontSize: '10px'
              }}
              iconType="line"
              iconSize={16}
              height={28}
              formatter={(value) => {
                const labels: any = {
                  'Receita Real': 'Receita',
                  'Projeção': 'Projeção',
                  'Vendas': 'Vendas'
                }
                return <span style={{fontSize: '10px', color: '#999'}}>{labels[value] || value}</span>
              }}
            />
            {/* Historical Revenue */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey={(item: any) => item.isProjection ? null : item.revenue}
              stroke="#FFE600"
              fill="url(#colorRevenue)"
              strokeWidth={2}
              name="Receita Real"
              connectNulls={false}
              dot={false}
            />
            
            {/* Projected Revenue */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey={(item: any) => item.isProjection ? item.revenue : null}
              stroke="#FFE600"
              strokeDasharray="5 5"
              fill="url(#colorProjection)"
              strokeWidth={2}
              name="Projeção"
              connectNulls={true}
              dot={false}
            />
            
            {/* Sales Bars */}
            <Bar
              yAxisId="right"
              dataKey="sales"
              fill={((entry: any) => entry.isProjection ? 'rgba(74, 222, 128, 0.3)' : 'rgba(74, 222, 128, 0.6)') as any}
              name="Vendas"
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Details Section */}
      <div className="container-details">
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
                <p style={{ fontSize: '11px', color: '#999999', marginBottom: '4px' }}>Ticket Médio</p>
                <p style={{ fontSize: '24px', fontWeight: '300', color: '#FFE600', margin: 0 }}>
                  R$ {data.summary?.last30Days?.avgTicket?.toFixed(2) || '0,00'}
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
                <p style={{ fontSize: '11px', color: '#999999', marginBottom: '4px' }}>Receita Média/Dia</p>
                <p style={{ fontSize: '24px', fontWeight: '300', color: '#FFE600', margin: 0 }}>
                  R$ {data.summary?.last30Days?.dailyAvg?.toFixed(2) || '0,00'}
                </p>
                <p style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>últimos 30 dias</p>
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
                  {data.insights?.conversionFunnel?.conversionRate?.toFixed(2) || '0,00'}%
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
                <p style={{ fontSize: '11px', color: '#999999', marginBottom: '4px' }}>Projeção Mensal</p>
                <p style={{ fontSize: '24px', fontWeight: '300', color: '#FFE600', margin: 0 }}>
                  R$ {data.insights?.trends?.projection30Days ? 
                    Math.round(data.insights.trends.projection30Days).toLocaleString('pt-BR') : '0'}
                </p>
                <p style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>estimativa</p>
              </div>
            </div>
          </div>

          <div className="detail-row">
            <span className="detail-label">Melhor Dia de Vendas</span>
            <span className="detail-value">
              {data.insights?.trends?.bestDay ? 
                `${new Date(data.insights.trends.bestDay.date).toLocaleDateString('pt-BR')} - R$ ${Math.round(data.insights.trends.bestDay.revenue).toLocaleString('pt-BR')}` : 
                'Sem dados'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Horário com Mais Vendas</span>
            <span className="detail-value">
              {data.insights?.peakHour !== undefined ? `${data.insights.peakHour}:00 - ${data.insights.peakHour + 1}:00` : 'Sem dados'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Vendas (últimos 30 dias)</span>
            <span className="detail-value">{data.summary?.last30Days?.sales || 0} unidades</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Receita (últimos 30 dias)</span>
            <span className="detail-value">
              R$ {data.summary?.last30Days?.revenue ? 
                Math.round(data.summary.last30Days.revenue).toLocaleString('pt-BR') : '0'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Média de Vendas/Dia</span>
            <span className="detail-value highlight">
              {((data.summary?.last30Days?.sales || 0) / 30).toFixed(1)} unidades
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Crescimento (7 dias)</span>
            <span className="detail-value" style={{
              color: (data.summary?.last7Days?.growthRate || 0) > 0 ? '#4ADE80' : 
                     (data.summary?.last7Days?.growthRate || 0) < 0 ? '#F87171' : '#FFE600'
            }}>
              {(data.summary?.last7Days?.growthRate || 0) > 0 ? '↑' : 
               (data.summary?.last7Days?.growthRate || 0) < 0 ? '↓' : '='} 
              {Math.abs(data.summary?.last7Days?.growthRate || 0).toFixed(1)}%
            </span>
          </div>
          
          {/* ROI Indicator */}
          {data.insights?.roi && (
            <div className="detail-row">
              <span className="detail-label">ROI Estimado</span>
              <span className="detail-value highlight">
                {data.insights.roi.toFixed(0)}%
              </span>
            </div>
          )}
          
          {/* Health Score */}
          {data.insights?.healthScore && (
            <div className="detail-row">
              <span className="detail-label">Saúde do Negócio</span>
              <span className="detail-value" style={{
                color: data.insights.healthScore >= 80 ? '#4ADE80' :
                       data.insights.healthScore >= 60 ? '#FFE600' :
                       '#F87171'
              }}>
                {data.insights.healthScore}/100
              </span>
            </div>
          )}
        </div>

        {/* Top Products */}
        {data.topProducts?.length > 0 && (
          <div className="detail-section">
            <p className="detail-section-title">Produtos Mais Vendidos</p>
            {data.topProducts.slice(0, 5).map((product: any, index: number) => (
              <div key={product.id} style={{
                padding: '12px 16px',
                background: 'rgba(255, 230, 0, 0.03)',
                border: '1px solid rgba(255, 230, 0, 0.1)',
                borderRadius: '8px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: '13px',
                    color: '#FFFFFF',
                    marginBottom: '4px'
                  }}>
                    <span style={{ color: '#FFE600', marginRight: '8px' }}>#{index + 1}</span>
                    {product.title.slice(0, 50)}{product.title.length > 50 ? '...' : ''}
                  </p>
                  <p style={{
                    fontSize: '11px',
                    color: '#666666'
                  }}>
                    {product.quantity} {product.quantity > 1 ? 'vendas' : 'venda'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontSize: '16px',
                    fontWeight: '300',
                    color: '#FFE600',
                    marginBottom: '2px'
                  }}>
                    R$ {Math.round(product.revenue).toLocaleString('pt-BR')}
                  </p>
                  <p style={{
                    fontSize: '10px',
                    color: '#999999'
                  }}>
                    receita total
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Calculation Info - More Professional */}
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: 'linear-gradient(135deg, rgba(255, 230, 0, 0.05) 0%, rgba(255, 230, 0, 0.02) 100%)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 230, 0, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <p style={{
                fontSize: '11px',
                color: '#FFE600',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: '600'
              }}>Metodologia de Cálculo</p>
              <p style={{
                fontSize: '10px',
                color: '#999999',
                margin: 0
              }}>
                Projeção = (Média Ponderada × Sazonalidade × Momentum) + Tendência Linear
              </p>
            </div>
            <div style={{
              padding: '4px 12px',
              background: 'rgba(255, 230, 0, 0.1)',
              borderRadius: '6px',
              fontSize: '10px',
              color: '#FFE600',
              fontWeight: '600'
            }}>
              Precisão: {((data.insights?.trends?.projectionAccuracy || 0.85) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
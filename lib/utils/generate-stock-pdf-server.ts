/**
 * GERADOR DE RELATÓRIO PDF - ESTOQUE FULL (SERVER-SIDE)
 * Outubro 2025 - Enterprise Grade
 *
 * Features:
 * - Dados REAIS do banco de dados
 * - Logo ML Agent incorporada
 * - Branding premium (Preto #000000, Dourado #FFE600, Amarelo #FFC700)
 * - Paginação automática perfeita
 * - Métricas completas e precisas
 * - Layout A4 profissional
 *
 * Tecnologia: jsPDF + autoTable
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { logger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

// Extend jsPDF types
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
  }
}

interface StockItem {
  itemId: string
  itemTitle: string
  itemPrice: number
  availableStock: number
  totalStock: number
  notAvailableStock: number
  avgDailySales: number
  daysOfCover: number
  alertLevel: 'critical' | 'warning' | 'ok' | 'unknown'
  salesTrend: 'increasing' | 'stable' | 'decreasing'
  recommendedQty: number
  stockoutDate?: Date | string | null
  mlAccount: {
    nickname: string
    siteId: string
  }
}

interface StockStats {
  total: number
  critical: number
  warning: number
  ok: number
  stockValue: number
  potentialRevenue7d: number
  potentialRevenue30d: number
  storageCostMonthly: number
  lostSales: number
  totalUnits: number
  unavailableUnits: number
  dailySalesRate: number
  zeroSales: number
  slowMoving: number
  stockTurnover: number
  outOfStock: number
}

interface GeneratePDFOptions {
  items: StockItem[]
  stats: StockStats
  organizationName: string
  plan: string
}

// Helper to load logo - MESMO USADO NA APLICAÇÃO
function getLogoBase64(): string {
  try {
    // Usar EXATAMENTE o mesmo logo da aplicação (versão PNG do SVG)
    const logoPath = path.join(process.cwd(), 'public', 'mlagent-logo-3d.png')

    if (fs.existsSync(logoPath)) {
      const imageBuffer = fs.readFileSync(logoPath)
      const base64 = imageBuffer.toString('base64')
      logger.info('[PDF] ✅ Logo loaded (same as app)', {
        path: 'mlagent-logo-3d.png',
        sizeKB: (imageBuffer.length / 1024).toFixed(1)
      })
      return 'data:image/png;base64,' + base64
    }

    logger.warn('[PDF] ⚠️ Logo file not found', { logoPath })
  } catch (error) {
    logger.error('[PDF] ❌ Error loading logo', { error })
  }
  return ''
}

export async function generateStockPDFServer(options: GeneratePDFOptions): Promise<Buffer> {
  const { items, stats, organizationName, plan } = options

  try {
    logger.info('[PDF] Starting generation', {
      items: items.length,
      organizationName,
      plan
    })

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Brand Colors - Ultra Premium October 2025
    // Matching /agente page design system
    const colors = {
      // Primary Gold Palette (FFD700 = #FFD700)
      gold: [255, 215, 0] as [number, number, number],           // Pure gold #FFD700
      goldLight: [252, 211, 77] as [number, number, number],     // Lighter gold #FCD34D
      goldDark: [202, 138, 4] as [number, number, number],       // Dark gold #CA8A04

      // Blacks & Grays (Clean & Modern)
      black: [0, 0, 0] as [number, number, number],              // Pure black #000000
      darkGray: [17, 17, 17] as [number, number, number],        // Very dark gray
      mediumGray: [115, 115, 115] as [number, number, number],   // Medium gray
      lightGray: [163, 163, 163] as [number, number, number],    // Light gray
      white: [255, 255, 255] as [number, number, number],        // Pure white

      // Status Colors (Muted & Professional)
      red: [220, 38, 38] as [number, number, number],            // Red for critical
      orange: [234, 88, 12] as [number, number, number],         // Orange for warning
      yellow: [234, 179, 8] as [number, number, number],         // Yellow for attention
      green: [22, 163, 74] as [number, number, number]           // Green for success
    }

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    let currentY = 20

    // ====== HEADER COM LOGO ======
    function addHeader() {
      // Background preto premium
      doc.setFillColor(colors.black[0], colors.black[1], colors.black[2])
      doc.rect(0, 0, pageWidth, 55, 'F')

      // Logo em ALTA RESOLUÇÃO e QUALIDADE
      const logoBase64 = getLogoBase64()
      if (logoBase64) {
        try {
          // Logo grande e nítido: 28x28mm sem compressão
          doc.addImage(
            logoBase64,
            'PNG',
            margin,
            10,
            28,
            28,
            undefined,
            'FAST'  // Compressão rápida mantendo qualidade
          )
        } catch (error) {
          logger.warn('[PDF] Error adding logo', { error })
        }
      }

      // Brand Text (ajustado para logo 28mm)
      const textX = margin + 32

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2])
      doc.text('ML AGENT', textX, 18)

      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(16)
      doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.text(plan.toUpperCase(), textX, 27)

      // Título Principal
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2])
      doc.text('RELATÓRIO EXECUTIVO', textX, 35)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.text('GESTÃO DE ESTOQUE FULL', textX, 43)

      // Organização
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2])
      doc.text(organizationName.toUpperCase(), textX, 50)

      // Data e hora (direita)
      const now = new Date()
      const dateStr = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase()
      const timeStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2])
      doc.text('GERADO EM', pageWidth - margin, 16, { align: 'right' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.text(dateStr, pageWidth - margin, 23, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(timeStr, pageWidth - margin, 29, { align: 'right' })

      // Valor total
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2])
      doc.text('VALOR TOTAL', pageWidth - margin, 36, { align: 'right' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2])
      const totalValue = stats.stockValue >= 1000
        ? `R$ ${(stats.stockValue / 1000).toFixed(1)}k`
        : `R$ ${stats.stockValue.toFixed(0)}`
      doc.text(totalValue, pageWidth - margin, 43, { align: 'right' })

      // Linha dourada bottom
      doc.setFillColor(colors.goldDark[0], colors.goldDark[1], colors.goldDark[2])
      doc.rect(0, 52, pageWidth, 1, 'F')
      doc.setFillColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.rect(0, 53, pageWidth, 1.5, 'F')
      doc.setFillColor(colors.goldLight[0], colors.goldLight[1], colors.goldLight[2])
      doc.rect(0, 54.5, pageWidth, 0.5, 'F')

      currentY = 65
    }

    // ====== MÉTRICAS RESUMO ======
    function addMetricsCards() {
      if (currentY + 80 > pageHeight - 30) {
        doc.addPage()
        addHeader()
      }

      // Título
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
      doc.text('RESUMO EXECUTIVO', margin, currentY)

      doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.setLineWidth(0.8)
      doc.line(margin + 45, currentY - 1, pageWidth - margin, currentY - 1)

      currentY += 7

      // Cards (2 por linha)
      const cardWidth = (pageWidth - (margin * 2) - 4) / 2
      const cardHeight = 18
      let cardX = margin
      let cardY = currentY

      const metricsData = [
        {
          label: 'Total de Items',
          value: stats.total.toString(),
          subtext: `${stats.outOfStock} zerados`,
          color: colors.gold
        },
        {
          label: 'Críticos',
          value: stats.critical.toString(),
          subtext: '< 7 dias',
          color: colors.red
        },
        {
          label: 'Valor em Estoque',
          value: `R$ ${(stats.stockValue / 1000).toFixed(1)}k`,
          subtext: `${stats.totalUnits.toLocaleString('pt-BR')} un`,
          color: colors.gold
        },
        {
          label: 'Potencial 7 dias',
          value: `R$ ${(stats.potentialRevenue7d / 1000).toFixed(1)}k`,
          subtext: `${stats.dailySalesRate.toFixed(1)} vendas/dia`,
          color: colors.green
        },
        {
          label: 'Items Parados',
          value: stats.zeroSales.toString(),
          subtext: 'Sem vendas',
          color: colors.yellow
        },
        {
          label: 'Giro Mensal',
          value: `${stats.stockTurnover.toFixed(1)}x`,
          subtext: stats.stockTurnover >= 2 ? 'Excelente' : 'Melhorar',
          color: stats.stockTurnover >= 2 ? colors.green : colors.yellow
        }
      ]

      metricsData.forEach((metric, index) => {
        cardX = margin + (index % 2) * (cardWidth + 4)
        cardY = currentY + Math.floor(index / 2) * (cardHeight + 2.5)

        // Shadow
        doc.setFillColor(240, 240, 240)
        doc.roundedRect(cardX + 0.3, cardY + 0.3, cardWidth, cardHeight, 1.5, 1.5, 'F')

        // Card
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'F')

        // Border
        doc.setDrawColor(230, 230, 230)
        doc.setLineWidth(0.2)
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'S')

        // Barra colorida
        doc.setFillColor(metric.color[0], metric.color[1], metric.color[2])
        doc.roundedRect(cardX + 1, cardY + 1, 3, cardHeight - 2, 0.8, 0.8, 'F')

        // Label
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2])
        doc.text(metric.label.toUpperCase(), cardX + 7, cardY + 5.5)

        // Value
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
        doc.text(metric.value, cardX + 7, cardY + 12.5)

        // Subtext
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2])
        doc.text(metric.subtext, cardX + 7, cardY + 16)
      })

      currentY = cardY + cardHeight + 10
    }

    // ====== TABELA DE ITEMS ======
    function addItemsTable() {
      if (currentY > pageHeight - 50) {
        doc.addPage()
        addHeader()
      }

      // Título
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
      doc.text('DETALHAMENTO DE ITEMS', margin, currentY)

      doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.setLineWidth(0.8)
      doc.line(margin + 55, currentY - 1, pageWidth - margin, currentY - 1)

      currentY += 5

      // Preparar dados
      const tableData = items.map(item => {
        let alertText = 'OK'
        if (item.alertLevel === 'critical') alertText = 'CRÍTICO'
        else if (item.alertLevel === 'warning') alertText = 'ATENÇÃO'

        let trendText = '→'
        if (item.salesTrend === 'increasing') trendText = '↗'
        else if (item.salesTrend === 'decreasing') trendText = '↘'

        const maxTitleLength = 45
        let title = item.itemTitle
        if (title.length > maxTitleLength) {
          title = title.substring(0, maxTitleLength - 3) + '...'
        }

        return [
          item.itemId.substring(0, 12),
          title,
          item.mlAccount.nickname.substring(0, 20),
          `R$ ${item.itemPrice.toFixed(2)}`,
          item.availableStock.toString(),
          item.daysOfCover > 0 ? `${item.daysOfCover.toFixed(0)}d` : '-',
          `${trendText} ${item.avgDailySales.toFixed(1)}`,
          alertText
        ]
      })

      // Gerar tabela
      autoTable(doc, {
        startY: currentY,
        head: [['ID Item', 'Produto', 'Conta ML', 'Preço', 'Stock', 'Cob.', 'Vendas/d', 'Status']],
        body: tableData,
        theme: 'striped',
        styles: {
          font: 'helvetica',
          fontSize: 6.5,
          cellPadding: 1.5,
          overflow: 'linebreak',
          lineColor: [220, 220, 220],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: colors.black,
          textColor: colors.gold,
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
          cellPadding: 2
        },
        alternateRowStyles: {
          fillColor: [252, 252, 252]
        },
        columnStyles: {
          0: { cellWidth: 22, fontSize: 6, halign: 'left' },
          1: { cellWidth: 60, fontSize: 6.5, halign: 'left' },
          2: { cellWidth: 24, fontSize: 6, halign: 'left' },
          3: { cellWidth: 17, fontSize: 6.5, halign: 'right' },
          4: { cellWidth: 12, fontSize: 7, halign: 'center', fontStyle: 'bold' },
          5: { cellWidth: 12, fontSize: 6, halign: 'center' },
          6: { cellWidth: 16, fontSize: 6, halign: 'center' },
          7: { cellWidth: 22, fontSize: 6, halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const cellText = data.cell.text[0] || ''
            if (cellText.includes('CRÍTICO')) {
              data.cell.styles.fillColor = [254, 226, 226]
              data.cell.styles.textColor = [127, 29, 29]
            } else if (cellText.includes('ATENÇÃO')) {
              data.cell.styles.fillColor = [254, 249, 195]
              data.cell.styles.textColor = [113, 63, 18]
            } else if (cellText.includes('OK')) {
              data.cell.styles.fillColor = [220, 252, 231]
              data.cell.styles.textColor = [20, 83, 45]
            }
          }

          if (data.section === 'body' && data.column.index === 4) {
            const stock = parseInt(data.cell.text[0] || '0')
            if (stock === 0) {
              data.cell.styles.textColor = [220, 38, 38]
              data.cell.styles.fontStyle = 'bold'
            } else if (stock < 5) {
              data.cell.styles.textColor = [234, 88, 12]
            }
          }
        },
        margin: { left: margin, right: margin, top: 65, bottom: 25 },
        showHead: 'everyPage',
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addHeader()
          }
          addFooter(data.pageNumber)
        }
      })

      currentY = doc.lastAutoTable.finalY + 8
    }

    // ====== RECOMENDAÇÕES ======
    function addRecommendations() {
      if (currentY > pageHeight - 75) {
        doc.addPage()
        addHeader()
      }

      // Título
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
      doc.text('ANÁLISE E RECOMENDAÇÕES', margin, currentY)

      doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.setLineWidth(0.8)
      doc.line(margin + 60, currentY - 1, pageWidth - margin, currentY - 1)

      currentY += 7

      // Críticos
      const criticalItems = items.filter(i => i.alertLevel === 'critical')
      if (criticalItems.length > 0) {
        if (currentY + 25 > pageHeight - 25) {
          doc.addPage()
          addHeader()
          currentY = 65
        }

        doc.setFillColor(254, 242, 242)
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 1.5, 1.5, 'F')

        doc.setFillColor(colors.red[0], colors.red[1], colors.red[2])
        doc.roundedRect(margin + 1, currentY + 1, 3, 20, 0.8, 0.8, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(colors.red[0], colors.red[1], colors.red[2])
        doc.text('🚨 AÇÃO URGENTE', margin + 7, currentY + 5.5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
        const urgentText = `${criticalItems.length} items críticos precisam de reposição IMEDIATA (< 7 dias de estoque).`
        doc.text(urgentText, margin + 7, currentY + 11, { maxWidth: pageWidth - margin * 2 - 9 })

        const urgentValue = criticalItems.reduce((sum, i) => sum + (i.recommendedQty * i.itemPrice), 0)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(colors.red[0], colors.red[1], colors.red[2])
        doc.text(`Investimento necessário: R$ ${urgentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 7, currentY + 17.5)

        currentY += 25
      }

      // Items parados
      if (stats.zeroSales > 0) {
        if (currentY + 20 > pageHeight - 25) {
          doc.addPage()
          addHeader()
          currentY = 65
        }

        doc.setFillColor(254, 252, 232)
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 1.5, 1.5, 'F')

        doc.setFillColor(colors.yellow[0], colors.yellow[1], colors.yellow[2])
        doc.roundedRect(margin + 1, currentY + 1, 3, 16, 0.8, 0.8, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(180, 120, 0)
        doc.text('⚠️ ATENÇÃO: Items Parados', margin + 7, currentY + 5.5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
        const text = `${stats.zeroSales} items sem vendas em 30 dias. Custo mensal desnecessário. Considere promoções ou remoção do Full.`
        doc.text(text, margin + 7, currentY + 11, { maxWidth: pageWidth - margin * 2 - 9 })

        currentY += 21
      }

      // Vendas perdidas
      if (stats.lostSales > 0) {
        if (currentY + 18 > pageHeight - 25) {
          doc.addPage()
          addHeader()
          currentY = 65
        }

        doc.setFillColor(255, 247, 237)
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 1.5, 1.5, 'F')

        doc.setFillColor(colors.orange[0], colors.orange[1], colors.orange[2])
        doc.roundedRect(margin + 1, currentY + 1, 3, 16, 0.8, 0.8, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(255, 100, 0)
        doc.text('💡 Oportunidade Perdida', margin + 7, currentY + 5.5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
        const lostText = `Produtos zerados estão gerando R$ ${(stats.lostSales / 1000).toFixed(1)}k em vendas perdidas por semana!`
        doc.text(lostText, margin + 7, currentY + 11, { maxWidth: pageWidth - margin * 2 - 9 })

        currentY += 21
      }

      // Performance positiva
      if (stats.stockTurnover >= 2) {
        if (currentY + 16 > pageHeight - 25) {
          doc.addPage()
          addHeader()
          currentY = 65
        }

        doc.setFillColor(240, 253, 244)
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 15, 1.5, 1.5, 'F')

        doc.setFillColor(colors.green[0], colors.green[1], colors.green[2])
        doc.roundedRect(margin + 1, currentY + 1, 3, 13, 0.8, 0.8, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(colors.green[0], colors.green[1], colors.green[2])
        doc.text('✅ Desempenho Excelente', margin + 7, currentY + 5.5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
        doc.text(`Giro de estoque de ${stats.stockTurnover.toFixed(1)}x/mês indica gestão eficiente de capital!`, margin + 7, currentY + 11)

        currentY += 18
      }

      // Nota final
      if (currentY + 15 < pageHeight - 25) {
        currentY += 3
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(6.5)
        doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2])
        doc.text('* Análise baseada nos últimos 30 dias de histórico de vendas. Recomendações são sugestões e devem ser avaliadas caso a caso.', margin, currentY, { maxWidth: pageWidth - margin * 2 })
      }
    }

    // ====== FOOTER ======
    function addFooter(pageNumber: number) {
      const footerY = pageHeight - 16

      // Linha dourada
      doc.setDrawColor(colors.goldDark[0], colors.goldDark[1], colors.goldDark[2])
      doc.setLineWidth(0.3)
      doc.line(margin, footerY - 1, pageWidth - margin, footerY - 1)

      doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.setLineWidth(0.5)
      doc.line(margin, footerY, pageWidth - margin, footerY)

      // Branding
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(colors.black[0], colors.black[1], colors.black[2])
      doc.text('ML AGENT', margin, footerY + 4.5)

      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(7)
      doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.text('PRO', margin + 20, footerY + 4.5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2])
      doc.text('Sistema de Gestão de Estoque Full', margin, footerY + 8.5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.text('gugaleo.axnexlabs.com.br', margin, footerY + 12)

      // Badge Confidencial
      const badgeWidth = 32
      const badgeX = (pageWidth - badgeWidth) / 2
      doc.setFillColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2])
      doc.roundedRect(badgeX, footerY + 3, badgeWidth, 5, 0.8, 0.8, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(colors.goldLight[0], colors.goldLight[1], colors.goldLight[2])
      doc.text('CONFIDENCIAL', pageWidth / 2, footerY + 6.5, { align: 'center' })

      // Página
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2])
      doc.text('PÁGINA', pageWidth - margin, footerY + 4.5, { align: 'right' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2])
      doc.text(pageNumber.toString(), pageWidth - margin, footerY + 11, { align: 'right' })
    }

    // ====== GERAR DOCUMENTO ======
    addHeader()
    addMetricsCards()
    addItemsTable()
    addRecommendations()

    // Footer final
    const totalPages = doc.internal.pages.length - 1
    if (currentY < pageHeight - 20) {
      addFooter(totalPages)
    }

    // Convert to Buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    logger.info('[PDF] ✅ Generated successfully', {
      pages: totalPages,
      items: items.length,
      size: pdfBuffer.length
    })

    return pdfBuffer
  } catch (error) {
    logger.error('[PDF] ❌ Generation failed', { error })
    throw error
  }
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
  iconColor?: string
  valueColor?: string
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconColor = "text-muted-foreground",
  valueColor = "text-foreground",
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("stat-card-premium relative overflow-hidden", className)}
        style={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #111111 100%)',
          border: '1px solid rgba(255, 230, 0, 0.1)',
          borderRadius: '16px',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="premium-label" style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#666666',
            fontWeight: '600'
          }}>{title}</CardTitle>
          <div style={{
            padding: '8px',
            background: 'rgba(255, 230, 0, 0.1)',
            borderRadius: '8px'
          }}>
            <Icon className="h-4 w-4" style={{color: '#FFE600'}}/>
          </div>
        </CardHeader>
        <CardContent>
          <div className="stat-value" style={{
            fontSize: '32px',
            fontWeight: '200',
            color: '#FFE600',
            letterSpacing: '0.02em'
          }}>{value}</div>
          {description && (
            <p className="text-xs mt-2" style={{
              color: '#999999',
              letterSpacing: '0.05em'
            }}>{description}</p>
          )}
          {trend && (
            <div className="flex items-center mt-2">
              <span
                className="text-xs font-bold"
                style={{
                  color: trend.isPositive ? '#00FF88' : '#FF4444',
                  letterSpacing: '0.05em'
                }}
              >
                {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
              </span>
              <span className="text-xs ml-2" style={{
                color: '#666666',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                vs mês anterior
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { formatCurrency } from "@/lib/utils"

interface SalesChartProps {
  data: Array<{
    date: string
    sales: number
    revenue: number
  }>
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <Card className="col-span-4 border-2 border-gray-800">
      <CardHeader>
        <CardTitle>Vendas e Receita</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getDate()}/${date.getMonth() + 1}`
              }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === "revenue") {
                  return formatCurrency(value)
                }
                return value
              }}
              labelFormatter={(label) => {
                const date = new Date(label)
                return date.toLocaleDateString("pt-BR")
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="#FFE600"
              fill="#FFE600"
              fillOpacity={0.6}
              name="Receita"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sales"
              stroke="#2563eb"
              strokeWidth={2}
              name="Vendas"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Package, Clock, CheckCircle, XCircle } from "lucide-react"

interface RecentOrdersProps {
  orders: Array<{
    id: string
    date_created: string
    total_amount: number
    status: string
    order_items: Array<{
      item: {
        title: string
      }
      quantity: number
    }>
  }>
}

const statusConfig = {
  paid: { label: "Pago", icon: CheckCircle, className: "bg-green-100 text-green-800" },
  payment_in_process: { label: "Processando", icon: Clock, className: "bg-yellow-100 text-yellow-800" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "bg-red-100 text-red-800" },
  confirmed: { label: "Confirmado", icon: Package, className: "bg-blue-100 text-blue-800" },
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <Card className="col-span-3 border-2 border-gray-800">
      <CardHeader>
        <CardTitle>Pedidos Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders?.slice(0, 5).map((order) => {
            const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.confirmed
            const Icon = config.icon
            
            return (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <Icon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      #{order.id.toString().slice(-8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.order_items[0]?.item.title || "Produto"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(order.date_created)}
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-semibold">
                    {formatCurrency(order.total_amount)}
                  </p>
                  <Badge className={config.className} variant="secondary">
                    {config.label}
                  </Badge>
                </div>
              </div>
            )
          })}
          {(!orders || orders.length === 0) && (
            <p className="text-center text-gray-500 py-4">
              Nenhum pedido recente
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
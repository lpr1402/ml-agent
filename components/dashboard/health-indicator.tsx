"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Package,
  Pause,
  XCircle,
  TrendingDown,
  Clock,
  ArrowRight
} from "lucide-react"
import { useRouter } from "next/navigation"

interface HealthIndicatorProps {
  items: any[]
  quality?: {
    averageScore: number
    totalIssues: number
    sampledItems: number
  }
}

export function HealthIndicator({ items, quality }: HealthIndicatorProps) {
  const router = useRouter()
  
  // Calculate health metrics
  const healthMetrics = {
    paused: items?.filter(i => i.status === "paused").length || 0,
    noStock: items?.filter(i => i.available_quantity === 0).length || 0,
    lowQuality: quality?.averageScore ? (quality.averageScore < 40 ? true : false) : false,
    mediumQuality: quality?.averageScore ? (quality.averageScore >= 40 && quality.averageScore < 70) : false,
    issues: quality?.totalIssues || 0
  }
  
  const hasIssues = healthMetrics.paused > 0 || 
                    healthMetrics.noStock > 0 || 
                    healthMetrics.lowQuality || 
                    healthMetrics.issues > 0
  
  if (!hasIssues && quality?.averageScore && quality.averageScore >= 70) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            Saúde dos Anúncios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700">
            Todos os seus anúncios estão saudáveis e otimizados!
          </p>
          <div className="mt-3">
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Qualidade Média: {quality?.averageScore || 0}%
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Atenção Necessária
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/anuncios")}
            className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
          >
            Ver Anúncios
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {healthMetrics.paused > 0 && (
          <div className="flex items-center justify-between p-2 bg-white rounded border border-yellow-200">
            <div className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Anúncios Pausados</span>
            </div>
            <Badge variant="secondary">{healthMetrics.paused}</Badge>
          </div>
        )}
        
        {healthMetrics.noStock > 0 && (
          <div className="flex items-center justify-between p-2 bg-white rounded border border-red-200">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">Sem Estoque</span>
            </div>
            <Badge className="bg-red-100 text-red-800 border-red-200">
              {healthMetrics.noStock}
            </Badge>
          </div>
        )}
        
        {quality && (
          <div className="p-2 bg-white rounded border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Qualidade Média</span>
              <Badge className={`${
                quality.averageScore >= 70 ? 'bg-green-100 text-green-800 border-green-200' :
                quality.averageScore >= 40 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                'bg-red-100 text-red-800 border-red-200'
              }`}>
                {quality.averageScore}%
              </Badge>
            </div>
            {quality.totalIssues > 0 && (
              <p className="text-xs text-gray-600">
                {quality.totalIssues} ações pendentes para melhorar qualidade
              </p>
            )}
          </div>
        )}
        
        {healthMetrics.lowQuality && (
          <div className="p-2 bg-red-50 rounded border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                Qualidade baixa afeta visibilidade
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
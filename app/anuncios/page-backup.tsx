"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api-client"
import { Toaster } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Pause,
  Play,
  ExternalLink,
  Package,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ImageOff,
  Box,
  AlertTriangle,
  Eye,
  AlertCircle,
  Activity,
  TrendingUp,
  Users,
  Truck,
} from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function AnunciosPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [itemMetrics, setItemMetrics] = useState<any>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  // Fetch items with auto-refresh
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["items", selectedStatus],
    queryFn: async () => {
      const items = await apiClient.get(`/api/mercadolibre/items?status=${selectedStatus === "all" ? "active,paused,closed" : selectedStatus}`)
      
      // Fetch performance data for each item
      if (items?.items?.length > 0) {
        const itemsWithPerformance = await Promise.all(
          items.items.map(async (item: any) => {
            try {
              const response = await apiClient.get(`/api/mercadolibre/items/${item.id}/performance`)
              // The API returns { data: ..., raw: ... }, so we need to access response.data
              return { ...item, performance: response?.data || null }
            } catch (error) {
              console.warn(`Failed to fetch performance for item ${item.id}:`, error)
              return { ...item, performance: null }
            }
          })
        )
        return { ...items, items: itemsWithPerformance }
      }
      return items
    },
    enabled: !!accessToken,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  })

  // Update item status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      return apiClient.patch("/api/mercadolibre/items", { itemId, status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] })
      toast.success("Status atualizado com sucesso!")
    },
    onError: () => {
      toast.error("Erro ao atualizar status")
    },
  })

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiClient.put("/api/mercadolibre/items", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] })
      toast.success("Anúncio atualizado com sucesso!")
      setIsEditDialogOpen(false)
    },
    onError: () => {
      toast.error("Erro ao atualizar anúncio")
    },
  })

  // Fetch detailed metrics for a specific item
  const fetchItemMetrics = async (itemId: string) => {
    setLoadingMetrics(true)
    try {
      // Fetch all metrics in parallel with proper error handling
      const [visits, performance, visitsTimeWindow] = await Promise.allSettled([
        apiClient.get(`/api/mercadolibre/items/${itemId}/visits`),
        apiClient.get(`/api/mercadolibre/items/${itemId}/performance`),
        apiClient.get(`/api/mercadolibre/items/${itemId}/visits/time_window?last=30&unit=day`)
      ])
      
      // Extract data safely from settled promises
      const visitsData = visits.status === 'fulfilled' ? visits.value?.data : null
      const performanceData = performance.status === 'fulfilled' ? performance.value?.data : null
      const timeWindowData = visitsTimeWindow.status === 'fulfilled' ? visitsTimeWindow.value?.data : null
      
      // Log any errors for debugging
      if (visits.status === 'rejected') {
        console.warn("Failed to fetch visits:", visits.reason)
      }
      if (performance.status === 'rejected') {
        console.warn("Failed to fetch performance:", performance.reason)
      }
      if (visitsTimeWindow.status === 'rejected') {
        console.warn("Failed to fetch time window visits:", visitsTimeWindow.reason)
      }
      
      setItemMetrics({
        visits: visitsData,
        performance: performanceData,
        visitsTimeWindow: timeWindowData,
      })
    } catch (error) {
      console.error("Error fetching metrics:", error)
      setItemMetrics({
        visits: null,
        performance: null,
        visitsTimeWindow: null,
      })
    } finally {
      setLoadingMetrics(false)
    }
  }

  // Show item details with all metrics
  const handleShowDetails = async (item: any) => {
    setSelectedItem(item)
    setIsDetailsDialogOpen(true)
    await fetchItemMetrics(item.id)
  }

  // Filter items
  const filteredItems = itemsData?.items?.filter((item: any) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.id.includes(searchTerm)
    const matchesStatus = selectedStatus === "all" || item.status === selectedStatus
    return matchesSearch && matchesStatus
  }) || []

  // Calculate real statistics
  const stats = {
    total: itemsData?.total || 0,
    active: itemsData?.items?.filter((i: any) => i.status === "active").length || 0,
    paused: itemsData?.items?.filter((i: any) => i.status === "paused").length || 0,
    closed: itemsData?.items?.filter((i: any) => i.status === "closed").length || 0,
    totalSold: itemsData?.items?.reduce((sum: number, item: any) => sum + (item.sold_quantity || 0), 0) || 0,
    totalRevenue: itemsData?.items?.reduce((sum: number, item: any) => 
      sum + ((item.sold_quantity || 0) * (item.price || 0)), 0) || 0,
  }

  const statusConfig = {
    active: { 
      label: "Ativo", 
      color: "bg-green-100 text-green-800 border-green-200",
      icon: CheckCircle 
    },
    paused: { 
      label: "Pausado", 
      color: "bg-gray-100 text-gray-800 border-gray-200",
      icon: Pause 
    },
    closed: { 
      label: "Finalizado", 
      color: "bg-gray-100 text-gray-600 border-gray-200",
      icon: XCircle 
    },
    under_review: { 
      label: "Em Revisão", 
      color: "bg-blue-100 text-blue-800 border-blue-200",
      icon: Clock 
    },
  }

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    await updateStatusMutation.mutateAsync({ itemId, status: newStatus })
  }

  const handleEdit = (item: any) => {
    setSelectedItem(item)
    setEditForm({
      itemId: item.id,
      title: item.title,
      price: item.price,
      available_quantity: item.available_quantity,
      description: item.descriptions?.[0]?.plain_text || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateItem = async () => {
    await updateItemMutation.mutateAsync(editForm)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Toaster position="top-center" richColors />
      
      {/* Clean Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Central de Anúncios
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stats.total} produtos • Atualização automática ativada
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push("/anuncios/novo")}
              className="bg-[#FFE600] hover:bg-[#FFD100] text-black"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Anúncio
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Clean Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Box className="h-8 w-8 text-gray-900" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Ativos</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-gray-900" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pausados</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.paused}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-900" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Vendidos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalSold}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-gray-900" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Receita</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-gray-900" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    placeholder="Buscar por título ou ID do anúncio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>
              <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="active">Ativos</TabsTrigger>
                  <TabsTrigger value="paused">Pausados</TabsTrigger>
                  <TabsTrigger value="closed">Finalizados</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600]"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Nenhum anúncio encontrado
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                {searchTerm
                  ? "Tente ajustar sua busca para encontrar seus anúncios"
                  : "Comece criando seu primeiro anúncio no Mercado Livre"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item: any) => {
              const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.active
              const StatusIcon = config.icon
              const imageUrl = item.pictures?.[0]?.secure_url || item.thumbnail || null
              
              return (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleShowDetails(item)}
                >
                  <div className="aspect-[4/3] relative bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.title}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <div className={`${imageUrl ? 'hidden' : ''} absolute inset-0 flex items-center justify-center`}>
                      <ImageOff className="h-12 w-12 text-gray-300" />
                    </div>
                    
                    {/* Status Badge */}
                    <Badge className={`absolute top-2 left-2 ${config.color} border`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    
                    {/* Quality Score Badge */}
                    {item.performance && (
                      <div className="absolute top-2 left-24">
                        <Badge 
                          className={`${
                            item.performance.score >= 70 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : item.performance.score >= 40 
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          } border`}
                        >
                          <Activity className="h-3 w-3 mr-1" />
                          {item.performance.score}%
                        </Badge>
                      </div>
                    )}

                    {/* Actions Menu */}
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="secondary" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            window.open(item.permalink, "_blank")
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ver no ML
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(item)
                          }}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {item.status === "active" ? (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              handleStatusChange(item.id, "paused")
                            }}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pausar
                            </DropdownMenuItem>
                          ) : item.status === "paused" ? (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              handleStatusChange(item.id, "active")
                            }}>
                              <Play className="h-4 w-4 mr-2" />
                              Ativar
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                      {item.title}
                    </h3>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Preço</span>
                        <span className="font-bold text-gray-900">{formatCurrency(item.price)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Estoque</span>
                        <span className="text-gray-900">{item.available_quantity} un.</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Vendidos</span>
                        <span className="text-green-600 font-semibold">{item.sold_quantity || 0}</span>
                      </div>
                    </div>
                    
                    {/* Quality Indicators */}
                    {item.performance && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Qualidade:</span>
                            <span className={`text-xs font-semibold ${
                              item.performance.score >= 70 ? 'text-green-600' : 
                              item.performance.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {item.performance.level_wording || item.performance.level}
                            </span>
                          </div>
                          {item.performance.hasIssues && (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="text-xs">{item.performance.pendingActions?.length || 0} ações</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Details Dialog - Fixed and Complete */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-2xl">Métricas Completas do Anúncio</DialogTitle>
              <DialogDescription>
                Todas as informações e métricas disponíveis do Mercado Livre
              </DialogDescription>
            </DialogHeader>
            
            {selectedItem && (
              <div className="p-6 space-y-6">
                {/* Header with Image and Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Product Image */}
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    {selectedItem.pictures?.[0]?.secure_url ? (
                      <img
                        src={selectedItem.pictures[0].secure_url}
                        alt={selectedItem.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="h-20 w-20 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{selectedItem.title}</h3>
                      <p className="text-sm text-gray-500 font-mono">ID: {selectedItem.id}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <Badge className={`${statusConfig[selectedItem.status as keyof typeof statusConfig]?.color} mt-1`}>
                          {statusConfig[selectedItem.status as keyof typeof statusConfig]?.label}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Condição</p>
                        <p className="font-semibold text-gray-900">
                          {selectedItem.condition === 'new' ? 'Novo' : 'Usado'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Preço</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedItem.price)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Estoque</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedItem.available_quantity} un.</p>
                      </div>
                    </div>

                    {/* Sales Metrics */}
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Unidades Vendidas</p>
                            <p className="text-2xl font-bold text-green-600">{selectedItem.sold_quantity || 0}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Receita Total</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency((selectedItem.sold_quantity || 0) * selectedItem.price)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Visits Metrics */}
                {loadingMetrics ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFE600] mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">Carregando métricas avançadas...</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Performance/Quality Card */}
                    {itemMetrics?.performance && (
                      <Card className={`border-2 ${
                        itemMetrics.performance.score >= 70 ? 'border-green-200' : 
                        itemMetrics.performance.score >= 40 ? 'border-yellow-200' : 'border-red-200'
                      }`}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Activity className="h-5 w-5 text-gray-600" />
                              Qualidade do Anúncio
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold">
                                {itemMetrics.performance.score}%
                              </div>
                              <div className={`text-sm font-semibold ${
                                itemMetrics.performance.score >= 70 ? 'text-green-600' : 
                                itemMetrics.performance.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {itemMetrics.performance.level_wording || itemMetrics.performance.level}
                              </div>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Pending Actions */}
                          {itemMetrics.performance.pendingActions?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-red-600">⚠️ Ações Pendentes para Melhorar:</h4>
                              <div className="space-y-2">
                                {itemMetrics.performance.pendingActions.slice(0, 3).map((action: any, idx: number) => (
                                  <div key={idx} className="text-sm bg-yellow-50 p-2 rounded">
                                    <p className="font-medium text-yellow-800">{action.title}</p>
                                    {action.progress !== undefined && (
                                      <div className="mt-1">
                                        <div className="w-full bg-yellow-200 rounded-full h-1.5">
                                          <div 
                                            className="bg-yellow-600 h-1.5 rounded-full" 
                                            style={{ width: `${action.progress * 100}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Category Scores */}
                          <div className="grid grid-cols-2 gap-4">
                            {itemMetrics.performance.characteristics?.score !== undefined && (
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs text-gray-500">Dados do Produto</p>
                                <p className="text-lg font-semibold">{Math.round(itemMetrics.performance.characteristics.score)}%</p>
                              </div>
                            )}
                            {itemMetrics.performance.offer?.score !== undefined && (
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs text-gray-500">Condições de Venda</p>
                                <p className="text-lg font-semibold">{Math.round(itemMetrics.performance.offer.score)}%</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Visits Card */}
                    {itemMetrics?.visits && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-gray-600" />
                            Métricas de Visitas (Últimos 30 dias)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-500 mb-1">Total de Visitas</p>
                              <p className="text-3xl font-bold text-gray-900">
                                {formatNumber(itemMetrics.visits.total_visits || 0)}
                              </p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-500 mb-1">Média Diária</p>
                              <p className="text-3xl font-bold text-gray-900">
                                {Math.round((itemMetrics.visits.total_visits || 0) / 30)}
                              </p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                              <p className="text-sm text-gray-500 mb-1">Taxa de Conversão</p>
                              <p className="text-3xl font-bold text-green-600">
                                {selectedItem.sold_quantity && itemMetrics.visits.total_visits 
                                  ? ((selectedItem.sold_quantity / itemMetrics.visits.total_visits) * 100).toFixed(2) + '%'
                                  : '0%'}
                              </p>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                              <p className="text-sm text-gray-500 mb-1">Visitas por Venda</p>
                              <p className="text-3xl font-bold text-blue-600">
                                {selectedItem.sold_quantity > 0 
                                  ? Math.round(itemMetrics.visits.total_visits / selectedItem.sold_quantity)
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Performance/Quality Metrics */}
                    {itemMetrics?.performance && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-gray-600" />
                            Qualidade do Anúncio
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* Score Bar */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-500">Score de Qualidade</span>
                                <span className="text-2xl font-bold text-gray-900">
                                  {itemMetrics.performance.score}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                  className={`h-3 rounded-full transition-all ${
                                    itemMetrics.performance.score >= 70 ? 'bg-green-500' :
                                    itemMetrics.performance.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${itemMetrics.performance.score}%` }}
                                />
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-xs text-gray-400">Básico</span>
                                <span className="text-xs text-gray-400">Profissional</span>
                              </div>
                            </div>

                            {/* Quality Level */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-500">Nível de Qualidade</span>
                              <Badge className="text-lg px-4 py-1">
                                {itemMetrics.performance.level_wording || itemMetrics.performance.level}
                              </Badge>
                            </div>

                            {/* Improvement Actions */}
                            {itemMetrics.performance.buckets?.some((b: any) => 
                              b.variables?.some((v: any) => v.status === 'PENDING')
                            ) && (
                              <div className="border-t pt-4">
                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 text-orange-500" />
                                  Ações para Melhorar a Qualidade
                                </h4>
                                <div className="space-y-2">
                                  {itemMetrics.performance.buckets?.map((bucket: any) => 
                                    bucket.variables?.filter((v: any) => v.status === 'PENDING').map((variable: any) => (
                                      <div key={variable.key} className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                                        <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-gray-700">{variable.title}</p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Listing Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-gray-600" />
                        Informações do Anúncio
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Tipo de Anúncio</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedItem.listing_type_id === 'gold_special' ? 'Clássico' : 'Premium'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Categoria</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedItem.category_id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Aceita Mercado Pago</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedItem.accepts_mercadopago ? 'Sim' : 'Não'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Criado em</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(selectedItem.date_created).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shipping Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Truck className="h-5 w-5 text-gray-600" />
                        Informações de Envio
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Frete Grátis</span>
                        <Badge className={selectedItem.shipping?.free_shipping 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"}>
                          {selectedItem.shipping?.free_shipping ? "Sim" : "Não"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Modo de Envio</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedItem.shipping?.mode === 'me2' ? 'Mercado Envios' : 'Por conta do vendedor'}
                        </span>
                      </div>
                      {selectedItem.shipping?.logistic_type && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Tipo Logístico</span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedItem.shipping.logistic_type}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedItem.permalink, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver no Mercado Livre
                  </Button>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDetailsDialogOpen(false)
                        handleEdit(selectedItem)
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    {selectedItem.status === "active" && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleStatusChange(selectedItem.id, "paused")
                          setIsDetailsDialogOpen(false)
                        }}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pausar
                      </Button>
                    )}
                    {selectedItem.status === "paused" && (
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          handleStatusChange(selectedItem.id, "active")
                          setIsDetailsDialogOpen(false)
                        }}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Ativar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog - Fixed */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Editar Anúncio</DialogTitle>
              <DialogDescription>
                Atualize as informações do seu anúncio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Título
                </label>
                <Input
                  value={editForm.title || ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Preço
                  </label>
                  <Input
                    type="number"
                    value={editForm.price || ""}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Estoque
                  </label>
                  <Input
                    type="number"
                    value={editForm.available_quantity || ""}
                    onChange={(e) => setEditForm({ ...editForm, available_quantity: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Descrição
                </label>
                <textarea
                  value={editForm.description || ""}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-md border border-gray-200 dark:border-gray-700 p-3 min-h-[100px] bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateItem}
                disabled={updateItemMutation.isPending}
                className="bg-[#FFE600] hover:bg-[#FFD100] text-black"
              >
                {updateItemMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
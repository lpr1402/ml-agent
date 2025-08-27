"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api-client"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
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
  Eye,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Truck,
  Award,
  List,
  LayoutGrid,
  Download,
  Copy,
  LogOut,
  Sparkles,
  ImageOff,
  Box,
} from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Image from "next/image"

// Types
interface ItemMetrics {
  visits?: any
  performance?: any
  highlights?: any
  salesVelocity?: any
  reviews?: any
  questions?: any
  shipping?: any
  promotions?: any[]
}

interface BulkAction {
  id: string
  label: string
  icon: React.ReactNode
  action: (items: string[]) => void
  variant?: "default" | "destructive"
}

// View modes
type ViewMode = "grid" | "list" | "compact"

export default function AnunciosPageV2() {
  const router = useRouter()
  const { accessToken, logout } = useAuth()
  const queryClient = useQueryClient()
  
  // State
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedQuality, setSelectedQuality] = useState("all")
  const [selectedShipping, setSelectedShipping] = useState("all")
  const [sortBy, setSortBy] = useState("relevance")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [itemMetrics, setItemMetrics] = useState<ItemMetrics>({})
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  // Fetch user data
  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: () => apiClient.get("/api/mercadolibre/user"),
    enabled: !!accessToken,
  })

  // Fetch items with all metrics
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["items", selectedStatus],
    queryFn: async () => {
      // When "all" is selected, don't send status parameter to get all items
      const url = selectedStatus === "all" 
        ? `/api/mercadolibre/items` 
        : `/api/mercadolibre/items?status=${selectedStatus}`
      
      const items = await apiClient.get(url)
      
      // Fetch additional metrics for each item in parallel
      if (items?.items?.length > 0) {
        const itemsWithMetrics = await Promise.all(
          items.items.map(async (item: any) => {
            try {
              // Fetch performance data
              const performanceResponse = await apiClient.get(`/api/mercadolibre/items/${item.id}/performance`)
              return {
                ...item,
                performance: performanceResponse?.data || null,
              }
            } catch (error) {
              console.warn(`Failed to fetch performance for item ${item.id}:`, error)
              return {
                ...item,
                performance: null,
              }
            }
          })
        )
        return { ...items, items: itemsWithMetrics }
      }
      return items
    },
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch sales velocity
  const { data: salesVelocityData } = useQuery({
    queryKey: ["salesVelocity"],
    queryFn: () => apiClient.get("/api/mercadolibre/sales-velocity"),
    enabled: !!accessToken,
    refetchInterval: 30000,
  })

  // Fetch revenue data for different periods
  const { data: revenueData } = useQuery({
    queryKey: ["revenue"],
    queryFn: async () => {
      try {
        // Get orders for last 30 days
        const thirtyDaysRevenue = await apiClient.get("/api/mercadolibre/orders?days=30")
        const sevenDaysRevenue = await apiClient.get("/api/mercadolibre/orders?days=7")
        const todayRevenue = await apiClient.get("/api/mercadolibre/orders?days=1")
        
        return {
          thirtyDays: thirtyDaysRevenue?.total_amount || 0,
          sevenDays: sevenDaysRevenue?.total_amount || 0,
          today: todayRevenue?.total_amount || 0,
        }
      } catch (error) {
        return { thirtyDays: 0, sevenDays: 0, today: 0 }
      }
    },
    enabled: !!accessToken,
    refetchInterval: 60000,
  })

  // Calculate real conversion rate
  const conversionRate = useMemo(() => {
    if (!itemsData?.items?.length) return 0
    
    let totalVisits = 0
    let totalSales = 0
    
    itemsData.items.forEach((item: any) => {
      totalVisits += item.visits?.total_visits || 0
      totalSales += item.sold_quantity || 0
    })
    
    return totalVisits > 0 ? (totalSales / totalVisits) * 100 : 0
  }, [itemsData])

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    if (!itemsData?.items) return []
    
    const filtered = itemsData.items.filter((item: any) => {
      // Search filter
      const matchesSearch = !searchTerm || 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.includes(searchTerm) ||
        item.seller_custom_field?.includes(searchTerm)
      
      // Quality filter
      const matchesQuality = selectedQuality === "all" ||
        (selectedQuality === "high" && item.performance?.score >= 70) ||
        (selectedQuality === "medium" && item.performance?.score >= 40 && item.performance?.score < 70) ||
        (selectedQuality === "low" && item.performance?.score < 40)
      
      // Shipping filter
      const matchesShipping = selectedShipping === "all" ||
        (selectedShipping === "full" && item.shipping?.logistic_type === "fulfillment") ||
        (selectedShipping === "free" && item.shipping?.free_shipping) ||
        (selectedShipping === "me2" && item.shipping?.mode === "me2")
      
      return matchesSearch && matchesQuality && matchesShipping
    })
    
    // Sort items
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case "sales":
          return (b.sold_quantity || 0) - (a.sold_quantity || 0)
        case "revenue":
          return (b.price * (b.sold_quantity || 0)) - (a.price * (a.sold_quantity || 0))
        case "quality":
          return (b.performance?.score || 0) - (a.performance?.score || 0)
        case "visits":
          return (b.visits?.total_visits || 0) - (a.visits?.total_visits || 0)
        case "price_asc":
          return a.price - b.price
        case "price_desc":
          return b.price - a.price
        default:
          return 0
      }
    })
    
    return filtered
  }, [itemsData, searchTerm, selectedQuality, selectedShipping, sortBy])

  // Calculate statistics
  const stats = useMemo(() => {
    if (!itemsData?.items) return {
      total: 0,
      active: 0,
      paused: 0,
      totalSold: 0,
      totalRevenue: 0,
      averageQuality: 0,
      withPromotions: 0,
    }
    
    const items = itemsData.items
    return {
      total: items.length,
      active: items.filter((i: any) => i.status === "active").length,
      paused: items.filter((i: any) => i.status === "paused").length,
      totalSold: items.reduce((sum: number, i: any) => sum + (i.sold_quantity || 0), 0),
      totalRevenue: items.reduce((sum: number, i: any) => sum + (i.price * (i.sold_quantity || 0)), 0),
      averageQuality: items.reduce((sum: number, i: any, _idx: number, arr: any[]) => 
        sum + (i.performance?.score || 0) / arr.length, 0),
      withPromotions: items.filter((i: any) => i.promotions?.length > 0).length,
    }
  }, [itemsData])

  // State for bulk actions loading
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)

  // Bulk actions - Professional tools for high-volume sellers
  const bulkActions: BulkAction[] = [
    {
      id: "pause",
      label: "Pausar Selecionados",
      icon: <Pause className="h-4 w-4" />,
      action: async (items) => {
        setBulkLoading("pause")
        toast.loading(`Pausando ${items.length} anúncios...`, { id: "bulk-pause" })
        
        try {
          // Process in batches of 5 for better performance
          for (let i = 0; i < items.length; i += 5) {
            const batch = items.slice(i, i + 5)
            await Promise.all(
              batch.map(itemId => 
                apiClient.patch(`/api/mercadolibre/items/${itemId}`, { status: "paused" })
              )
            )
          }
          
          queryClient.invalidateQueries({ queryKey: ["items"] })
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>{items.length} anúncios pausados com sucesso!</span>
            </div>,
            { id: "bulk-pause" }
          )
          setSelectedItems(new Set())
        } catch (error) {
          toast.error("Erro ao pausar alguns anúncios", { id: "bulk-pause" })
        } finally {
          setBulkLoading(null)
        }
      },
    },
    {
      id: "activate",
      label: "Ativar Selecionados",
      icon: <Play className="h-4 w-4" />,
      action: async (items) => {
        setBulkLoading("activate")
        toast.loading(`Ativando ${items.length} anúncios...`, { id: "bulk-activate" })
        
        try {
          // Process in batches of 5 for better performance
          for (let i = 0; i < items.length; i += 5) {
            const batch = items.slice(i, i + 5)
            await Promise.all(
              batch.map(itemId => 
                apiClient.patch(`/api/mercadolibre/items/${itemId}`, { status: "active" })
              )
            )
          }
          
          queryClient.invalidateQueries({ queryKey: ["items"] })
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>{items.length} anúncios ativados com sucesso!</span>
            </div>,
            { id: "bulk-activate" }
          )
          setSelectedItems(new Set())
        } catch (error) {
          toast.error("Erro ao ativar alguns anúncios", { id: "bulk-activate" })
        } finally {
          setBulkLoading(null)
        }
      },
    },
    {
      id: "export",
      label: "Exportar Dados",
      icon: <Download className="h-4 w-4" />,
      action: async (items) => {
        setBulkLoading("export")
        toast.loading("Preparando exportação...", { id: "bulk-export" })
        
        try {
          // Get full data for selected items
          const selectedItemsData = filteredAndSortedItems.filter((item: any) => 
            items.includes(item.id)
          )
          
          // Create CSV content
          const csvHeader = "ID,Título,Preço,Estoque,Vendidos,Visitas,Conversão,Receita,Status,Qualidade\n"
          const csvContent = selectedItemsData.map((item: any) => {
            const conversion = item.sold_quantity && item.visits?.total_visits
              ? ((item.sold_quantity / item.visits.total_visits) * 100).toFixed(2)
              : "0"
            const revenue = item.price * (item.sold_quantity || 0)
            
            return `${item.id},"${item.title}",${item.price},${item.available_quantity},${item.sold_quantity || 0},${item.visits?.total_visits || 0},${conversion}%,${revenue},${item.status},${item.performance?.score || 0}%`
          }).join("\n")
          
          // Download CSV
          const blob = new Blob([csvHeader + csvContent], { type: "text/csv;charset=utf-8;" })
          const link = document.createElement("a")
          link.href = URL.createObjectURL(blob)
          link.download = `anuncios_export_${new Date().toISOString().split('T')[0]}.csv`
          link.click()
          
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Exportação concluída!</span>
            </div>,
            { id: "bulk-export" }
          )
        } catch (error) {
          toast.error("Erro ao exportar dados", { id: "bulk-export" })
        } finally {
          setBulkLoading(null)
        }
      },
    },
  ]

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // Select all items
  const selectAllItems = () => {
    if (selectedItems.size === filteredAndSortedItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredAndSortedItems.map((i: any) => i.id)))
    }
  }

  // Fetch detailed metrics for an item
  const fetchItemMetrics = async (itemId: string) => {
    setLoadingMetrics(true)
    try {
      const [visits, performance, highlights, reviews, questions, promotions] = await Promise.allSettled([
        apiClient.get(`/api/mercadolibre/items/${itemId}/visits`),
        apiClient.get(`/api/mercadolibre/items/${itemId}/performance`),
        apiClient.get(`/api/mercadolibre/items/${itemId}/highlights`),
        apiClient.get(`/api/mercadolibre/reviews?item_id=${itemId}`),
        apiClient.get(`/api/mercadolibre/items/${itemId}/questions`),
        apiClient.get(`/api/mercadolibre/promotions`),
      ])
      
      setItemMetrics({
        visits: visits.status === 'fulfilled' ? visits.value?.data : null,
        performance: performance.status === 'fulfilled' ? performance.value?.data : null,
        highlights: highlights.status === 'fulfilled' ? highlights.value : null,
        reviews: reviews.status === 'fulfilled' ? reviews.value : null,
        questions: questions.status === 'fulfilled' ? questions.value : null,
        promotions: promotions.status === 'fulfilled' ? promotions.value : null,
      })
    } catch (error) {
      console.error("Error fetching metrics:", error)
    } finally {
      setLoadingMetrics(false)
    }
  }

  // Status configurations
  const statusConfig = {
    active: { label: "Ativo", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    paused: { label: "Pausado", color: "bg-gray-100 text-gray-800 border-gray-200", icon: Pause },
    closed: { label: "Finalizado", color: "bg-gray-100 text-gray-600 border-gray-200", icon: XCircle },
    under_review: { label: "Em Revisão", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  }

  // Quality level configuration
  const getQualityConfig = (score: number) => {
    if (score >= 70) return { color: "text-green-600 bg-green-50", label: "Profissional" }
    if (score >= 40) return { color: "text-yellow-600 bg-yellow-50", label: "Satisfatório" }
    return { color: "text-red-600 bg-red-50", label: "Básico" }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Premium Header with Logo */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="mr-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Image src="/logo.png" alt="ML Agent" width={150} height={50} className="h-12 w-auto" />
              {userData && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Olá,</span>
                  <span className="text-sm font-medium">{userData.nickname}</span>
                </div>
              )}
            </div>
            
            {/* Real-time metrics in header */}
            <div className="hidden lg:flex items-center space-x-6">
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Anúncios</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.total || 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Vendas Hoje</p>
                <p className="text-lg font-bold text-green-600">
                  {salesVelocityData?.todaySales || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push("/anuncios/novo")}
                className="bg-[#FFE600] hover:bg-[#FFD100] text-black"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Anúncio
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Revenue and Metrics Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          {/* Unified Revenue Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-2 border-gray-800 h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="h-6 w-6 text-gray-900" />
                  <span className="text-xs font-semibold text-gray-500">RECEITA</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">30 dias</span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(revenueData?.thirtyDays || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">7 dias</span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(revenueData?.sevenDays || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs text-gray-500">Hoje</span>
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(revenueData?.today || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2 border-gray-800 h-full">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Box className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">TOTAL</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total || 0}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">Anúncios ativos</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-2 border-gray-800 h-full">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Eye className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">CRESCIMENTO</span>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    (salesVelocityData?.growthRate || 0) >= 0 
                      ? "text-green-600" 
                      : "text-red-600"
                  )}>
                    {(salesVelocityData?.growthRate || 0) >= 0 ? "+" : ""}
                    {(salesVelocityData?.growthRate || 0).toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">
                  {salesVelocityData?.lastWeekSales || 0} vendas (7d)
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-2 border-gray-800 h-full">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Activity className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">CONVERSÃO</span>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    conversionRate >= 5 
                      ? "text-green-600" 
                      : conversionRate >= 2
                      ? "text-yellow-600" 
                      : "text-red-600"
                  )}>
                    {conversionRate.toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">Média geral</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Advanced Filters and Search */}
        <Card className="mb-6 border-2 border-gray-800">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex gap-4">
                <div className="flex-1 flex items-center bg-white border rounded-md shadow-sm focus-within:ring-2 focus-within:ring-[#FFE600] focus-within:border-[#FFE600]">
                  <div className="pl-3 pr-2">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por título, ID, SKU ou GTIN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 py-2.5 pr-3 border-0 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                  />
                </div>
                
                {/* View Mode Toggle - Only List and Compact for Pro Sellers */}
                <div className="flex gap-1 border rounded-lg p-1">
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "compact" ? "secondary" : "ghost"}
                    onClick={() => setViewMode("compact")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Filter Row */}
              <div className="flex flex-wrap gap-3">
                {/* Status Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 px-1">Status</span>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="paused">Pausados</SelectItem>
                      <SelectItem value="closed">Finalizados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quality Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 px-1">Qualidade</span>
                  <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="high">Alta (70%+)</SelectItem>
                      <SelectItem value="medium">Média (40-69%)</SelectItem>
                      <SelectItem value="low">Baixa (&lt;40%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Shipping Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 px-1">Envio</span>
                  <Select value={selectedShipping} onValueChange={setSelectedShipping}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="free">Frete Grátis</SelectItem>
                      <SelectItem value="me2">Mercado Envios</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By - Business Metrics */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 px-1">Ordenar por</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevância</SelectItem>
                      <SelectItem value="revenue">Receita</SelectItem>
                      <SelectItem value="sales">Vendas</SelectItem>
                      <SelectItem value="visits">Visitas</SelectItem>
                      <SelectItem value="quality">Qualidade</SelectItem>
                      <SelectItem value="price_asc">Preço ↑</SelectItem>
                      <SelectItem value="price_desc">Preço ↓</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk Select */}
                {filteredAndSortedItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllItems}
                    className="self-end"
                  >
                    <Checkbox
                      checked={selectedItems.size === filteredAndSortedItems.length}
                      className="mr-2"
                    />
                    Selecionar Todos
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedItems.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6"
            >
              <Card className="border-2 border-[#FFE600]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {selectedItems.size} selecionados
                      </Badge>
                      <div className="flex gap-2">
                        {bulkActions.map((action) => (
                          <Button
                            key={action.id}
                            variant={action.variant || "outline"}
                            size="sm"
                            onClick={() => action.action(Array.from(selectedItems))}
                            disabled={bulkLoading !== null}
                          >
                            {bulkLoading === action.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                            ) : (
                              action.icon
                            )}
                            <span className="ml-2">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedItems(new Set())}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Items Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600]"></div>
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <Card className="border-2 border-gray-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nenhum anúncio encontrado
              </h3>
              <p className="text-gray-500 text-center max-w-md">
                {searchTerm
                  ? "Tente ajustar seus filtros ou busca"
                  : "Comece criando seu primeiro anúncio"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={cn(
            "grid gap-4",
            viewMode === "list" && "grid-cols-1",
            viewMode === "compact" && "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          )}>
            {filteredAndSortedItems.map((item: any) => (
              <ProductCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                isSelected={selectedItems.has(item.id)}
                onToggleSelect={() => toggleItemSelection(item.id)}
                statusConfig={statusConfig}
                getQualityConfig={getQualityConfig}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Product Card Component
function ProductCard({ 
  item, 
  viewMode, 
  isSelected, 
  onToggleSelect,
  statusConfig,
  getQualityConfig 
}: any) {
  const router = useRouter()
  const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.active
  const StatusIcon = config.icon
  const qualityConfig = item.performance ? getQualityConfig(item.performance.score) : null
  
  if (viewMode === "compact") {
    const conversion = item.sold_quantity && item.visits?.total_visits 
      ? ((item.sold_quantity / item.visits.total_visits) * 100).toFixed(1)
      : "0"
    const revenue = item.price * (item.sold_quantity || 0)
    
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-xl border-2 overflow-hidden",
            isSelected ? "border-[#FFE600] shadow-lg" : "border-gray-200 hover:border-gray-800"
          )}
          onClick={() => router.push(`/anuncios/${item.id}`)}
        >
          <div className="aspect-[4/3] relative bg-gray-100 overflow-hidden">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-contain hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageOff className="h-8 w-8 text-gray-300" />
              </div>
            )}
            
            {/* Overlays */}
            <div className="absolute top-2 left-2">
              <Checkbox
                checked={isSelected}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect()
                }}
                className="bg-white shadow-md"
              />
            </div>
            
            <div className="absolute top-2 right-2">
              <Badge className={cn(
                "text-xs px-1.5 py-0.5",
                config.color
              )}>
                {config.label}
              </Badge>
            </div>
            
            {/* Performance Badge */}
            {item.performance && (
              <div className="absolute bottom-2 left-2">
                <Badge className={cn(
                  "text-xs px-1.5 py-0.5",
                  qualityConfig?.color
                )}>
                  {item.performance.score}%
                </Badge>
              </div>
            )}
            
            {/* Full Badge */}
            {item.shipping?.logistic_type === "fulfillment" && (
              <div className="absolute bottom-2 right-2">
                <Badge className="bg-green-600 text-white text-xs px-1.5 py-0.5">
                  FULL
                </Badge>
              </div>
            )}
          </div>
          
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold line-clamp-2 min-h-[2rem]">
              {item.title}
            </p>
            
            <div className="flex justify-between items-center">
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(item.price)}
              </p>
              <div className="text-right">
                <p className="text-xs text-gray-500">Vendas</p>
                <p className="text-sm font-semibold text-green-600">
                  {item.sold_quantity || 0}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-1 pt-2 border-t">
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Estoque</p>
                <p className="text-xs font-semibold">{item.available_quantity}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Conv.</p>
                <p className="text-xs font-semibold">{conversion}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Receita</p>
                <p className="text-xs font-semibold text-green-600">
                  {revenue >= 1000 ? `${(revenue/1000).toFixed(0)}k` : revenue}
                </p>
              </div>
            </div>
            
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card 
        className={cn(
          "group cursor-pointer transition-all hover:shadow-2xl border-2",
          isSelected ? "border-[#FFE600]" : "border-gray-200 hover:border-gray-800",
          viewMode === "list" && "flex"
        )}
        onClick={() => router.push(`/anuncios/${item.id}`)}
      >
        {/* Image Section */}
        <div className={cn(
          "relative bg-gray-100 overflow-hidden",
          viewMode === "list" ? "w-48 h-48" : "aspect-square"
        )}>
          {item.pictures?.[0]?.secure_url || item.thumbnail ? (
            <img
              src={item.pictures?.[0]?.secure_url || item.thumbnail}
              alt={item.title}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="h-12 w-12 text-gray-300" />
            </div>
          )}
          
          {/* Overlays */}
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            <Checkbox
              checked={isSelected}
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect()
              }}
              className="bg-white"
            />
            <Badge className={`${config.color} border`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </div>
          
          <div className="absolute top-2 right-2 flex flex-col gap-2">
            {item.performance && (
              <Badge className={cn(qualityConfig?.color, "border")}>
                <Activity className="h-3 w-3 mr-1" />
                {item.performance.score}%
              </Badge>
            )}
            {item.highlights?.position && (
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                <Award className="h-3 w-3 mr-1" />
                #{item.highlights.position}
              </Badge>
            )}
            {item.shipping?.free_shipping && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Truck className="h-3 w-3" />
              </Badge>
            )}
          </div>
          
          {/* Quick Actions (visible on hover) */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                  {item.status === "active" ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Ativar
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Section */}
        <CardContent className={cn("p-4", viewMode === "list" && "flex-1")}>
          <h3 className="font-semibold text-sm mb-2 line-clamp-2">
            {item.title}
          </h3>
          
          {/* Metrics Grid */}
          <div className={cn(
            "grid gap-2 mb-3",
            viewMode === "list" ? "grid-cols-6" : "grid-cols-2"
          )}>
            <div>
              <p className="text-xs text-gray-500">Preço</p>
              <p className="font-bold text-gray-900">{formatCurrency(item.price)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Estoque</p>
              <p className="font-semibold">{item.available_quantity} un.</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Vendidos</p>
              <p className="font-semibold text-green-600">{item.sold_quantity || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Visitas</p>
              <p className="font-semibold">{formatNumber(item.visits?.total_visits || 0)}</p>
            </div>
            {viewMode === "list" && (
              <>
                <div>
                  <p className="text-xs text-gray-500">Conversão</p>
                  <p className="font-semibold">
                    {item.sold_quantity && item.visits?.total_visits
                      ? ((item.sold_quantity / item.visits.total_visits) * 100).toFixed(2) + "%"
                      : "0%"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Receita</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(item.price * (item.sold_quantity || 0))}
                  </p>
                </div>
              </>
            )}
          </div>
          
          {/* Quality Bar */}
          {item.performance && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Qualidade</span>
                <span className={cn("text-xs font-semibold", qualityConfig?.color)}>
                  {qualityConfig?.label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    item.performance.score >= 70 ? "bg-green-500" :
                    item.performance.score >= 40 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${item.performance.score}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {item.shipping?.free_shipping && (
              <Badge variant="outline" className="text-xs">
                Frete Grátis
              </Badge>
            )}
            {item.accepts_mercadopago && (
              <Badge variant="outline" className="text-xs">
                Mercado Pago
              </Badge>
            )}
            {item.listing_type_id === "gold_special" && (
              <Badge variant="outline" className="text-xs">
                Clássico
              </Badge>
            )}
            {item.promotions?.length > 0 && (
              <Badge variant="outline" className="text-xs text-red-600">
                Em Promoção
              </Badge>
            )}
          </div>
          
          {/* Sparkline (mock - would need real data) */}
          {viewMode !== "compact" && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Últimos 7 dias</span>
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs font-semibold">
                    {item.trend === "up" ? (
                      <span className="text-green-600">↑ 12%</span>
                    ) : item.trend === "down" ? (
                      <span className="text-red-600">↓ 5%</span>
                    ) : (
                      <span className="text-gray-600">→ 0%</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
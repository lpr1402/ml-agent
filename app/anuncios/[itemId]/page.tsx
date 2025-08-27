"use client"

import { useState, useEffect, use } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api-client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Eye,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Activity,
  AlertTriangle,
  AlertCircle,
  Pause,
  Play,
  ExternalLink,
  ImageOff,
  Users,
  Star,
  Truck,
  MessageSquare,
  Info,
  Target,
  Package,
  BarChart3,
  Trophy,
  Upload,
  Trash2,
  LogOut,
  RefreshCw,
  CheckCircle,
  Clock,
  Plus,
  Minus,
  Tag,
  Video,
  CreditCard,
  Shield,
  Hash,
  FileText,
  Package2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import Image from "next/image"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  BarChart,
  Bar,
} from 'recharts'

interface PageProps {
  params: Promise<{ itemId: string }>
}

interface Variation {
  id?: number
  price: number
  available_quantity: number
  sold_quantity?: number
  picture_ids?: string[]
  seller_custom_field?: string
  attributes?: {
    id: string
    name?: string
    value_id?: string
    value_name?: string
  }[]
  attribute_combinations?: {
    id: string
    name?: string
    value_id?: string
    value_name: string
  }[]
}

interface SaleTerm {
  id: string
  value_name: string
}

interface Attribute {
  id: string
  value_name: string
  value_id?: string
}

export default function ProductDetailPage({ params }: PageProps) {
  const { itemId } = use(params)
  const router = useRouter()
  const { accessToken, logout } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState("7")
  const [refreshing, setRefreshing] = useState(false)
  const [editingVariations, setEditingVariations] = useState(false)

  // Main item data with full details
  const { data: item, isLoading: itemLoading, refetch: refetchItem } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => apiClient.get(`/api/mercadolibre/items/${itemId}/details`),
    enabled: !!accessToken && !!itemId,
    refetchInterval: 60000,
  })

  // Category data
  const { data: category } = useQuery({
    queryKey: ["category", item?.category_id],
    queryFn: () => apiClient.get(`/api/mercadolibre/categories/${item.category_id}`),
    enabled: !!accessToken && !!item?.category_id,
  })

  // Shipping methods mapping
  const { data: shippingMethods } = useQuery({
    queryKey: ["shipping-methods"],
    queryFn: () => apiClient.get("/api/mercadolibre/shipping-methods"),
    enabled: !!accessToken,
  })

  // Item description
  const { data: description } = useQuery({
    queryKey: ["description", itemId],
    queryFn: () => apiClient.get(`/api/mercadolibre/items/${itemId}/description`),
    enabled: !!accessToken && !!itemId,
  })

  // Performance metrics
  const { data: performance, refetch: refetchPerformance } = useQuery({
    queryKey: ["performance", itemId],
    queryFn: () => apiClient.get(`/api/mercadolibre/items/${itemId}/performance`),
    enabled: !!accessToken && !!itemId,
    refetchInterval: 300000,
  })

  // Visit metrics with time window
  const { data: visits, refetch: refetchVisits } = useQuery({
    queryKey: ["visits", itemId, selectedPeriod],
    queryFn: async () => {
      const [totalVisits, timeWindowVisits] = await Promise.all([
        apiClient.get(`/api/mercadolibre/items/${itemId}/visits`).catch(() => null),
        apiClient.get(`/api/mercadolibre/items/${itemId}/visits/time_window?last=${selectedPeriod}&unit=day`).catch(() => null)
      ])
      return { total: totalVisits, timeWindow: timeWindowVisits }
    },
    enabled: !!accessToken && !!itemId,
  })

  // Competition data (price to win)
  const { data: competition, refetch: refetchCompetition } = useQuery({
    queryKey: ["competition", itemId],
    queryFn: () => apiClient.get(`/api/mercadolibre/items/${itemId}/price_to_win`),
    enabled: !!accessToken && !!itemId,
    retry: false,
  })

  // Reviews and ratings
  const { data: reviews, refetch: refetchReviews } = useQuery({
    queryKey: ["reviews", itemId],
    queryFn: () => apiClient.get(`/api/mercadolibre/reviews/item/${itemId}`),
    enabled: !!accessToken && !!itemId,
  })

  // Questions
  const { data: questions, refetch: refetchQuestions } = useQuery({
    queryKey: ["questions", itemId],
    queryFn: () => apiClient.get(`/api/mercadolibre/items/${itemId}/questions`),
    enabled: !!accessToken && !!itemId,
  })

  // Initialize edit form when item loads - ALL EDITABLE FIELDS
  useEffect(() => {
    if (item && description) {
      setEditForm({
        // Basic fields
        title: item.title || "",
        price: item.price || 0,
        available_quantity: item.available_quantity || 0,
        condition: item.condition || "new",
        
        // Extended fields
        warranty: item.warranty || "",
        description: description?.plain_text || "",
        video_id: item.video_id || "",
        listing_type_id: item.listing_type_id || "gold_special",
        
        // Shipping configuration
        shipping: item.shipping || {
          mode: "me2",
          local_pick_up: false,
          free_shipping: false,
          logistic_type: "default"
        },
        
        // Arrays and complex fields
        attributes: item.attributes || [],
        sale_terms: item.sale_terms || [],
        pictures: item.pictures || [],
        variations: item.variations || [],
        
        // Payment and sales options
        buying_mode: item.buying_mode || "buy_it_now",
        currency_id: item.currency_id || "BRL",
        accepts_mercadopago: item.accepts_mercadopago !== false,
        
        // Channels (marketplace, mshops, etc)
        channels: item.channels || ["marketplace"],
        
        // Seller fields
        seller_custom_field: item.seller_custom_field || "",
        
        // Category specific attributes
        catalog_product_id: item.catalog_product_id || "",
        domain_id: item.domain_id || "",
        
        // Additional metadata
        tags: item.tags || [],
        status: item.status || "active",
      })
    }
  }, [item, description])

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiClient.put(`/api/mercadolibre/items/${itemId}/update`, data)
    },
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso!")
      setIsEditing(false)
      setEditingVariations(false)
      refetchItem()
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar produto")
    },
  })

  // Update item status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiClient.put(`/api/mercadolibre/items/${itemId}/status`, { status })
    },
    onSuccess: (data, variables) => {
      const statusMessages: Record<string, string> = {
        active: "Anúncio ativado com sucesso!",
        paused: "Anúncio pausado com sucesso!",
        closed: "Anúncio finalizado com sucesso!"
      }
      toast.success(statusMessages[variables])
      refetchItem()
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar status")
    },
  })

  const handleRefreshAll = async () => {
    setRefreshing(true)
    await Promise.all([
      refetchItem(),
      refetchPerformance(),
      refetchVisits(),
      refetchCompetition(),
      refetchReviews(),
      refetchQuestions(),
    ])
    setRefreshing(false)
    toast.success("Dados atualizados!")
  }

  const handleSaveEdit = () => {
    updateItemMutation.mutate(editForm)
  }

  const handleStatusToggle = () => {
    if (!item) return
    const newStatus = item.status === "active" ? "paused" : "active"
    updateStatusMutation.mutate(newStatus)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    const maxFiles = category?.settings?.max_pictures_per_item || 12
    const currentCount = editForm.pictures?.length || 0
    
    if (currentCount + files.length > maxFiles) {
      toast.error(`Máximo de ${maxFiles} imagens permitidas`)
      return
    }
    
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} excede 10MB`)
        continue
      }
      
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        toast.error(`${file.name} deve ser JPG ou PNG`)
        continue
      }
      
      // Upload to ML API would go here
      // For now, create local URL
      const url = URL.createObjectURL(file)
      const newPictures = [...(editForm.pictures || []), { url }]
      setEditForm({ ...editForm, pictures: newPictures })
    }
  }

  // Variation management functions
  const addVariation = () => {
    const newVariation: Variation = {
      price: editForm.price || 0,
      available_quantity: 0,
      attribute_combinations: [],
      picture_ids: [],
      seller_custom_field: ""
    }
    setEditForm({
      ...editForm,
      variations: [...(editForm.variations || []), newVariation]
    })
  }

  const removeVariation = (index: number) => {
    const newVariations = [...editForm.variations]
    newVariations.splice(index, 1)
    setEditForm({ ...editForm, variations: newVariations })
  }

  const updateVariation = (index: number, field: string, value: any) => {
    const newVariations = [...editForm.variations]
    newVariations[index] = { ...newVariations[index], [field]: value }
    setEditForm({ ...editForm, variations: newVariations })
  }

  // Add/Remove sale terms
  const addSaleTerm = () => {
    const newTerm: SaleTerm = {
      id: "",
      value_name: ""
    }
    setEditForm({
      ...editForm,
      sale_terms: [...(editForm.sale_terms || []), newTerm]
    })
  }

  const removeSaleTerm = (index: number) => {
    const newTerms = [...editForm.sale_terms]
    newTerms.splice(index, 1)
    setEditForm({ ...editForm, sale_terms: newTerms })
  }

  // Add/Remove attributes
  const addAttribute = () => {
    const newAttr: Attribute = {
      id: "",
      value_name: ""
    }
    setEditForm({
      ...editForm,
      attributes: [...(editForm.attributes || []), newAttr]
    })
  }

  const removeAttribute = (index: number) => {
    const newAttrs = [...editForm.attributes]
    newAttrs.splice(index, 1)
    setEditForm({ ...editForm, attributes: newAttrs })
  }

  // Calculate key metrics
  const conversionRate = item && visits?.total?.data?.total_visits > 0
    ? ((item.sold_quantity || 0) / (visits?.total?.data?.total_visits || 1)) * 100
    : 0

  const revenue = item ? (item.sold_quantity || 0) * item.price : 0

  // Competition status labels
  const getCompetitionLabel = (status: string | undefined) => {
    const labels: Record<string, { text: string; icon: any; color: string }> = {
      winning: { text: "Ganhando", icon: Trophy, color: "bg-[#FFE600]/20 text-gray-900 border-[#FFE600]" },
      competing: { text: "Competindo", icon: Target, color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      sharing_first_place: { text: "Compartilhando 1º", icon: Users, color: "bg-gray-100 text-gray-800 border-gray-200" },
      listed: { text: "Listado", icon: Package, color: "bg-gray-100 text-gray-600 border-gray-200" },
    }
    return labels[status || ""] || { text: "N/A", icon: Info, color: "bg-gray-100 text-gray-600 border-gray-200" }
  }

  // Quality level labels
  const getQualityConfig = (score: number) => {
    if (score >= 70) return { label: "Profissional", color: "text-[#FFE600] bg-green-50" }
    if (score >= 40) return { label: "Satisfatório", color: "text-yellow-600 bg-yellow-50" }
    return { label: "Básico", color: "text-red-600 bg-red-50" }
  }

  // Status config
  const statusConfig = {
    active: { label: "Ativo", color: "bg-[#FFE600]/20 text-gray-900 border-[#FFE600]", icon: CheckCircle },
    paused: { label: "Pausado", color: "bg-gray-100 text-gray-800 border-gray-200", icon: Pause },
    closed: { label: "Finalizado", color: "bg-gray-100 text-gray-600 border-gray-200", icon: X },
    under_review: { label: "Em Revisão", color: "bg-gray-100 text-gray-800 border-gray-200", icon: Clock },
  }

  // Prepare chart data
  const visitChartData = visits?.timeWindow?.data?.results?.map((result: any) => ({
    date: new Date(result.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    visits: result.total,
  })) || []

  const ratingDistribution = reviews ? [
    { name: '5★', value: reviews.rating_levels?.five_star || 0 },
    { name: '4★', value: reviews.rating_levels?.four_star || 0 },
    { name: '3★', value: reviews.rating_levels?.three_star || 0 },
    { name: '2★', value: reviews.rating_levels?.two_star || 0 },
    { name: '1★', value: reviews.rating_levels?.one_star || 0 },
  ] : []

  // Loading state
  if (itemLoading || !item) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600]"></div>
        </div>
      </div>
    )
  }

  const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.active
  const StatusIcon = config.icon

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Premium Header matching anuncios page */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/anuncios")}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Image src="/logo.png" alt="ML Agent" width={150} height={50} className="h-12 w-auto" />
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Detalhes do Produto</h1>
                  <p className="text-sm text-gray-500">{item.id}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshAll}
                  disabled={refreshing}
                  className="border-gray-200 hover:border-gray-800"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  Atualizar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(item.permalink, "_blank")}
                  className="border-gray-200 hover:border-gray-800"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver no ML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStatusToggle}
                  disabled={updateStatusMutation.isPending}
                  className={cn(
                    "border-gray-200 hover:border-gray-800",
                    item.status === "active" 
                      ? "text-[#FFE600]" 
                      : "text-gray-600"
                  )}
                >
                  {item.status === "active" ? (
                    <Pause className="h-4 w-4 mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {item.status === "active" ? "Pausar" : "Ativar"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout()
                    router.push("/login")
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header with Title and Edit Button */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-gray-800 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-2">
                    <div>
                      <Input
                        value={editForm.title || ""}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 60) // Limite ML
                          setEditForm({ ...editForm, title: value })
                        }}
                        className="text-2xl font-bold"
                        placeholder="Título do anúncio"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {editForm.title?.length || 0}/60 caracteres
                      </p>
                    </div>
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {item.title}
                  </h1>
                )}
                <p className="text-sm text-gray-500 mt-1">ID: {item.id}</p>
              </div>
              <Button
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "ml-4",
                  isEditing 
                    ? "bg-gray-900 hover:bg-gray-800 text-white" 
                    : "bg-[#FFE600] hover:bg-[#FFD100] text-black"
                )}
              >
                {isEditing ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar Edição
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Editar Anúncio
                  </>
                )}
              </Button>
            </div>
            {isEditing && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateItemMutation.isPending}
                  className="bg-[#FFE600] hover:bg-[#FFD100] text-black"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateItemMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            )}
          </div>
          {/* Status Banner */}
          {item.sub_status && item.sub_status.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Atenção</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.sub_status.map((s: string) => s.replace(/_/g, ' ')).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Metrics Cards - Same style as anuncios page */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card className="border-2 border-gray-800">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <DollarSign className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">RECEITA</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue)}</p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">Total acumulado</p>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-gray-800">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <ShoppingCart className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">VENDAS</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{item.sold_quantity || 0}</p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">Unidades vendidas</p>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-gray-800">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Eye className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">VISITAS</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {visits?.total?.data?.total_visits || "N/A"}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">Total de visitas</p>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-gray-800">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <TrendingUp className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">CONVERSÃO</span>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    conversionRate >= 5 
                      ? "text-[#FFE600]" 
                      : conversionRate >= 2
                      ? "text-yellow-600" 
                      : "text-red-600"
                  )}>
                    {conversionRate.toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">Taxa de conversão</p>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-gray-800">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Activity className="h-6 w-6 text-gray-900" />
                    <span className="text-xs font-semibold text-gray-500">QUALIDADE</span>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    (performance?.data?.score || 0) >= 70
                      ? "text-[#FFE600]"
                      : (performance?.data?.score || 0) >= 40
                      ? "text-yellow-600"
                      : "text-red-600"
                  )}>
                    {performance?.data?.score || "N/A"}%
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-auto">Score de qualidade</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Container for All Content */}
          <div className="space-y-6">
            {/* Photos and Metrics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Product Images */}
            <div className="lg:col-span-1">
              <Card className="border-2 border-gray-800 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Imagens do Produto
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Main Image */}
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      {(isEditing ? editForm.pictures : item.pictures) && (isEditing ? editForm.pictures : item.pictures).length > 0 ? (
                        <img
                          src={(isEditing ? editForm.pictures : item.pictures)[selectedImageIndex]?.url || 
                               (isEditing ? editForm.pictures : item.pictures)[selectedImageIndex]?.secure_url || 
                               "/placeholder.png"}
                          alt={item.title}
                          className="w-full h-full object-contain"
                        />
                      ) : item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageOff className="h-16 w-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Image Management in Edit Mode */}
                    {isEditing && (
                      <div className="space-y-3">
                        {/* Add New Image */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="url"
                              placeholder="URL da nova imagem (JPG, PNG, até 10MB)"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value) {
                                  const newPictures = [...(editForm.pictures || []), { url: e.currentTarget.value }]
                                  setEditForm({ ...editForm, pictures: newPictures })
                                  e.currentTarget.value = ""
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              size="icon"
                              className="bg-[#FFE600] hover:bg-[#FFD100] text-black"
                              onClick={() => document.getElementById('image-upload')?.click()}
                              title="Upload de arquivo"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          </div>
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          <p className="text-xs text-gray-500">
                            Máximo {category?.settings?.max_pictures_per_item || 12} imagens • JPG/PNG • Até 10MB cada
                          </p>
                        </div>
                        
                        {/* Image List with Reorder */}
                        <div className="space-y-2">
                          {editForm.pictures?.map((pic: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const newPictures = [...editForm.pictures]
                                    ;[newPictures[idx], newPictures[idx - 1]] = [newPictures[idx - 1], newPictures[idx]]
                                    setEditForm({ ...editForm, pictures: newPictures })
                                  }}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={idx === editForm.pictures.length - 1}
                                  onClick={() => {
                                    const newPictures = [...editForm.pictures]
                                    ;[newPictures[idx], newPictures[idx + 1]] = [newPictures[idx + 1], newPictures[idx]]
                                    setEditForm({ ...editForm, pictures: newPictures })
                                  }}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input
                                value={pic.url || ""}
                                onChange={(e) => {
                                  const newPictures = [...editForm.pictures]
                                  newPictures[idx] = { ...newPictures[idx], url: e.target.value }
                                  setEditForm({ ...editForm, pictures: newPictures })
                                }}
                                placeholder="URL da imagem"
                                className="flex-1 text-sm"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  const newPictures = [...editForm.pictures]
                                  newPictures.splice(idx, 1)
                                  setEditForm({ ...editForm, pictures: newPictures })
                                  if (selectedImageIndex >= newPictures.length) {
                                    setSelectedImageIndex(0)
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Thumbnail Gallery */}
                    {(isEditing ? editForm.pictures : item.pictures) && (isEditing ? editForm.pictures : item.pictures).length > 1 && (
                      <div className="flex space-x-2 overflow-x-auto">
                        {(isEditing ? editForm.pictures : item.pictures).map((pic: any, idx: number) => (
                          <button
                            key={pic.id || idx}
                            onClick={() => setSelectedImageIndex(idx)}
                            className={cn(
                              "relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2",
                              selectedImageIndex === idx 
                                ? "border-[#FFE600]" 
                                : "border-gray-200 hover:border-gray-400"
                            )}
                          >
                            <img
                              src={pic.url || pic.secure_url}
                              alt={`${item.title} ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Metrics Tabs */}
            <div className="lg:col-span-2">
              <Card className="border-2 border-gray-800">
                <CardContent className="p-6">
                  <Tabs defaultValue="performance" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 mb-6 bg-gray-100 p-1 rounded-lg">
                      <TabsTrigger 
                        value="performance" 
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-600"
                      >
                        Performance
                      </TabsTrigger>
                      <TabsTrigger 
                        value="competition"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-600"
                      >
                        Competição
                      </TabsTrigger>
                      <TabsTrigger 
                        value="visits"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-600"
                      >
                        Visitas
                      </TabsTrigger>
                      <TabsTrigger 
                        value="reviews"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-600"
                      >
                        Avaliações
                      </TabsTrigger>
                      <TabsTrigger 
                        value="questions"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-600"
                      >
                        Perguntas
                      </TabsTrigger>
                    </TabsList>

                    {/* Performance Tab */}
                    <TabsContent value="performance" className="space-y-4 mt-0">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Métricas de Performance</h3>
                        {performance?.data && (
                          <Badge className={cn("text-xs", getQualityConfig(performance.data.score).color)}>
                            Score: {performance.data.score}%
                          </Badge>
                        )}
                      </div>

                      {performance?.data ? (
                        <div className="space-y-4">
                          {/* Quality Score */}
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">Score de Qualidade</span>
                              <span className="text-sm text-gray-600">{performance.data.score}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={cn(
                                  "h-2 rounded-full transition-all",
                                  performance.data.score >= 70 ? "bg-green-500" :
                                  performance.data.score >= 40 ? "bg-yellow-500" : "bg-red-500"
                                )}
                                style={{ width: `${performance.data.score}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Nível: {getQualityConfig(performance.data.score).label}
                            </p>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-500">Completude</p>
                              <p className="text-lg font-semibold">
                                {performance.data.completeness?.percentage || 100}%
                              </p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-500">Imagens</p>
                              <p className="text-lg font-semibold">
                                {item.pictures?.length || 0}
                              </p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-500">Atributos</p>
                              <p className="text-lg font-semibold">
                                {item.attributes?.length || 0}
                              </p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-500">Descrição</p>
                              <p className="text-lg font-semibold">
                                {description?.plain_text ? "✓" : "✗"}
                              </p>
                            </div>
                          </div>

                          {/* Pending Actions */}
                          {performance.data.pendingActions && performance.data.pendingActions.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Ações para Melhorar</h4>
                              <div className="space-y-2">
                                {performance.data.pendingActions.map((action: any, index: number) => (
                                  <div key={index} className="flex items-start space-x-2 p-2 bg-yellow-50 rounded-lg">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{action.title}</p>
                                      <p className="text-xs text-gray-600">{action.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">N/A</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Competition Tab */}
                    <TabsContent value="competition" className="space-y-4 mt-0">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Análise de Competição</h3>
                        {competition?.status && (
                          <Badge className={cn("text-xs", getCompetitionLabel(competition.status).color)}>
                            {getCompetitionLabel(competition.status).text}
                          </Badge>
                        )}
                      </div>

                      {competition && !competition.error ? (
                        <div className="space-y-4">
                          {/* Price Comparison */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-500">Seu Preço</p>
                              <p className="text-lg font-semibold">
                                {formatCurrency(competition.currentPrice || item.price)}
                              </p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <p className="text-xs text-gray-500">Preço Ideal</p>
                              <p className="text-lg font-semibold text-[#FFE600]">
                                {competition.priceToWin ? formatCurrency(competition.priceToWin) : "N/A"}
                              </p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <p className="text-xs text-gray-500">Competidores</p>
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {competition.competitorsCount || 0}
                              </p>
                            </div>
                          </div>

                          {/* Visit Share */}
                          {competition.visitShare && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">Compartilhamento de Visitas</p>
                                  <p className="text-lg font-bold capitalize mt-1">
                                    {competition.visitShare}
                                  </p>
                                </div>
                                <BarChart3 className="h-10 w-10 text-gray-400" />
                              </div>
                            </div>
                          )}

                          {/* Boosts */}
                          {competition.boosts && competition.boosts.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Melhorias Disponíveis</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {competition.boosts.map((boost: any, idx: number) => (
                                  <div key={idx} className="p-2 bg-gray-50 rounded-lg">
                                    <p className="text-xs">{boost.description || boost.id}</p>
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {boost.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Winner Info */}
                          {competition.winner && (
                            <div className="p-4 bg-yellow-50 rounded-lg">
                              <p className="text-sm font-medium mb-2">Vencedor Atual</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-xs text-gray-600">ID</span>
                                  <span className="text-xs font-medium">{competition.winner.item_id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs text-gray-600">Preço</span>
                                  <span className="text-xs font-medium">
                                    {formatCurrency(competition.winner.price)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">N/A</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Visits Tab */}
                    <TabsContent value="visits" className="space-y-4 mt-0">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Análise de Visitas</h3>
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 dias</SelectItem>
                            <SelectItem value="15">15 dias</SelectItem>
                            <SelectItem value="30">30 dias</SelectItem>
                            <SelectItem value="60">60 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {visits?.total || visits?.timeWindow ? (
                        <div className="space-y-4">
                          {/* Visit Metrics */}
                          <div className="grid grid-cols-3 gap-4">
                            <Card className="border border-gray-200">
                              <CardContent className="p-4">
                                <Eye className="h-5 w-5 text-gray-400 mb-2" />
                                <p className="text-2xl font-bold">
                                  {visits?.total?.data?.total_visits || 0}
                                </p>
                                <p className="text-xs text-gray-500">Total</p>
                              </CardContent>
                            </Card>
                            <Card className="border border-gray-200">
                              <CardContent className="p-4">
                                <Users className="h-5 w-5 text-gray-400 mb-2" />
                                <p className="text-2xl font-bold">
                                  {visits?.timeWindow?.data?.results?.length > 0 
                                    ? Math.round(visits?.timeWindow?.data?.results?.reduce((acc: number, r: any) => acc + r.total, 0) / visits?.timeWindow?.data?.results?.length)
                                    : 0}
                                </p>
                                <p className="text-xs text-gray-500">Média/dia</p>
                              </CardContent>
                            </Card>
                            <Card className="border border-gray-200">
                              <CardContent className="p-4">
                                <ShoppingCart className="h-5 w-5 text-gray-400 mb-2" />
                                <p className="text-2xl font-bold">
                                  {conversionRate.toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-500">Conversão</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Visit Chart */}
                          {visitChartData.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-3">Tendência de Visitas</h4>
                              <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={visitChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                                  <XAxis dataKey="date" stroke="#999" />
                                  <YAxis stroke="#999" />
                                  <RechartsTooltip />
                                  <Area 
                                    type="monotone" 
                                    dataKey="visits" 
                                    stroke="#FFE600"
                                    fill="#FFE600"
                                    fillOpacity={0.3}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Eye className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">N/A</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Reviews Tab */}
                    <TabsContent value="reviews" className="space-y-4 mt-0">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Avaliações</h3>
                        {reviews?.rating_average && (
                          <div className="flex items-center space-x-2">
                            <Star className="h-5 w-5 text-[#FFE600] fill-current" />
                            <span className="font-semibold">{reviews.rating_average.toFixed(1)}</span>
                            <span className="text-sm text-gray-600">({reviews.paging?.total || 0})</span>
                          </div>
                        )}
                      </div>

                      {reviews && reviews.reviews?.length > 0 ? (
                        <div className="space-y-4">
                          {/* Rating Distribution */}
                          {ratingDistribution.some(r => r.value > 0) && (
                            <div>
                              <h4 className="text-sm font-medium mb-3">Distribuição</h4>
                              <ResponsiveContainer width="100%" height={150}>
                                <BarChart data={ratingDistribution}>
                                  <XAxis dataKey="name" stroke="#999" />
                                  <YAxis stroke="#999" />
                                  <RechartsTooltip />
                                  <Bar dataKey="value" fill="#FFE600" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* Recent Reviews */}
                          <div className="space-y-3">
                            {reviews.reviews.slice(0, 3).map((review: any) => (
                              <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={cn(
                                          "h-3 w-3",
                                          i < review.rating 
                                            ? "text-[#FFE600] fill-current" 
                                            : "text-gray-300"
                                        )}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-600">
                                    {new Date(review.date_created).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                {review.content && (
                                  <p className="text-sm text-gray-700">{review.content}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">N/A</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Questions Tab */}
                    <TabsContent value="questions" className="space-y-4 mt-0">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Perguntas</h3>
                        {questions?.paging?.total && (
                          <Badge variant="outline" className="text-xs">
                            {questions.paging.total} perguntas
                          </Badge>
                        )}
                      </div>

                      {questions?.questions && questions.questions.length > 0 ? (
                        <div className="space-y-3">
                          {questions.questions.slice(0, 5).map((q: any) => (
                            <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="space-y-2">
                                <div>
                                  <p className="text-sm font-medium">P:</p>
                                  <p className="text-sm text-gray-700">{q.text}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {new Date(q.date_created).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                {q.answer && (
                                  <div>
                                    <p className="text-sm font-medium">R:</p>
                                    <p className="text-sm text-gray-700">{q.answer.text}</p>
                                  </div>
                                )}
                                {!q.answer && (
                                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                                    Aguardando resposta
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">N/A</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
            </div>

            {/* Product Details & Shipping - FULL WIDTH matching Photos + Metrics width */}
            <div className="grid grid-cols-12 gap-4">
              {/* Product Info - Wider and taller for all information */}
              <Card className="col-span-12 lg:col-span-9 border-2 border-gray-800 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                    <Package className="h-5 w-5 mr-2" />
                    Informações do Anúncio
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {isEditing ? (
                    <div className="space-y-6">
                      {/* Basic Information Section */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center">
                          <Info className="h-4 w-4 mr-2" />
                          Informações Básicas
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-medium text-gray-700">Título do Anúncio (máx. 60 caracteres)</label>
                            <Input
                              value={editForm.title || ""}
                              onChange={(e) => {
                                const value = e.target.value.slice(0, 60)
                                setEditForm({ ...editForm, title: value })
                              }}
                              className="mt-1"
                              maxLength={60}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {editForm.title?.length || 0}/60 caracteres
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-700">ID do Produto</label>
                              <Input
                                value={item.id}
                                disabled
                                className="mt-1 bg-gray-100"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-700">SKU Interno</label>
                              <Input
                                value={editForm.seller_custom_field || ""}
                                onChange={(e) => setEditForm({ ...editForm, seller_custom_field: e.target.value })}
                                className="mt-1"
                                placeholder="Código interno"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pricing and Stock Section */}
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Preço e Estoque
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-medium text-gray-700">Preço (R$)</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.price || ""}
                              onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-700">Quantidade Disponível</label>
                            <Input
                              type="number"
                              value={editForm.available_quantity || ""}
                              onChange={(e) => setEditForm({ ...editForm, available_quantity: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-700">Condição</label>
                            <Select 
                              value={editForm.condition} 
                              onValueChange={(value) => setEditForm({ ...editForm, condition: value })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">Novo</SelectItem>
                                <SelectItem value="used">Usado</SelectItem>
                                <SelectItem value="refurbished">Recondicionado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Sales Configuration */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Configuração de Venda
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-700">Tipo de Anúncio</label>
                            <Select 
                              value={editForm.listing_type_id} 
                              onValueChange={(value) => setEditForm({ ...editForm, listing_type_id: value })}
                            >
                              <SelectTrigger className="mt-1 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gold_special">Clássico</SelectItem>
                                <SelectItem value="gold_pro">Premium</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-700">Modo de Compra</label>
                            <Select 
                              value={editForm.buying_mode} 
                              onValueChange={(value) => setEditForm({ ...editForm, buying_mode: value })}
                            >
                              <SelectTrigger className="mt-1 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="buy_it_now">Compra Imediata</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-700">Moeda</label>
                            <Select 
                              value={editForm.currency_id} 
                              onValueChange={(value) => setEditForm({ ...editForm, currency_id: value })}
                            >
                              <SelectTrigger className="mt-1 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BRL">BRL</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-700">Garantia</label>
                            <Input
                              value={editForm.warranty || ""}
                              onChange={(e) => setEditForm({ ...editForm, warranty: e.target.value })}
                              className="mt-1 text-sm"
                              placeholder="Ex: 12 meses"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-700">ID do Vídeo</label>
                            <div className="flex gap-2">
                              <Video className="h-4 w-4 text-gray-400 mt-2" />
                              <Input
                                value={editForm.video_id || ""}
                                onChange={(e) => setEditForm({ ...editForm, video_id: e.target.value })}
                                className="mt-1 text-sm flex-1"
                                placeholder="ID do vídeo no YouTube"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <Checkbox
                            checked={editForm.accepts_mercadopago}
                            onCheckedChange={(checked) => 
                              setEditForm({ ...editForm, accepts_mercadopago: checked })
                            }
                          />
                          <label className="text-sm">Aceita Mercado Pago</label>
                        </div>
                      </div>

                      {/* Channels */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                          <Shield className="h-4 w-4 mr-2" />
                          Canais de Venda
                        </h4>
                        <div className="flex items-center space-x-4">
                          <Checkbox
                            checked={editForm.channels?.includes("marketplace")}
                            onCheckedChange={(checked) => {
                              const channels = editForm.channels || []
                              if (checked && !channels.includes("marketplace")) {
                                setEditForm({ ...editForm, channels: [...channels, "marketplace"] })
                              } else if (!checked) {
                                setEditForm({ ...editForm, channels: channels.filter((c: string) => c !== "marketplace") })
                              }
                            }}
                          />
                          <label className="text-sm">Marketplace</label>
                          
                          <Checkbox
                            checked={editForm.channels?.includes("mshops")}
                            onCheckedChange={(checked) => {
                              const channels = editForm.channels || []
                              if (checked && !channels.includes("mshops")) {
                                setEditForm({ ...editForm, channels: [...channels, "mshops"] })
                              } else if (!checked) {
                                setEditForm({ ...editForm, channels: channels.filter((c: string) => c !== "mshops") })
                              }
                            }}
                          />
                          <label className="text-sm">Mercado Shops</label>
                        </div>
                      </div>

                      {/* Variations - Always Visible and Editable */}
                      <div className="bg-[#FFE600]/10 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                          <span className="flex items-center">
                            <Package2 className="h-4 w-4 mr-2" />
                            Variações do Produto
                          </span>
                          <Button
                            size="sm"
                            onClick={addVariation}
                            className="bg-[#FFE600] hover:bg-[#FFD100] text-black"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Nova Variação
                          </Button>
                        </h4>
                        {editForm.variations && editForm.variations.length > 0 ? (
                          <div className="space-y-3">
                            {editForm.variations.map((variation: Variation, idx: number) => (
                              <div key={variation.id || idx} className="bg-white p-4 rounded-lg border border-indigo-200">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="space-y-1">
                                    <span className="text-sm font-semibold text-gray-800">
                                      Variação {idx + 1}
                                    </span>
                                    {variation.attribute_combinations && variation.attribute_combinations.length > 0 && (
                                      <div className="text-xs text-gray-600">
                                        {variation.attribute_combinations.map((attr: any) => (
                                          <span key={attr.id} className="inline-block bg-gray-100 px-2 py-1 rounded mr-1">
                                            {attr.name}: {attr.value_name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeVariation(idx)}
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="text-xs font-medium text-gray-700">Preço (R$)</label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={variation.price || editForm.price}
                                      onChange={(e) => updateVariation(idx, "price", parseFloat(e.target.value))}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-700">Quantidade Disponível</label>
                                    <Input
                                      type="number"
                                      value={variation.available_quantity || 0}
                                      onChange={(e) => updateVariation(idx, "available_quantity", parseInt(e.target.value))}
                                      className="mt-1"
                                    />
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs font-medium text-gray-700">SKU da Variação</label>
                                    <Input
                                      value={variation.seller_custom_field || ""}
                                      onChange={(e) => updateVariation(idx, "seller_custom_field", e.target.value)}
                                      className="mt-1"
                                      placeholder="Código único"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-700">EAN/GTIN</label>
                                    <Input
                                      value={variation.attributes?.find((a: any) => a.id === "EAN")?.value_name || ""}
                                      onChange={(e) => {
                                        const newVariations = [...editForm.variations]
                                        if (!newVariations[idx].attributes) {
                                          newVariations[idx].attributes = []
                                        }
                                        const eanIndex = newVariations[idx].attributes.findIndex((a: any) => a.id === "EAN")
                                        if (eanIndex >= 0) {
                                          newVariations[idx].attributes[eanIndex].value_name = e.target.value
                                        } else {
                                          newVariations[idx].attributes.push({ id: "EAN", value_name: e.target.value })
                                        }
                                        setEditForm({ ...editForm, variations: newVariations })
                                      }}
                                      className="mt-1"
                                      placeholder="Código de barras"
                                    />
                                  </div>
                                </div>
                                
                                {/* Picture IDs for variation */}
                                <div className="mt-3">
                                  <label className="text-xs font-medium text-gray-700">URLs das Imagens (separadas por vírgula)</label>
                                  <Input
                                    value={variation.picture_ids?.join(", ") || ""}
                                    onChange={(e) => {
                                      const urls = e.target.value.split(",").map(url => url.trim()).filter(url => url)
                                      updateVariation(idx, "picture_ids", urls)
                                    }}
                                    className="mt-1"
                                    placeholder="https://exemplo.com/img1.jpg, https://exemplo.com/img2.jpg"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-indigo-300">
                            <Package2 className="h-12 w-12 text-indigo-400 mx-auto mb-3" />
                            <p className="text-sm text-gray-600">Nenhuma variação cadastrada</p>
                            <p className="text-xs text-gray-500 mt-1">Clique em &quot;Nova Variação&quot; para adicionar</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-2">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={updateItemMutation.isPending}
                          className="bg-[#FFE600] hover:bg-[#FFD100] text-black"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Salvar Tudo
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false)
                            setEditingVariations(false)
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* View Mode - Organized Sections */}
                      
                      {/* Basic Information Section */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">Informações Básicas</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">ID do Produto</p>
                            <p className="text-sm font-semibold text-gray-900">{item.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">SKU Interno</p>
                            <p className="text-sm font-semibold text-gray-900">{item.seller_custom_field || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Categoria</p>
                            <p className="text-sm font-semibold text-gray-900">{category?.name || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Código de Catálogo</p>
                            <p className="text-sm font-semibold text-gray-900">{item.catalog_product_id || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Domínio</p>
                            <p className="text-sm font-semibold text-gray-900">{item.domain_id || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Canais de Venda</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.channels?.join(", ") || "marketplace"}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Pricing and Stock Section */}
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">Preço e Estoque</h4>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Preço</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(item.price)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Estoque Disponível</p>
                            <p className="text-lg font-semibold text-gray-900">{item.available_quantity} un</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Condição</p>
                            <Badge className="mt-1" variant="outline">
                              {item.condition === "new" ? "Novo" : item.condition === "used" ? "Usado" : "Recondicionado"}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Vendidos</p>
                            <p className="text-lg font-semibold text-gray-900">{item.sold_quantity || 0}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Listing Configuration Section */}
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">Configuração do Anúncio</h4>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Status</p>
                            <Badge className={cn("mt-1", config.color)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Tipo de Anúncio</p>
                            <Badge className="mt-1" variant="secondary">
                              {item.listing_type_id === "gold_pro" ? "Premium" :
                               item.listing_type_id === "gold_special" ? "Clássico" :
                               item.listing_type_id === "gold" ? "Gold" :
                               item.listing_type_id === "silver" ? "Silver" :
                               item.listing_type_id === "bronze" ? "Bronze" : "Gratuito"}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Garantia</p>
                            <p className="text-sm font-semibold text-gray-900">{item.warranty || "Sem garantia"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Mercado Pago</p>
                            <Badge variant="outline" className={cn(
                              "mt-1",
                              item.accepts_mercadopago 
                                ? "bg-[#FFE600]/20 text-gray-900 border-[#FFE600]"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            )}>
                              {item.accepts_mercadopago ? "Aceita" : "Não aceita"}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Modo de Compra</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.buying_mode === "buy_it_now" ? "Compra Imediata" : item.buying_mode}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Vídeo</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.video_id ? "✓ Com vídeo" : "Sem vídeo"}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Attributes Section */}
                      {item.attributes && item.attributes.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-3">Atributos</h4>
                          <div className="grid grid-cols-3 gap-3">
                            {item.attributes.slice(0, 9).map((attr: any) => (
                              <div key={attr.id}>
                                <p className="text-xs text-gray-500">{attr.name || attr.id}</p>
                                <p className="text-sm font-medium text-gray-900">{attr.value_name || "N/A"}</p>
                              </div>
                            ))}
                          </div>
                          {item.attributes.length > 9 && (
                            <p className="text-xs text-gray-500 mt-2">+{item.attributes.length - 9} mais atributos</p>
                          )}
                        </div>
                      )}
                      
                      {/* Sale Terms Section */}
                      {item.sale_terms && item.sale_terms.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-3">Termos de Venda</h4>
                          <div className="grid grid-cols-3 gap-3">
                            {item.sale_terms.map((term: any) => (
                              <div key={term.id}>
                                <p className="text-xs text-gray-500">{term.name || term.id}</p>
                                <p className="text-sm font-medium text-gray-900">{term.value_name || "N/A"}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Variations Display */}
                      {item.variations && item.variations.length > 0 && (
                        <div className="bg-[#FFE600]/10 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-3">Variações do Produto</h4>
                          <div className="space-y-2">
                            {item.variations.map((variation: any, idx: number) => (
                              <div key={variation.id || idx} className="p-3 bg-white rounded-lg border border-indigo-200">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">
                                      {variation.attribute_combinations?.map((attr: any) => 
                                        `${attr.value_name}`
                                      ).join(", ")}
                                    </span>
                                  </div>
                                  <div className="flex gap-4">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(variation.price)}</span>
                                    <Badge variant="outline" className="text-xs">
                                      Estoque: {variation.available_quantity}
                                    </Badge>
                                    {variation.sold_quantity > 0 && (
                                      <span className="text-[#FFE600]">Vendidos: {variation.sold_quantity}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Shipping Info - Narrower width */}
              <Card className="col-span-12 lg:col-span-3 border-2 border-gray-800 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                    <Truck className="h-5 w-5 mr-2" />
                    Envio
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      {/* Shipping Mode */}
                      <div>
                        <label className="text-xs font-medium text-gray-700">Modo de Envio</label>
                        <Select 
                          value={editForm.shipping?.mode || "not_specified"}
                          onValueChange={(value) => setEditForm({ 
                            ...editForm, 
                            shipping: { ...editForm.shipping, mode: value }
                          })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="me2">Mercado Envios Full</SelectItem>
                            <SelectItem value="me1">Mercado Envios Flex</SelectItem>
                            <SelectItem value="custom">Envio Personalizado</SelectItem>
                            <SelectItem value="not_specified">Não Especificado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Logistic Type */}
                      <div>
                        <label className="text-xs font-medium text-gray-700">Tipo de Logística</label>
                        <Select 
                          value={editForm.shipping?.logistic_type || "default"}
                          onValueChange={(value) => setEditForm({ 
                            ...editForm, 
                            shipping: { ...editForm.shipping, logistic_type: value }
                          })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fulfillment">Envio pelo ML (Full)</SelectItem>
                            <SelectItem value="cross_docking">Envio Direto</SelectItem>
                            <SelectItem value="drop_off">Entrega em Agência</SelectItem>
                            <SelectItem value="xd_drop_off">Entrega Expressa</SelectItem>
                            <SelectItem value="default">Envio Padrão</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Shipping Options */}
                      <div className="space-y-3">
                        <div className="bg-[#FFE600]/10 p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Frete Grátis</label>
                              <p className="text-xs text-gray-600">Você paga o frete</p>
                            </div>
                            <Checkbox
                              checked={editForm.shipping?.free_shipping || false}
                              onCheckedChange={(checked) => 
                                setEditForm({ 
                                  ...editForm, 
                                  shipping: { ...editForm.shipping, free_shipping: checked as boolean }
                                })
                              }
                              className="h-5 w-5"
                            />
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Retirada no Local</label>
                              <p className="text-xs text-gray-600">No seu endereço</p>
                            </div>
                            <Checkbox
                              checked={editForm.shipping?.local_pick_up || false}
                              onCheckedChange={(checked) => 
                                setEditForm({ 
                                  ...editForm, 
                                  shipping: { ...editForm.shipping, local_pick_up: checked as boolean }
                                })
                              }
                              className="h-5 w-5"
                            />
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Retirada em Loja</label>
                              <p className="text-xs text-gray-600">Para lojas oficiais</p>
                            </div>
                            <Checkbox
                              checked={editForm.shipping?.store_pick_up || false}
                              onCheckedChange={(checked) => 
                                setEditForm({ 
                                  ...editForm, 
                                  shipping: { ...editForm.shipping, store_pick_up: checked as boolean }
                                })
                              }
                              className="h-5 w-5"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Shipping Dimensions */}
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <h5 className="text-xs font-semibold text-gray-700 mb-2">Dimensões do Pacote</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-600">Peso (g)</label>
                            <Input
                              type="number"
                              value={editForm.shipping?.dimensions?.weight || ""}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                shipping: { 
                                  ...editForm.shipping, 
                                  dimensions: { 
                                    ...editForm.shipping?.dimensions,
                                    weight: e.target.value
                                  }
                                }
                              })}
                              className="mt-1 text-sm"
                              placeholder="500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Altura (cm)</label>
                            <Input
                              type="number"
                              value={editForm.shipping?.dimensions?.height || ""}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                shipping: { 
                                  ...editForm.shipping, 
                                  dimensions: { 
                                    ...editForm.shipping?.dimensions,
                                    height: e.target.value
                                  }
                                }
                              })}
                              className="mt-1 text-sm"
                              placeholder="10"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Largura (cm)</label>
                            <Input
                              type="number"
                              value={editForm.shipping?.dimensions?.width || ""}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                shipping: { 
                                  ...editForm.shipping, 
                                  dimensions: { 
                                    ...editForm.shipping?.dimensions,
                                    width: e.target.value
                                  }
                                }
                              })}
                              className="mt-1 text-sm"
                              placeholder="20"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Comprimento (cm)</label>
                            <Input
                              type="number"
                              value={editForm.shipping?.dimensions?.length || ""}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                shipping: { 
                                  ...editForm.shipping, 
                                  dimensions: { 
                                    ...editForm.shipping?.dimensions,
                                    length: e.target.value
                                  }
                                }
                              })}
                              className="mt-1 text-sm"
                              placeholder="30"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Modo</p>
                        <p className="text-sm font-medium">
                          {item.shipping?.mode 
                            ? shippingMethods?.map?.[item.shipping.mode] || item.shipping.mode
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Frete Grátis</p>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          item.shipping?.free_shipping 
                            ? "bg-[#FFE600]/20 text-gray-900 border-[#FFE600]"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                          {item.shipping?.free_shipping ? "Sim" : "Não"}
                        </Badge>
                      </div>
                      {item.shipping?.logistic_type && (
                        <div>
                          <p className="text-xs text-gray-500">Logística</p>
                          <Badge className="bg-[#FFE600]/20 text-gray-900 border-[#FFE600] text-xs">
                            {item.shipping.logistic_type === "fulfillment" ? "Envio pelo ML" :
                             item.shipping.logistic_type === "cross_docking" ? "Envio Direto" :
                             item.shipping.logistic_type === "drop_off" ? "Entrega em Agência" :
                             item.shipping.logistic_type === "xd_drop_off" ? "Entrega Expressa" :
                             "Envio Padrão"}
                          </Badge>
                        </div>
                      )}
                      {item.shipping?.local_pick_up && (
                        <div>
                          <p className="text-xs text-gray-500">Retirada</p>
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 border-gray-200">
                            Disponível
                          </Badge>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Description Section - Always Visible and Editable */}
            <Card className="border-2 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Descrição do Produto
                  </span>
                  {!isEditing && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsEditing(true)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editForm.description || description?.plain_text || ""}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 50000)
                        setEditForm({ ...editForm, description: value })
                      }}
                      rows={8}
                      className="w-full font-mono text-sm"
                      placeholder="Digite a descrição completa do produto. Use texto simples, sem HTML. Quebras de linha são permitidas."
                      maxLength={50000}
                    />
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{(editForm.description || description?.plain_text || "").length}/50000 caracteres</span>
                      <span>Apenas texto simples (sem HTML)</span>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {description?.plain_text || "Clique no botão de editar para adicionar uma descrição detalhada do produto."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
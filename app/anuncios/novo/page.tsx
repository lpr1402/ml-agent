"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Toaster, toast } from "sonner"
import {
  ArrowLeft,
  Plus,
  Upload,
  X,
  Package,
  DollarSign,
  Tag,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  Sparkles,
  ShoppingBag,
  Box,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Categorias principais do Mercado Livre Brasil
const CATEGORIES = [
  { id: "MLB5672", name: "Acessórios para Veículos", icon: "🚗" },
  { id: "MLB271599", name: "Agro", icon: "🌾" },
  { id: "MLB1403", name: "Alimentos e Bebidas", icon: "🍔" },
  { id: "MLB1071", name: "Animais", icon: "🐾" },
  { id: "MLB1367", name: "Antiguidades e Coleções", icon: "🏺" },
  { id: "MLB1368", name: "Arte, Papelaria e Armarinho", icon: "🎨" },
  { id: "MLB1384", name: "Bebês", icon: "👶" },
  { id: "MLB1246", name: "Beleza e Cuidado Pessoal", icon: "💄" },
  { id: "MLB1132", name: "Brinquedos e Hobbies", icon: "🧸" },
  { id: "MLB1430", name: "Calçados, Roupas e Bolsas", icon: "👗" },
  { id: "MLB1039", name: "Câmeras e Acessórios", icon: "📷" },
  { id: "MLB1743", name: "Carros, Motos e Outros", icon: "🏎️" },
  { id: "MLB1574", name: "Casa, Móveis e Decoração", icon: "🏠" },
  { id: "MLB1051", name: "Celulares e Telefones", icon: "📱" },
  { id: "MLB1500", name: "Construção", icon: "🔨" },
  { id: "MLB5726", name: "Eletrodomésticos", icon: "🔌" },
  { id: "MLB1000", name: "Eletrônicos, Áudio e Vídeo", icon: "📺" },
  { id: "MLB1276", name: "Esportes e Fitness", icon: "⚽" },
  { id: "MLB263532", name: "Ferramentas", icon: "🔧" },
  { id: "MLB1182", name: "Festas e Lembrancinhas", icon: "🎉" },
  { id: "MLB1144", name: "Games", icon: "🎮" },
  { id: "MLB1459", name: "Imóveis", icon: "🏢" },
  { id: "MLB1499", name: "Indústria e Comércio", icon: "🏭" },
  { id: "MLB1648", name: "Informática", icon: "💻" },
  { id: "MLB218519", name: "Ingressos", icon: "🎫" },
  { id: "MLB1168", name: "Instrumentos Musicais", icon: "🎸" },
  { id: "MLB3937", name: "Joias e Relógios", icon: "💎" },
  { id: "MLB1196", name: "Livros, Revistas e Comics", icon: "📚" },
  { id: "MLB1953", name: "Mais Categorias", icon: "➕" },
  { id: "MLB1362", name: "Música, Filmes e Seriados", icon: "🎬" },
  { id: "MLB264586", name: "Saúde", icon: "🏥" },
  { id: "MLB1540", name: "Serviços", icon: "🛠️" },
]

export default function NovoAnuncioPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [step, setStep] = useState(1)
  const [images, setImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  
  const [formData, setFormData] = useState({
    title: "",
    category_id: "",
    price: "",
    currency_id: "BRL",
    available_quantity: "",
    condition: "new",
    listing_type_id: "gold_special",
    description: "",
    warranty_type: "seller",
    warranty_time: "90 dias",
    brand: "",
    model: "",
    pictures: [] as Array<{ source: string }>,
    shipping: {
      mode: "me2",
      free_shipping: false,
    },
    sale_terms: [] as Array<{ id: string; value_name: string }>,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
      // Prepare sale_terms
      const saleTerms = []
      if (data.warranty_type && data.warranty_time) {
        saleTerms.push(
          { id: "WARRANTY_TYPE", value_name: data.warranty_type === "seller" ? "Garantia do vendedor" : "Garantia de fábrica" },
          { id: "WARRANTY_TIME", value_name: data.warranty_time }
        )
      }

      // Prepare attributes
      const attributes = []
      if (data.brand) {
        attributes.push({ id: "BRAND", value_name: data.brand })
      }
      if (data.model) {
        attributes.push({ id: "MODEL", value_name: data.model })
      }

      const payload = {
        title: data.title,
        category_id: data.category_id,
        price: parseFloat(data.price),
        currency_id: data.currency_id,
        available_quantity: parseInt(data.available_quantity),
        condition: data.condition,
        listing_type_id: data.listing_type_id,
        pictures: images.map(url => ({ source: url })),
        sale_terms: saleTerms,
        attributes: attributes,
        shipping: data.shipping,
        buying_mode: "buy_it_now",
      }

      return apiClient.post("/api/mercadolibre/items", payload)
    },
    onSuccess: (data) => {
      toast.success("Anúncio criado com sucesso!")
      setTimeout(() => {
        router.push("/anuncios")
      }, 2000)
    },
    onError: (error: any) => {
      console.error("Error creating item:", error)
      toast.error(error.response?.data?.message || "Erro ao criar anúncio")
    },
  })

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (stepNumber === 1) {
      if (!formData.title) newErrors.title = "Título é obrigatório"
      if (formData.title && formData.title.length < 10) newErrors.title = "Título muito curto"
      if (!formData.category_id) newErrors.category_id = "Categoria é obrigatória"
      if (!formData.condition) newErrors.condition = "Condição é obrigatória"
    }

    if (stepNumber === 2) {
      if (!formData.price) newErrors.price = "Preço é obrigatório"
      if (parseFloat(formData.price) <= 0) newErrors.price = "Preço deve ser maior que zero"
      if (!formData.available_quantity) newErrors.quantity = "Quantidade é obrigatória"
      if (parseInt(formData.available_quantity) <= 0) newErrors.quantity = "Quantidade deve ser maior que zero"
    }

    if (stepNumber === 3) {
      if (images.length === 0) newErrors.images = "Adicione pelo menos uma imagem"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1)
    }
  }

  const handlePreviousStep = () => {
    setStep(step - 1)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setIsUploading(true)
    
    // Simulate image upload - in production, upload to a CDN
    setTimeout(() => {
      const newImages = Array.from(files).map(file => URL.createObjectURL(file))
      setImages([...images, ...newImages].slice(0, 6)) // Max 6 images
      setIsUploading(false)
      toast.success(`${files.length} imagem(ns) adicionada(s)`)
    }, 1000)
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) return
    await createItemMutation.mutateAsync(formData)
  }

  const conditions = [
    { value: "new", label: "Novo", icon: Sparkles, color: "text-green-600" },
    { value: "used", label: "Usado", icon: Package, color: "text-amber-600" },
    { value: "refurbished", label: "Recondicionado", icon: Box, color: "text-blue-600" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Toaster position="top-center" richColors />
      
      {/* Premium Header */}
      <header className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/anuncios")}
                className="rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-[#FFE600] to-[#FFD100] rounded-2xl shadow-lg shadow-yellow-500/20">
                  <Plus className="h-6 w-6 text-black" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Criar Novo Anúncio
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Publique seu produto no Mercado Livre
                  </p>
                </div>
              </div>
            </div>
            
            {/* Step Indicator */}
            <div className="hidden md:flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      step === s
                        ? "bg-[#FFE600] text-black shadow-lg shadow-yellow-500/30"
                        : step > s
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    }`}
                  >
                    {step > s ? <CheckCircle className="h-5 w-5" /> : s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`w-12 h-0.5 ${
                        step > s ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-0 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl">Informações Básicas</CardTitle>
                  <CardDescription>
                    Descreva seu produto com detalhes para atrair compradores
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Título do Anúncio *
                    </label>
                    <Input
                      placeholder="Ex: iPhone 13 Pro Max 256GB Azul Sierra"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className={`h-12 rounded-xl ${errors.title ? "border-red-500" : ""}`}
                    />
                    {errors.title && (
                      <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.title}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Seja específico e inclua marca, modelo e características principais
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Categoria *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setFormData({ ...formData, category_id: cat.id })}
                          className={`p-3 rounded-xl border-2 transition-all hover:shadow-md ${
                            formData.category_id === cat.id
                              ? "border-[#FFE600] bg-[#FFE600]/10"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <div className="text-2xl mb-1">{cat.icon}</div>
                          <div className="text-xs font-medium">{cat.name}</div>
                        </button>
                      ))}
                    </div>
                    {errors.category_id && (
                      <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.category_id}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Condição do Produto *
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {conditions.map((cond) => {
                        const Icon = cond.icon
                        return (
                          <button
                            key={cond.value}
                            onClick={() => setFormData({ ...formData, condition: cond.value })}
                            className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                              formData.condition === cond.value
                                ? "border-[#FFE600] bg-[#FFE600]/10"
                                : "border-gray-200 dark:border-gray-700"
                            }`}
                          >
                            <Icon className={`h-6 w-6 ${cond.color} mb-2 mx-auto`} />
                            <div className="text-sm font-medium">{cond.label}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Marca (opcional)
                      </label>
                      <Input
                        placeholder="Ex: Apple"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Modelo (opcional)
                      </label>
                      <Input
                        placeholder="Ex: iPhone 13 Pro Max"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        className="h-12 rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Pricing and Stock */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-0 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl">Preço e Estoque</CardTitle>
                  <CardDescription>
                    Defina o valor e quantidade disponível
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        <DollarSign className="h-4 w-4 inline mr-1" />
                        Preço *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                        <Input
                          type="number"
                          placeholder="0,00"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className={`h-12 rounded-xl pl-10 ${errors.price ? "border-red-500" : ""}`}
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {errors.price && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.price}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        <Package className="h-4 w-4 inline mr-1" />
                        Quantidade *
                      </label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={formData.available_quantity}
                        onChange={(e) => setFormData({ ...formData, available_quantity: e.target.value })}
                        className={`h-12 rounded-xl ${errors.quantity ? "border-red-500" : ""}`}
                        min="1"
                      />
                      {errors.quantity && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.quantity}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      <FileText className="h-4 w-4 inline mr-1" />
                      Descrição do Produto
                    </label>
                    <textarea
                      placeholder="Descreva seu produto com detalhes: características, estado de conservação, o que acompanha, etc."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full h-32 rounded-xl border border-gray-200 dark:border-gray-700 p-3 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Uma boa descrição aumenta suas chances de venda
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Dica de Preço
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Pesquise produtos similares no Mercado Livre para definir um preço competitivo
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Images */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-0 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl">Fotos do Produto</CardTitle>
                  <CardDescription>
                    Adicione até 6 fotos de alta qualidade
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    {[...Array(6)].map((_, index) => (
                      <div key={index}>
                        {images[index] ? (
                          <div className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <img
                              src={images[index]}
                              alt={`Produto ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            {index === 0 && (
                              <Badge className="absolute bottom-2 left-2 bg-[#FFE600] text-black">
                                Foto Principal
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <label
                            htmlFor={`image-upload-${index}`}
                            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-[#FFE600] transition-colors"
                          >
                            <input
                              id={`image-upload-${index}`}
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              multiple
                            />
                            {isUploading && index === images.length ? (
                              <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-xs text-gray-500">
                                  {index === 0 ? "Foto Principal" : "Adicionar"}
                                </span>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  {errors.images && (
                    <p className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.images}
                    </p>
                  )}
                  
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <ImageIcon className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Dicas para Fotos
                        </p>
                        <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                          <li>• Use luz natural e fundo neutro</li>
                          <li>• Mostre o produto de diferentes ângulos</li>
                          <li>• Inclua detalhes importantes e defeitos (se houver)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-0 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl">Revisar e Publicar</CardTitle>
                  <CardDescription>
                    Confirme os dados antes de criar o anúncio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Preview */}
                  <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <h3 className="font-semibold text-lg mb-4">Prévia do Anúncio</h3>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        {images[0] && (
                          <img
                            src={images[0]}
                            alt="Preview"
                            className="w-full aspect-square object-cover rounded-xl mb-4"
                          />
                        )}
                        <div className="flex gap-2 overflow-x-auto">
                          {images.slice(1).map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`Preview ${idx + 2}`}
                              className="h-16 w-16 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-2xl font-bold">{formData.title || "Título do Anúncio"}</h4>
                          <Badge className="mt-2">
                            {conditions.find(c => c.value === formData.condition)?.label}
                          </Badge>
                        </div>
                        
                        <div className="text-3xl font-bold text-green-600">
                          R$ {formData.price || "0,00"}
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Categoria:</span>
                            <span>{CATEGORIES.find(c => c.id === formData.category_id)?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Estoque:</span>
                            <span>{formData.available_quantity} unidades</span>
                          </div>
                          {formData.brand && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Marca:</span>
                              <span>{formData.brand}</span>
                            </div>
                          )}
                          {formData.model && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Modelo:</span>
                              <span>{formData.model}</span>
                            </div>
                          )}
                        </div>
                        
                        {formData.description && (
                          <div className="pt-4 border-t">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formData.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Tudo pronto!
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                          Seu anúncio será publicado imediatamente após a confirmação
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={step === 1 ? () => router.push("/anuncios") : handlePreviousStep}
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          
          {step < 4 ? (
            <Button
              onClick={handleNextStep}
              className="bg-gradient-to-r from-[#FFE600] to-[#FFD100] text-black hover:from-[#FFD100] hover:to-[#FFC300] rounded-xl shadow-lg shadow-yellow-500/30"
            >
              Próximo
              <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createItemMutation.isPending}
              className="bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 rounded-xl shadow-lg shadow-green-500/30"
            >
              {createItemMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Publicar Anúncio
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
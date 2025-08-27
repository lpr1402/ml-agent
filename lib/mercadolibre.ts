import axios from "axios"
import { auth } from "@/auth"

const api = axios.create({
  baseURL: "https://api.mercadolibre.com",
  headers: {
    "Accept": "application/json",
    "Content-Type": "application/json",
  },
})

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const session = await auth()
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`
  }
  return config
})

export interface User {
  id: number
  nickname: string
  registration_date: string
  country_id: string
  address: {
    city: string
    state: string
  }
  user_type: string
  tags: string[]
  logo: string | null
  points: number
  site_id: string
  permalink: string
  seller_reputation: SellerReputation
  buyer_reputation: BuyerReputation
  status: {
    site_status: string
  }
}

export interface SellerReputation {
  level_id: string | null
  power_seller_status: string | null
  transactions: {
    canceled: number
    completed: number
    period: string
    ratings: {
      negative: number
      neutral: number
      positive: number
    }
    total: number
  }
  metrics: {
    sales: {
      period: string
      completed: number
    }
    claims: {
      period: string
      rate: number
      value: number
      excluded?: {
        real_value: number
        real_rate: number
      }
    }
    delayed_handling_time: {
      period: string
      rate: number
      value: number
      excluded?: {
        real_value: number
        real_rate: number
      }
    }
    cancellations: {
      period: string
      rate: number
      value: number
      excluded?: {
        real_value: number
        real_rate: number
      }
    }
  }
}

export interface BuyerReputation {
  canceled_transactions: number
  transactions: {
    canceled: {
      paid: number | null
      total: number | null
    }
    completed: number | null
    not_yet_rated: {
      paid: number | null
      total: number | null
      units: number | null
    }
    period: string
    total: number | null
    unrated: {
      paid: number | null
      total: number | null
    }
  }
}

export interface OrdersMetrics {
  total: number
  paid: number
  pending: number
  cancelled: number
  delivered: number
}

export interface ItemsMetrics {
  active: number
  paused: number
  closed: number
  total: number
}

export interface VisitsMetrics {
  total_visits: number
  visits_detail: Array<{
    date: string
    total: number
  }>
}

export interface QuestionsMetrics {
  total: number
  unanswered: number
  answered: number
}

export interface PaymentMetrics {
  available_balance: number
  unavailable_balance: number
  total_amount: number
}

// API Functions
export async function getUserInfo(userId?: string) {
  const endpoint = userId ? `/users/${userId}` : "/users/me"
  const { data } = await api.get<User>(endpoint)
  return data
}

export async function getOrders(sellerId: string, status?: string) {
  const params = new URLSearchParams({
    seller: sellerId,
    ...(status && { "order.status": status }),
    limit: "50",
  })
  
  const { data } = await api.get(`/orders/search?${params}`)
  return data
}

export async function getItems(userId: string) {
  const { data } = await api.get(`/users/${userId}/items/search`, {
    params: {
      limit: 50,
      status: "active",
    },
  })
  return data
}

export async function getVisits(userId: string, dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams({
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  })
  
  const { data } = await api.get<VisitsMetrics>(
    `/users/${userId}/items_visits?${params}`
  )
  return data
}

export async function getQuestions(itemId: string) {
  const { data } = await api.get(`/questions/search`, {
    params: {
      item: itemId,
      limit: 50,
    },
  })
  return data
}

export async function getPaymentInfo(userId: string) {
  try {
    const { data } = await api.get(`/users/${userId}/mercadopago_account/balance`)
    return data
  } catch (error) {
    console.error("Error fetching payment info:", error)
    return {
      available_balance: 0,
      unavailable_balance: 0,
      total_amount: 0,
    }
  }
}

export async function getRecentOrders(sellerId: string, limit = 10) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const params = new URLSearchParams({
    seller: sellerId,
    "order.date_created.from": thirtyDaysAgo.toISOString(),
    sort: "date_desc",
    limit: limit.toString(),
  })
  
  const { data } = await api.get(`/orders/search?${params}`)
  return data
}

export async function getSalesMetrics(userId: string) {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const [orders, visits] = await Promise.all([
    getOrders(userId),
    getVisits(userId, thirtyDaysAgo.toISOString(), today.toISOString()),
  ])
  
  const metrics = {
    totalSales: orders.results?.filter((o: any) => o.status === "paid").length || 0,
    totalRevenue: orders.results?.reduce((acc: number, order: any) => {
      if (order.status === "paid") {
        return acc + order.total_amount
      }
      return acc
    }, 0) || 0,
    totalVisits: visits.total_visits || 0,
    conversionRate: visits.total_visits > 0 
      ? ((orders.results?.filter((o: any) => o.status === "paid").length || 0) / visits.total_visits) * 100
      : 0,
  }
  
  return metrics
}

export default api
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserStore {
  user: any | null
  metrics: {
    sales: number
    revenue: number
    visits: number
    conversionRate: number
    orders: any[]
    items: any[]
  }
  isLoading: boolean
  setUser: (user: any) => void
  setMetrics: (metrics: any) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      metrics: {
        sales: 0,
        revenue: 0,
        visits: 0,
        conversionRate: 0,
        orders: [],
        items: [],
      },
      isLoading: false,
      setUser: (user) => set({ user }),
      setMetrics: (metrics) => set((state) => ({
        metrics: { ...state.metrics, ...metrics }
      })),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({
        user: null,
        metrics: {
          sales: 0,
          revenue: 0,
          visits: 0,
          conversionRate: 0,
          orders: [],
          items: [],
        },
        isLoading: false,
      }),
    }),
    {
      name: 'ml-agent-store',
    }
  )
)
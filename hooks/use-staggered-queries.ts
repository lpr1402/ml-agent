import { useEffect, useState } from 'react'
import { useQuery, UseQueryResult } from '@tanstack/react-query'

interface StaggeredQueryConfig {
  key: string
  fn: () => Promise<any>
  delay: number
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number | false
  refetchOnWindowFocus?: boolean
}

/**
 * Hook para executar queries de forma sequencial com delay entre elas
 * Evita rate limiting do ML fazendo uma chamada por vez
 */
export function useStaggeredQueries(
  queries: StaggeredQueryConfig[],
  accessToken: string | null
) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [queryResults, setQueryResults] = useState<Record<string, any>>({})
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Execute queries sequentially with delays
  useEffect(() => {
    if (!accessToken || currentIndex >= queries.length) {
      if (currentIndex >= queries.length) {
        setIsInitialLoad(false)
      }
      return
    }

    const currentQuery = queries[currentIndex]
    if (!currentQuery) return
    
    const timer = setTimeout(() => {
      setCurrentIndex(prev => prev + 1)
    }, currentQuery.delay)

    return () => clearTimeout(timer)
  }, [currentIndex, queries.length, accessToken])

  // Create individual queries
  const results: Record<string, UseQueryResult> = {}

  queries.forEach((config, index) => {
    const query = useQuery({
      queryKey: [config.key],
      queryFn: config.fn,
      enabled: !!accessToken && index <= currentIndex,
      staleTime: config.staleTime || 5 * 60 * 1000, // 5 minutes default
      refetchInterval: isInitialLoad ? false : (config.refetchInterval || false),
      refetchOnWindowFocus: config.refetchOnWindowFocus !== undefined ? config.refetchOnWindowFocus : false,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })

    results[config.key] = query

    // Store successful results
    if (query.data && !queryResults[config.key]) {
      setQueryResults(prev => ({ ...prev, [config.key]: query.data }))
    }
  })

  // Check if all initial queries are done
  const allLoaded = currentIndex >= queries.length - 1
  const anyLoading = Object.values(results).some(r => r.isLoading)

  return {
    results,
    queryResults,
    isLoading: !allLoaded || anyLoading,
    isInitialLoad,
    progress: {
      current: Math.min(currentIndex + 1, queries.length),
      total: queries.length
    }
  }
}
'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface CircuitBreakerState {
  global: {
    state: 'closed' | 'open' | 'half-open'
    failures: number
    successes: number
    lastFailure?: string
  }
  endpoints: Record<string, {
    state: 'closed' | 'open' | 'half-open'
    failures: number
    successes: number
    lastFailure?: string
  }>
}

export function CircuitBreakerStatus() {
  const [status, setStatus] = useState<CircuitBreakerState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) throw new Error('Failed to fetch status')
        
        const data = await response.json()
        
        // Extract circuit breaker status from health check
        if (data.checks?.circuitBreaker) {
          setStatus(data.checks.circuitBreaker)
        }
        setError(null)
      } catch (err) {
        setError('Failed to load circuit breaker status')
        console.error('Circuit breaker status error:', err)
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchStatus()

    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'closed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'open':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'half-open':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'closed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'open':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'half-open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (error || !status) {
    return null // Silent fail - don't show if can't load
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Circuit Breaker Status</h3>
        <div className="flex items-center gap-1">
          {getStateIcon(status.global.state)}
          <span className={`text-xs px-2 py-1 rounded-full border ${getStateColor(status.global.state)}`}>
            {status.global.state.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Global Status */}
      <div className="mb-3 pb-3 border-b border-gray-100">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Global Circuit</span>
          <div className="flex gap-3">
            <span className="text-green-600">✓ {status.global.successes}</span>
            <span className="text-red-600">✗ {status.global.failures}</span>
          </div>
        </div>
      </div>

      {/* Endpoint Status */}
      {status.endpoints && Object.keys(status.endpoints).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600 mb-1">Endpoints</p>
          {Object.entries(status.endpoints).slice(0, 5).map(([endpoint, data]) => (
            <div key={endpoint} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                {getStateIcon(data.state)}
                <span className="text-gray-700 truncate max-w-[150px]" title={endpoint}>
                  {endpoint.replace('/api/mercadolibre/', '')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓ {data.successes}</span>
                <span className="text-red-600">✗ {data.failures}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Last Update */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
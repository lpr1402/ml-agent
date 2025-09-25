/**
 * WebSocket Manager with SSE Fallback
 * Provides real-time updates with automatic reconnection
 */

import { logger } from '@/lib/logger'

interface WebSocketConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

export class WebSocketManager {
  private ws?: WebSocket
  private sse?: EventSource
  private config: Required<WebSocketConfig>
  private reconnectAttempts = 0
  private heartbeatTimer?: NodeJS.Timeout
  private reconnectTimer?: NodeJS.Timeout
  private isConnected = false
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map()

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000
    }
  }

  async connect(): Promise<void> {
    try {
      // Try WebSocket first
      if (typeof WebSocket !== 'undefined') {
        await this.connectWebSocket()
      } else {
        // Fallback to SSE
        await this.connectSSE()
      }
    } catch (error) {
      logger.error('Connection failed', { error })
      this.scheduleReconnect()
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url)

        this.ws.onopen = () => {
          this.isConnected = true
          this.reconnectAttempts = 0
          this.startHeartbeat()
          logger.info('WebSocket connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          logger.error('WebSocket error', { error })
          reject(error)
        }

        this.ws.onclose = () => {
          this.isConnected = false
          this.stopHeartbeat()
          this.scheduleReconnect()
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const sseUrl = this.config.url.replace('ws://', 'http://').replace('wss://', 'https://')
        this.sse = new EventSource(sseUrl)

        this.sse.onopen = () => {
          this.isConnected = true
          this.reconnectAttempts = 0
          logger.info('SSE connected')
          resolve()
        }

        this.sse.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.sse.onerror = (error) => {
          logger.error('SSE error', { error })
          this.isConnected = false
          this.scheduleReconnect()
          reject(error)
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      const handlers = this.messageHandlers.get(message.type) || new Set()
      
      handlers.forEach(handler => {
        try {
          handler(message.payload)
        } catch (error) {
          logger.error('Message handler error', { error, type: message.type })
        }
      })
    } catch (error) {
      logger.error('Failed to parse message', { error, data })
    }
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set())
    }
    this.messageHandlers.get(event)!.add(handler)
  }

  off(event: string, handler: (data: any) => void): void {
    this.messageHandlers.get(event)?.delete(handler)
  }

  send(type: string, payload: any): void {
    if (!this.isConnected) {
      logger.warn('Cannot send message, not connected')
      return
    }

    const message = JSON.stringify({ type, payload })

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message)
    } else if (this.sse) {
      // SSE is read-only, need to use fetch for sending
      fetch(this.config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: message
      }).catch(error => {
        logger.error('Failed to send via SSE fallback', { error })
      })
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    
    this.reconnectTimer = setTimeout(() => {
      logger.info(`Reconnecting... Attempt ${this.reconnectAttempts}`)
      this.connect()
    }, this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5))
  }

  disconnect(): void {
    this.isConnected = false
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    
    this.stopHeartbeat()
    
    if (this.ws) {
      this.ws.close()
      delete this.ws
    }
    
    if (this.sse) {
      this.sse.close()
      delete this.sse
    }
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null

export function getWebSocketManager(config?: WebSocketConfig): WebSocketManager {
  if (!wsManager && config) {
    wsManager = new WebSocketManager(config)
  }
  
  if (!wsManager) {
    throw new Error('WebSocket manager not initialized')
  }
  
  return wsManager
}
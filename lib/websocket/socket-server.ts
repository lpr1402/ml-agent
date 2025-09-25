/**
 * WebSocket Server Otimizado para ML Agent
 * Configurado para 10 organizações com múltiplas contas ML
 * Production-ready com Redis adapter para sincronização
 */

import { Server as HTTPServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

interface SocketAuth {
  sessionToken: string
  organizationId: string
  mlAccountIds: string[] // Todas as contas ML da organização
  currentAccountId?: string
}

interface SocketData {
  auth: SocketAuth
  clientId: string
  connectedAt: Date
}

export class WebSocketServer {
  private io: SocketServer
  private connections = new Map<string, Socket>()

  // Configuração otimizada para 10 organizações
  private readonly MAX_CONNECTIONS = 100 // 10 orgs × 10 users máximo
  private readonly HEARTBEAT_INTERVAL = 30000 // 30 segundos
  private readonly PING_TIMEOUT = 60000 // 1 minuto

  constructor(httpServer: HTTPServer) {
    // Initialize Socket.IO com configuração otimizada
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://gugaleo.axnexlabs.com.br']
          : ['http://localhost:3007', 'http://localhost:3000'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingInterval: this.HEARTBEAT_INTERVAL,
      pingTimeout: this.PING_TIMEOUT,
      maxHttpBufferSize: 1e6, // 1MB
      connectTimeout: 10000, // 10 segundos
      // Performance para 10 organizações
      serveClient: false,
      cookie: false
    })

    this.setupRedisAdapter()
    this.setupMiddleware()
    this.setupEventHandlers()
    this.startHealthCheck()

    logger.info('[WebSocket] Server initialized for ML Agent')
  }

  /**
   * Setup Redis adapter para sincronização entre workers PM2
   */
  private async setupRedisAdapter() {
    try {
      const pubClient = redis.duplicate()
      const subClient = redis.duplicate()

      await Promise.all([
        pubClient.connect(),
        subClient.connect()
      ])

      this.io.adapter(createAdapter(pubClient, subClient))
      logger.info('[WebSocket] Redis adapter configured for PM2 clustering')
    } catch (error) {
      logger.error('[WebSocket] Redis adapter setup failed:', { error })
      // Continue sem Redis adapter em desenvolvimento
    }
  }

  /**
   * Setup middleware de autenticação
   */
  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.['token'] as string

        if (!token) {
          return next(new Error('Authentication required'))
        }

        // Verificar sessão no banco
        const session = await prisma.session.findUnique({
          where: { sessionToken: token },
          include: {
            organization: {
              include: {
                mlAccounts: {
                  where: { isActive: true },
                  select: { id: true, mlUserId: true, nickname: true }
                }
              }
            }
          }
        })

        if (!session || session.expiresAt < new Date()) {
          return next(new Error('Invalid or expired session'))
        }

        // Check connection limit
        if (this.connections.size >= this.MAX_CONNECTIONS) {
          logger.warn('[WebSocket] Max connections reached')
          return next(new Error('Server at capacity'))
        }

        // Store auth data
        socket.data = {
          auth: {
            sessionToken: token,
            organizationId: session.organizationId,
            mlAccountIds: session.organization.mlAccounts.map(acc => acc.id),
            currentAccountId: session.organization.mlAccounts[0]?.id
          },
          clientId: socket.id,
          connectedAt: new Date()
        } as SocketData

        next()
      } catch (error) {
        logger.error('[WebSocket] Auth error:', { error })
        next(new Error('Authentication failed'))
      }
    })

    // Connection tracking
    this.io.use((socket: Socket, next) => {
      this.connections.set(socket.id, socket)
      socket.on('disconnect', () => {
        this.connections.delete(socket.id)
      })
      next()
    })
  }

  /**
   * Setup event handlers principais
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const { organizationId, mlAccountIds, currentAccountId } = socket.data.auth

      logger.info(`[WebSocket] Client connected`, {
        socketId: socket.id,
        organizationId,
        accountsCount: mlAccountIds.length
      })

      // Join organization room
      socket.join(`org:${organizationId}`)

      // Join all ML account rooms
      mlAccountIds.forEach((accountId: string) => {
        socket.join(`account:${accountId}`)
      })

      // Send connection success
      socket.emit('connected', {
        clientId: socket.id,
        organizationId,
        mlAccounts: mlAccountIds,
        currentAccountId,
        timestamp: Date.now()
      })

      // Handle account switching (frontend state only)
      socket.on('switch-account', (newAccountId: string) => {
        if (mlAccountIds.includes(newAccountId)) {
          socket.data.auth.currentAccountId = newAccountId
          socket.emit('account-switched', { accountId: newAccountId })
          logger.info(`[WebSocket] Account switched`, {
            socketId: socket.id,
            newAccountId
          })
        } else {
          socket.emit('error', { message: 'Invalid account access' })
        }
      })

      // Handle question actions
      socket.on('question:approve', async (data) => {
        this.handleQuestionAction(socket, 'approve', data)
      })

      socket.on('question:revise', async (data) => {
        this.handleQuestionAction(socket, 'revise', data)
      })

      socket.on('question:edit', async (data) => {
        this.handleQuestionAction(socket, 'edit', data)
      })

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`[WebSocket] Client disconnected`, {
          socketId: socket.id,
          reason
        })
      })

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`[WebSocket] Socket error`, {
          socketId: socket.id,
          error
        })
      })

      // Send initial questions status
      this.sendInitialQuestionsStatus(socket)
    })
  }

  /**
   * Handle question actions through WebSocket
   */
  private async handleQuestionAction(
    socket: Socket,
    action: string,
    data: any
  ) {
    try {
      const { organizationId } = socket.data.auth

      // Emit action to all org members for optimistic update
      this.io.to(`org:${organizationId}`).emit(`question:${action}:started`, {
        questionId: data.questionId,
        action,
        timestamp: Date.now()
      })

      // Process action would be handled by API routes
      // WebSocket just broadcasts the events

      logger.info(`[WebSocket] Question action`, {
        action,
        questionId: data.questionId,
        organizationId
      })
    } catch (error) {
      logger.error('[WebSocket] Question action error:', { error })
      socket.emit('error', {
        message: 'Failed to process action',
        action,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Send initial questions status when client connects
   */
  private async sendInitialQuestionsStatus(socket: Socket) {
    try {
      const { organizationId: _organizationId, mlAccountIds } = socket.data.auth

      // Get pending questions count
      const pendingCount = await prisma.question.count({
        where: {
          mlAccountId: { in: mlAccountIds },
          status: {
            in: ['RECEIVED', 'PROCESSING', 'AWAITING_APPROVAL', 'REVISING']
          }
        }
      })

      // Get recent questions
      const recentQuestions = await prisma.question.findMany({
        where: {
          mlAccountId: { in: mlAccountIds }
        },
        include: {
          mlAccount: {
            select: {
              id: true,
              nickname: true,
              thumbnail: true
            }
          }
        },
        orderBy: { receivedAt: 'desc' },
        take: 10
      })

      socket.emit('questions:initial', {
        pendingCount,
        recentQuestions,
        timestamp: Date.now()
      })
    } catch (error) {
      logger.error('[WebSocket] Failed to send initial status:', { error })
    }
  }

  /**
   * Broadcast new question to organization
   */
  public broadcastNewQuestion(organizationId: string, question: any) {
    this.io.to(`org:${organizationId}`).emit('question:new', {
      question,
      timestamp: Date.now()
    })

    logger.info('[WebSocket] Broadcasted new question', {
      organizationId,
      questionId: question.mlQuestionId
    })
  }

  /**
   * Broadcast question update to organization
   */
  public broadcastQuestionUpdate(
    organizationId: string,
    questionId: string,
    status: string,
    data?: any
  ) {
    this.io.to(`org:${organizationId}`).emit('question:updated', {
      questionId,
      status,
      data,
      timestamp: Date.now()
    })

    logger.info('[WebSocket] Broadcasted question update', {
      organizationId,
      questionId,
      status
    })
  }

  /**
   * Broadcast to specific ML account
   */
  public broadcastToAccount(mlAccountId: string, event: string, data: any) {
    this.io.to(`account:${mlAccountId}`).emit(event, {
      ...data,
      timestamp: Date.now()
    })
  }

  /**
   * Health check para monitoramento
   */
  private startHealthCheck() {
    setInterval(() => {
      const stats = {
        connections: this.connections.size,
        maxConnections: this.MAX_CONNECTIONS,
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        timestamp: Date.now()
      }

      // Log metrics
      if (this.connections.size > 0) {
        logger.info('[WebSocket] Health check', stats)
      }

      // Broadcast to monitoring room if needed
      this.io.to('monitoring').emit('health', stats)
    }, 60000) // Every minute
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    const rooms = this.io.sockets.adapter.rooms
    const orgConnections = new Map<string, number>()
    const accountConnections = new Map<string, number>()

    for (const [roomName, socketIds] of rooms) {
      if (roomName.startsWith('org:')) {
        const orgId = roomName.replace('org:', '')
        orgConnections.set(orgId, socketIds.size)
      } else if (roomName.startsWith('account:')) {
        const accountId = roomName.replace('account:', '')
        accountConnections.set(accountId, socketIds.size)
      }
    }

    return {
      totalConnections: this.connections.size,
      maxConnections: this.MAX_CONNECTIONS,
      utilizationPercent: (this.connections.size / this.MAX_CONNECTIONS) * 100,
      rooms: rooms.size,
      connectionsByOrg: orgConnections,
      connectionsByAccount: accountConnections
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown() {
    logger.info('[WebSocket] Shutting down...')

    // Notify all clients
    this.io.emit('server-shutdown', {
      message: 'Server restarting, please reconnect',
      timestamp: Date.now()
    })

    // Close all connections
    for (const socket of this.connections.values()) {
      socket.disconnect(true)
    }

    // Close server
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        logger.info('[WebSocket] Shutdown complete')
        resolve()
      })
    })
  }
}

// Export singleton instance
let wsServer: WebSocketServer | null = null

export function initializeWebSocket(httpServer: HTTPServer): WebSocketServer {
  if (!wsServer) {
    wsServer = new WebSocketServer(httpServer)
    logger.info('[WebSocket] Initialized new WebSocket server instance')
  }
  return wsServer
}

export function getWebSocketServer(): WebSocketServer | null {
  return wsServer
}
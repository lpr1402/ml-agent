#!/usr/bin/env node

/**
 * WebSocket Server for ML Agent - Production Ready
 * Real-time communication with JWT authentication and Redis Pub/Sub
 */

const { createServer } = require('http')
const { Server } = require('socket.io')
const Redis = require('ioredis')
const jwt = require('jsonwebtoken')

const PORT = process.env.WS_PORT || 3008
const SESSION_SECRET = process.env.SESSION_SECRET || 'ml-agent-session-secret-2025'

// Initialize Redis clients
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 50, 2000)
})

// Separate Redis client for Pub/Sub (required by Redis)
const redisPub = redis.duplicate()
const redisSub = redis.duplicate()

// Create logger
const logger = {
  info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
  warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
  debug: (...args) => {
    if (process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'info') {
      console.log('[DEBUG]', new Date().toISOString(), ...args)
    }
  }
}

// Store active connections by organization
const connections = new Map() // organizationId -> Set of socket IDs
const socketToOrg = new Map() // socket.id -> organizationId

async function startWebSocketServer() {
  try {
    logger.info('🚀 Starting WebSocket Server...')

    // Create HTTP server for Socket.IO
    const httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          connections: connections.size,
          uptime: process.uptime()
        }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('WebSocket Server Running\n')
    })

    // Initialize Socket.IO with production settings
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://gugaleo.axnexlabs.com.br']
          : ['http://localhost:3007', 'http://localhost:3000'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000'),
      pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000'),
      maxHttpBufferSize: 1e6,
      connectTimeout: 10000,
      serveClient: false,
      cookie: false
    })

    // Authentication middleware - Validate JWT token
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token

        if (!token) {
          logger.warn('Authentication failed: No token provided')
          return next(new Error('Authentication required'))
        }

        // Verify JWT token
        let decoded
        try {
          decoded = jwt.verify(token, SESSION_SECRET)
        } catch (err) {
          logger.warn('Authentication failed: Invalid token', err.message)
          return next(new Error('Invalid authentication token'))
        }

        // Check token expiration
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          logger.warn('Authentication failed: Token expired')
          return next(new Error('Token expired'))
        }

        // Validate token type
        if (decoded.type !== 'websocket') {
          logger.warn('Authentication failed: Invalid token type')
          return next(new Error('Invalid token type'))
        }

        // Store authenticated data in socket
        socket.data = {
          auth: {
            sessionToken: token,
            organizationId: decoded.organizationId,
            mlAccountId: decoded.mlAccountId,
            mlUserId: decoded.mlUserId,
            nickname: decoded.nickname,
            mlAccountIds: [decoded.mlAccountId], // For multi-account support
            currentAccountId: decoded.mlAccountId
          },
          clientId: socket.id,
          connectedAt: new Date()
        }

        logger.info('Client authenticated', {
          socketId: socket.id,
          organizationId: decoded.organizationId,
          mlAccountId: decoded.mlAccountId,
          nickname: decoded.nickname
        })

        next()
      } catch (error) {
        logger.error('Auth error:', error)
        next(new Error('Authentication failed'))
      }
    })

    // Handle connections
    io.on('connection', (socket) => {
      const { organizationId, mlAccountId, nickname } = socket.data.auth

      logger.info(`Client connected: ${socket.id}`, {
        organizationId,
        mlAccountId,
        nickname
      })

      // Join organization room for broadcasts
      socket.join(`org:${organizationId}`)

      // Join account-specific room
      socket.join(`account:${mlAccountId}`)

      // Track connection
      if (!connections.has(organizationId)) {
        connections.set(organizationId, new Set())
      }
      connections.get(organizationId).add(socket.id)
      socketToOrg.set(socket.id, organizationId)

      // Send connection success with real data
      socket.emit('connected', {
        clientId: socket.id,
        organizationId,
        mlAccountId,
        nickname,
        mlAccounts: [mlAccountId],
        timestamp: Date.now()
      })

      // JWT Auto-Refresh: Enviar novo token antes de expirar (UX perfeita)
      const decoded = jwt.decode(socket.data.auth.sessionToken)
      if (decoded && decoded.exp) {
        const expiresIn = (decoded.exp * 1000) - Date.now()
        const refreshTime = Math.max(expiresIn - (5 * 60 * 1000), 60000) // 5 min antes ou 1 min

        const refreshTimer = setTimeout(() => {
          try {
            // Gerar novo token com mesmos dados
            const newToken = jwt.sign(
              {
                type: 'websocket',
                organizationId,
                mlAccountId,
                mlUserId: socket.data.auth.mlUserId,
                nickname
              },
              SESSION_SECRET,
              { expiresIn: '7d' } // 7 dias de validade
            )

            // Enviar novo token ao cliente
            socket.emit('token:refresh', {
              token: newToken,
              expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
              refreshedAt: Date.now()
            })

            logger.info(`JWT auto-refreshed for ${nickname} (${socket.id})`)
          } catch (error) {
            logger.error(`JWT auto-refresh failed for ${socket.id}:`, error)
          }
        }, refreshTime)

        // Limpar timer ao desconectar
        socket.on('disconnect', () => {
          clearTimeout(refreshTimer)
        })

        logger.debug(`JWT auto-refresh scheduled in ${Math.round(refreshTime / 60000)} minutes for ${nickname}`)
      }

      // Handle account switching
      socket.on('switch-account', (accountId) => {
        logger.info(`Account switch requested`, {
          socketId: socket.id,
          from: socket.data.auth.currentAccountId,
          to: accountId
        })

        // Leave old account room
        socket.leave(`account:${socket.data.auth.currentAccountId}`)

        // Join new account room
        socket.join(`account:${accountId}`)
        socket.data.auth.currentAccountId = accountId

        // Emit confirmation
        socket.emit('account-switched', {
          accountId,
          timestamp: Date.now()
        })
      })

      // Handle joining specific rooms (for unique approval pages)
      socket.on('join', (room) => {
        if (room && typeof room === 'string') {
          socket.join(room)
          logger.info(`Socket ${socket.id} joined room: ${room}`)
        }
      })

      // Handle leaving specific rooms
      socket.on('leave', (room) => {
        if (room && typeof room === 'string') {
          socket.leave(room)
          logger.info(`Socket ${socket.id} left room: ${room}`)
        }
      })

      // Handle question actions
      socket.on('question:approve', async (data) => {
        logger.info('Question approval via WebSocket', data)
        // Publish to Redis for other processes
        await redisPub.publish('question:events', JSON.stringify({
          type: 'approve',
          organizationId,
          ...data
        }))
      })

      socket.on('question:revise', async (data) => {
        logger.info('Question revision via WebSocket', data)
        await redisPub.publish('question:events', JSON.stringify({
          type: 'revise',
          organizationId,
          ...data
        }))
      })

      socket.on('question:edit', async (data) => {
        logger.info('Question edit via WebSocket', data)
        await redisPub.publish('question:events', JSON.stringify({
          type: 'edit',
          organizationId,
          ...data
        }))
      })

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} - ${reason}`)

        // Remove from tracking
        const orgId = socketToOrg.get(socket.id)
        if (orgId && connections.has(orgId)) {
          connections.get(orgId).delete(socket.id)
          if (connections.get(orgId).size === 0) {
            connections.delete(orgId)
          }
        }
        socketToOrg.delete(socket.id)
      })

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error: ${socket.id}`, error)
      })

      // Respond to ping with pong
      socket.on('ping', () => {
        socket.emit('pong', Date.now())
      })
    })

    // Subscribe to Redis channels for real-time updates
    await redisSub.subscribe('question:new')
    await redisSub.subscribe('question:updated')
    await redisSub.subscribe('question:events')
    await redisSub.subscribe('metrics:updated')

    // 🤖 AI Agent streaming channels
    await redisSub.subscribe('agent:token')
    await redisSub.subscribe('agent:step')
    await redisSub.subscribe('agent:done')
    await redisSub.subscribe('agent:error')
    await redisSub.subscribe('agent:confidence')

    logger.info('✅ Subscribed to all Redis channels including agent streaming')

    // Handle Redis messages
    redisSub.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message)
        logger.debug(`Redis message on ${channel}:`, data)

        switch(channel) {
          case 'question:new':
            // Emit to organization room
            if (data.organizationId) {
              io.to(`org:${data.organizationId}`).emit('question:new', {
                type: 'question:new',
                question: data.question || data,
                timestamp: Date.now()
              })
              logger.info('Emitted question:new to org', data.organizationId)
            }
            break

          case 'question:revising':
            // Emit revising status to organization and question room
            if (data.organizationId) {
              const eventData = {
                mlQuestionId: data.questionId,
                feedback: data.userFeedback,
                timestamp: Date.now()
              }

              // Emit to organization room
              io.to(`org:${data.organizationId}`).emit('question:revising', eventData)

              // Also emit to question-specific room
              if (data.questionId) {
                const questionRoom = `question:${data.questionId}`
                io.to(questionRoom).emit('question:revising', eventData)
              }

              logger.info('Emitted question:revising', {
                org: data.organizationId,
                questionId: data.questionId
              })
            }
            break

          case 'question:updated':
            // Emit update to organization
            if (data.organizationId) {
              const eventData = {
                type: 'question:updated',
                mlQuestionId: data.mlQuestionId || data.questionId,
                questionId: data.questionId,
                status: data.status,
                aiSuggestion: data.aiSuggestion,
                revisedAnswer: data.revisedAnswer,
                data: data.data || {},
                timestamp: Date.now()
              }

              // Emit to organization room
              io.to(`org:${data.organizationId}`).emit('question:updated', eventData)

              // Also emit to question-specific room (for unique approval pages)
              if (data.mlQuestionId || data.questionId) {
                const questionRoom = `question:${data.mlQuestionId || data.questionId}`
                io.to(questionRoom).emit('question:updated', eventData)
                logger.info('Emitted to question room', { room: questionRoom })
              }

              logger.info('Emitted question:updated', {
                org: data.organizationId,
                status: data.status,
                mlQuestionId: data.mlQuestionId
              })
            }
            break

          case 'question:events':
            // Handle specific question events
            if (data.organizationId) {
              io.to(`org:${data.organizationId}`).emit(`question:${data.type}`, data)
            }
            break

          case 'metrics:updated':
            // Emit metrics update
            if (data.organizationId) {
              io.to(`org:${data.organizationId}`).emit('metrics:updated', data)
            }
            break

          // 🤖 AI Agent streaming events
          case 'agent:token':
            // Emit token to organization
            if (data.organizationId) {
              const room = `org:${data.organizationId}`
              const clients = io.sockets.adapter.rooms.get(room)

              logger.info('🔥 [WebSocket] RECEIVED agent:token from Redis', {
                org: data.organizationId,
                questionId: data.questionId,
                sequence: data.sequenceNumber,
                tokenPreview: data.token?.substring(0, 20),
                clientsInRoom: clients ? clients.size : 0
              })

              io.to(room).emit('agent:token', {
                questionId: data.questionId,
                organizationId: data.organizationId,
                token: data.token,
                sequenceNumber: data.sequenceNumber,
                timestamp: data.timestamp
              })

              logger.info('✅ [WebSocket] EMITTED agent:token to clients', {
                org: data.organizationId,
                sequence: data.sequenceNumber,
                clientsNotified: clients ? clients.size : 0
              })
            }
            break

          case 'agent:step':
            // Emit workflow step to organization
            if (data.organizationId) {
              io.to(`org:${data.organizationId}`).emit('agent:step', {
                questionId: data.questionId,
                organizationId: data.organizationId,
                step: data.step,
                data: data.data,
                timestamp: data.timestamp
              })

              logger.debug('Emitted agent:step', {
                org: data.organizationId,
                questionId: data.questionId,
                step: data.step
              })
            }
            break

          case 'agent:done':
            // Emit completion to organization
            if (data.organizationId) {
              io.to(`org:${data.organizationId}`).emit('agent:done', {
                questionId: data.questionId,
                organizationId: data.organizationId,
                response: data.response,
                confidence: data.confidence,
                processingTime: data.processingTime,
                tokensUsed: data.tokensUsed,
                timestamp: data.timestamp
              })

              logger.info('Emitted agent:done', {
                org: data.organizationId,
                questionId: data.questionId,
                confidence: data.confidence,
                tokensUsed: data.tokensUsed
              })
            }
            break

          case 'agent:error':
            // Emit error to organization
            if (data.organizationId) {
              io.to(`org:${data.organizationId}`).emit('agent:error', {
                questionId: data.questionId,
                organizationId: data.organizationId,
                error: data.error,
                code: data.code,
                timestamp: data.timestamp
              })

              logger.error('Emitted agent:error', {
                org: data.organizationId,
                questionId: data.questionId,
                error: data.error
              })
            }
            break

          case 'agent:confidence':
            // Emit confidence update to organization
            if (data.organizationId) {
              io.to(`org:${data.organizationId}`).emit('agent:confidence', {
                questionId: data.questionId,
                organizationId: data.organizationId,
                confidence: data.confidence,
                timestamp: data.timestamp
              })

              logger.debug('Emitted agent:confidence', {
                org: data.organizationId,
                questionId: data.questionId,
                confidence: data.confidence
              })
            }
            break
        }
      } catch (error) {
        logger.error('Error processing Redis message:', error)
      }
    })

    redisSub.on('error', (error) => {
      logger.error('Redis subscription error:', error)
    })

    // Start HTTP server
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ WebSocket Server running on port ${PORT}`)
      logger.info('Configuration:', {
        port: PORT,
        environment: process.env.NODE_ENV,
        heartbeatInterval: process.env.WS_HEARTBEAT_INTERVAL || '30000',
        pingTimeout: process.env.WS_PING_TIMEOUT || '60000',
        maxConnections: process.env.WS_MAX_CONNECTIONS || '100'
      })

      // Signal PM2 that we're ready
      if (process.send) {
        process.send('ready')
        logger.info('Sent ready signal to PM2')
      }
    })

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully`)

      // Notify all clients
      io.emit('server-shutdown', {
        message: 'Server is restarting',
        timestamp: Date.now()
      })

      // Close all connections
      io.disconnectSockets(true)

      // Unsubscribe from Redis
      await redisSub.unsubscribe()
      await redisSub.quit()
      await redisPub.quit()
      await redis.quit()

      httpServer.close(() => {
        logger.info('Server closed')
        process.exit(0)
      })

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout')
        process.exit(1)
      }, 10000)
    }

    // Clean up existing listeners before adding new ones to prevent memory leak
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')

    // Use once() to prevent multiple listeners
    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))

    // Handle uncaught errors
    process.once('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error)
      shutdown('UNCAUGHT_EXCEPTION')
    })

    process.once('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason)
    })

  } catch (error) {
    logger.error('Failed to start server:', error)
    console.error('❌ Failed to start WebSocket server:', error)
    process.exit(1)
  }
}

// Start the server
startWebSocketServer()
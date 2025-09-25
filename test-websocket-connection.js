#!/usr/bin/env node

/**
 * Test WebSocket Connection
 */

const io = require('socket.io-client')

const WS_URL = 'ws://localhost:3008'

console.log('🚀 Testing WebSocket connection to:', WS_URL)

// Create socket connection
const socket = io(WS_URL, {
  auth: {
    token: 'test-token-123'
  },
  transports: ['websocket'],
  reconnection: false
})

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected successfully!')
  console.log('Socket ID:', socket.id)
})

socket.on('connected', (data) => {
  console.log('📦 Server response:', data)
  process.exit(0)
})

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message)
  process.exit(1)
})

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ Connection timeout')
  process.exit(1)
}, 5000)

#!/usr/bin/env node

/**
 * Test Complete Real-time Flow
 * 1. Connect to WebSocket
 * 2. Send test webhook
 * 3. Verify real-time propagation
 */

const io = require('socket.io-client')
const https = require('https')

console.log('🚀 Testing Real-time ML Agent Flow\n')

// Step 1: Connect to WebSocket
console.log('📡 Step 1: Connecting to WebSocket...')

const socket = io('ws://localhost:3008', {
  auth: { token: 'test-token-123' },
  transports: ['websocket']
})

let receivedEvent = false

socket.on('connect', () => {
  console.log('✅ WebSocket connected:', socket.id)
})

socket.on('connected', (data) => {
  console.log('✅ Authenticated:', data.organizationId)
  console.log('\n📦 Step 2: Simulating question event...\n')
  
  // Step 2: Emit test question directly
  setTimeout(() => {
    const { emitNewQuestion } = require('./lib/websocket/emit-events.js')
    
    const testQuestion = {
      id: 'test-' + Date.now(),
      mlQuestionId: 'MLQ-' + Date.now(),
      text: 'Este produto tem garantia?',
      itemTitle: 'iPhone 15 Pro Max 256GB',
      itemPrice: 8999.99,
      itemId: 'MLB123456789',
      status: 'PROCESSING',
      organizationId: 'org-default',
      mlAccount: {
        id: 'account-1',
        nickname: 'ELITESAUDEANIMAL',
        thumbnail: null
      },
      dateCreated: new Date().toISOString(),
      receivedAt: new Date().toISOString()
    }
    
    console.log('📤 Emitting test question:', testQuestion.mlQuestionId)
    emitNewQuestion(testQuestion)
  }, 1000)
})

// Listen for real-time events
socket.on('question:new', (data) => {
  console.log('\n✅ REAL-TIME EVENT RECEIVED!')
  console.log('📊 Event details:', {
    type: data.type,
    questionId: data.question?.mlQuestionId,
    text: data.question?.text,
    itemTitle: data.question?.itemTitle,
    account: data.question?.mlAccount?.nickname
  })
  receivedEvent = true
  
  console.log('\n🎉 SUCCESS! Real-time propagation is working!')
  process.exit(0)
})

socket.on('error', (error) => {
  console.error('❌ WebSocket error:', error)
})

// Timeout after 10 seconds
setTimeout(() => {
  if (!receivedEvent) {
    console.error('\n❌ TIMEOUT: No real-time event received')
    console.log('💡 Check if WebSocket server is properly integrated')
  }
  process.exit(1)
}, 10000)

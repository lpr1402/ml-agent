#!/usr/bin/env node

// Queue Worker for processing ML questions
require('dotenv').config({ path: '.env.local' })

const Bull = require('bull')
const Redis = require('ioredis')

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  retryStrategy: (times) => Math.min(times * 50, 2000)
}

// Create Redis client
const redis = new Redis(redisConfig)

// Create queue
const questionQueue = new Bull('ml-questions', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
})

console.log('🚀 Queue Worker Started')
console.log('📡 Waiting for jobs...')

// Process questions
questionQueue.process('high-priority', 5, async (job) => {
  console.log(`Processing high-priority question: ${job.data.mlQuestionId}`)
  // Processing logic will be handled by the orchestrator
  return { success: true, questionId: job.data.mlQuestionId }
})

questionQueue.process('normal', 10, async (job) => {
  console.log(`Processing normal question: ${job.data.mlQuestionId}`)
  // Processing logic will be handled by the orchestrator
  return { success: true, questionId: job.data.mlQuestionId }
})

// Event handlers
questionQueue.on('completed', (job, result) => {
  console.log(`✅ Question ${job.data.mlQuestionId} completed`)
})

questionQueue.on('failed', (job, err) => {
  console.error(`❌ Question ${job.data.mlQuestionId} failed:`, err.message)
})

questionQueue.on('stalled', (job) => {
  console.warn(`⚠️ Question ${job.data.mlQuestionId} stalled`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down queue worker...')
  await questionQueue.close()
  await redis.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('Shutting down queue worker...')
  await questionQueue.close()
  await redis.quit()
  process.exit(0)
})
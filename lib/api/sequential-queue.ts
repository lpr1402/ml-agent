/**
 * Sequential Queue for ML API calls
 * Ensures proper spacing between API calls to avoid 429 errors
 * Adaptive delay that increases when rate limits are hit
 */

import { logger } from '@/lib/logger'

class SequentialQueue {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private lastRequestTime = 0
  private currentDelay = 200 // Start with 200ms between requests
  private minDelay = 200 // Minimum 200ms
  private maxDelay = 5000 // Maximum 5 seconds
  private consecutiveSuccess = 0
  private consecutiveRateLimit = 0

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Ensure minimum delay between requests
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequestTime
          if (timeSinceLastRequest < this.currentDelay) {
            await new Promise(r => setTimeout(r, this.currentDelay - timeSinceLastRequest))
          }
          
          this.lastRequestTime = Date.now()
          const result = await fn()
          
          // Success - gradually decrease delay
          this.consecutiveSuccess++
          this.consecutiveRateLimit = 0
          
          // After 10 successful requests, try reducing delay
          if (this.consecutiveSuccess >= 10) {
            this.currentDelay = Math.max(this.minDelay, this.currentDelay * 0.9)
            this.consecutiveSuccess = 0
            logger.info(`[Queue] Reduced delay to ${this.currentDelay}ms after successful requests`)
          }
          
          resolve(result)
        } catch (error: any) {
          // Check if it's a rate limit error
          if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
            this.consecutiveRateLimit++
            this.consecutiveSuccess = 0
            
            // Increase delay exponentially on rate limits
            this.currentDelay = Math.min(this.maxDelay, this.currentDelay * 2)
            logger.info(`[Queue] Increased delay to ${this.currentDelay}ms after rate limit`)
          }
          
          reject(error)
        }
      })
      
      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false
      return
    }
    
    this.processing = true
    const fn = this.queue.shift()
    if (fn) {
      await fn()
      // Continue processing
      this.processQueue()
    }
  }
  
  // Get current queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      currentDelay: this.currentDelay,
      processing: this.processing
    }
  }
}

export const mlApiQueue = new SequentialQueue()
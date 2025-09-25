/**
 * Generate sequential ID in format XX/DDMM
 * Where XX is a sequential number and DDMM is day+month
 */

import { logger } from '@/lib/logger'

/**
 * Generate sequential ID from question ID or ML Question ID
 * Format: XX/DDMM where XX is sequential and DDMM is current day+month
 */
export function generateSequentialId(questionId: string): string {
  try {
    const now = new Date()
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')

    // Extract sequential number from question ID
    // Use last 2-4 digits of the hash to generate a number
    const hash = questionId.replace(/[^0-9]/g, '')
    let sequential = 0

    if (hash.length >= 2) {
      // Take last 2 digits
      sequential = parseInt(hash.slice(-2), 10)
    } else if (questionId.length >= 4) {
      // Fallback: generate from questionId characters
      const charSum = questionId
        .slice(0, 4)
        .split('')
        .reduce((sum, char) => sum + char.charCodeAt(0), 0)
      sequential = charSum % 100
    } else {
      // Last resort: random
      sequential = Math.floor(Math.random() * 100)
    }

    // Format as XX/DDMM
    const seqStr = sequential.toString().padStart(2, '0')
    return `${seqStr}/${day}${month}`

  } catch (error) {
    logger.error('[SequentialID] Error generating ID', { error, questionId })
    // Fallback format
    const now = new Date()
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `${random}/${day}${month}`
  }
}

/**
 * Parse sequential ID to extract components
 */
export function parseSequentialId(sequentialId: string): {
  sequential: number
  day: string
  month: string
} | null {
  try {
    const match = sequentialId.match(/^(\d{2})\/(\d{2})(\d{2})$/)
    if (!match) return null

    return {
      sequential: parseInt(match[1]!, 10),
      day: match[2]!,
      month: match[3]!
    }
  } catch {
    return null
  }
}
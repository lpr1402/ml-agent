import { NextResponse } from 'next/server'
import { MLCache } from '@/lib/cache/ml-cache'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    // Obter estatísticas do cache
    const stats = await MLCache.getStats()

    // Obter informações adicionais do Redis
    const info = await redis.info('stats')
    const hitsMatch = info.match(/keyspace_hits:(\d+)/)
    const missesMatch = info.match(/keyspace_misses:(\d+)/)

    const hits = parseInt(hitsMatch?.[1] || '0')
    const misses = parseInt(missesMatch?.[1] || '0')
    const total = hits + misses
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0'

    logger.info('[CacheStats] Retrieved cache statistics', {
      totalKeys: stats.totalKeys,
      hitRate: `${hitRate}%`,
      byAccount: stats.byAccount
    })

    return NextResponse.json({
      cache: {
        ...stats,
        hitRate: `${hitRate}%`,
        totalHits: hits,
        totalMisses: misses,
        totalRequests: total
      },
      ttl: {
        question: '5 minutos',
        item: '30 minutos',
        user: '1 hora',
        shipping: '1 hora',
        reputation: '2 horas',
        metrics: '10 minutos'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[CacheStats] Error retrieving cache statistics', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve cache statistics' },
      { status: 500 }
    )
  }
}
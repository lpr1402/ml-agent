/**
 * API: System Status
 * GET /api/admin/system
 * Retorna status de processos PM2 e recursos do sistema
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { validateAdminAccess } from '@/lib/admin/admin-auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Validar acesso admin
    const { isValid } = await validateAdminAccess()

    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // PM2 Status
    const { stdout: pm2Output } = await execAsync('pm2 jlist')
    const pm2Processes = JSON.parse(pm2Output)

    const processes = pm2Processes.map((p: any) => ({
      id: p.pm_id,
      name: p.name,
      status: p.pm2_env.status,
      cpu: `${p.monit.cpu}%`,
      memory: `${Math.round(p.monit.memory / 1024 / 1024)}mb`,
      uptime: formatUptime(p.pm2_env.pm_uptime),
      restarts: p.pm2_env.restart_time || 0
    }))

    // System Metrics
    const totalMemGB = os.totalmem() / 1024 / 1024 / 1024
    const freeMemGB = os.freemem() / 1024 / 1024 / 1024
    const usedMemGB = totalMemGB - freeMemGB

    const cpuUsage = (os.loadavg()[0] || 0).toFixed(2)
    const uptime = os.uptime()

    // Database Status
    let dbStatus = 'disconnected'
    try {
      await prisma.$queryRaw`SELECT 1`
      dbStatus = 'connected'
    } catch {}

    // Redis Status
    let redisStatus = 'disconnected'
    let redisMemory = '0 MB'
    let redisKeys = 0
    try {
      const info = await redis.info('memory')
      const memMatch = info.match(/used_memory_human:(\S+)/)
      if (memMatch) redisMemory = memMatch[1]!

      redisKeys = await redis.dbsize()
      redisStatus = 'connected'
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        processes,
        system: {
          totalMemory: `${totalMemGB.toFixed(1)} GB`,
          usedMemory: `${usedMemGB.toFixed(1)} GB`,
          freeMemory: `${freeMemGB.toFixed(1)} GB`,
          cpuUsage: `${cpuUsage}%`,
          uptime: formatUptime(uptime * 1000),
          platform: `${os.platform()} ${os.arch()}`,
          nodeVersion: process.version
        },
        database: {
          status: dbStatus,
          connections: 0, // PM2 não expõe isso facilmente
          poolSize: 30
        },
        redis: {
          status: redisStatus,
          memory: redisMemory,
          keys: redisKeys
        }
      }
    })

  } catch (error: any) {
    console.error('[Admin API] Error fetching system metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system metrics' },
      { status: 500 }
    )
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

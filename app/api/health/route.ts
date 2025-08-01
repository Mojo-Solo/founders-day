import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check basic application health
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
      },
      services: {
        frontend: 'healthy',
        adminApi: 'unknown'
      } as Record<string, string>
    }

    // Optional: Check external dependencies
    const adminApiUrl = process.env.NEXT_PUBLIC_ADMIN_API_URL
    if (adminApiUrl) {
      try {
        const response = await fetch(`${adminApiUrl}/api/public/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })
        
        health.services.adminApi = response.ok ? 'healthy' : 'degraded'
      } catch (error) {
        health.services.adminApi = 'unavailable'
      }
    }

    return NextResponse.json(health, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache', 
        'Expires': '0'
      }
    })
  }
}

export async function HEAD() {
  // Simple HEAD request for basic health check
  return new Response(null, { status: 200 })
}
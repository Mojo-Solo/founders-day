import { NextRequest, NextResponse } from 'next/server'

export async function validateRequest(request: NextRequest) {
  const authToken = request.headers.get('authorization')
  
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Mock validation - in production, verify JWT token
  if (authToken !== 'Bearer mock-token') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
  
  return null // Request is valid
}

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export async function rateLimitMiddleware(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<boolean> {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}
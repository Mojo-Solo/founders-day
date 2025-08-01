import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key'
)

export async function signJWT(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret)
}

export async function verifyJWT(token: string) {
  const { payload } = await jwtVerify(token, secret)
  return payload
}

export async function getTokenFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

export async function validateRequest(request: NextRequest) {
  const token = await getTokenFromRequest(request)
  if (!token) {
    throw new Error('No authorization token provided')
  }
  
  try {
    const payload = await verifyJWT(token)
    return payload
  } catch (error) {
    throw new Error('Invalid authorization token')
  }
}
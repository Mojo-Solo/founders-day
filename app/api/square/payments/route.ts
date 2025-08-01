/**
 * Square Payments API Route
 * 
 * Comprehensive payment processing endpoints for Square integration.
 * Handles payment creation, updates, refunds, and status queries.
 * 
 * Routes:
 * - POST /api/square/payments - Create new payment
 * - PUT /api/square/payments - Update payment status
 * - DELETE /api/square/payments - Refund payment
 * - GET /api/square/payments - Query payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Client, Environment, CreatePaymentRequest, RefundPaymentRequest } from 'squareup'
import { validateRequest } from '@/lib/auth/jwt'
import { rateLimitMiddleware } from '@/lib/auth/middleware'
import logger from '@/lib/monitoring/logger'

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? Environment.Production 
    : Environment.Sandbox,
})

// Validation schemas
const createPaymentSchema = z.object({
  sourceId: z.string().min(1, 'Payment source ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  registrationId: z.string().uuid('Valid registration ID required'),
  customerEmail: z.string().email().optional(),
  customerInfo: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
  metadata: z.record(z.string()).optional(),
  locationId: z.string().optional(),
  idempotencyKey: z.string().optional(),
})

const refundPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().positive().optional(),
  reason: z.string().min(1, 'Refund reason is required'),
  idempotencyKey: z.string().optional(),
})

const updatePaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  status: z.enum(['completed', 'failed', 'cancelled']),
  metadata: z.record(z.string()).optional(),
})

/**
 * POST - Create new payment
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let requestData: any = {}

  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    const canProceed = await rateLimitMiddleware(
      request, 
      `square-payment:${clientIp}`, 
      10, // 10 requests
      5 * 60 * 1000 // per 5 minutes
    )

    if (!canProceed) {
      logger.warn('Square payment rate limit exceeded', { clientIp })
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request
    requestData = await request.json()
    const validatedData = createPaymentSchema.parse(requestData)

    // Log payment attempt
    logger.info('Square payment creation initiated', {
      registrationId: validatedData.registrationId,
      amount: validatedData.amount,
      currency: validatedData.currency,
      clientIp,
    })

    // Generate idempotency key if not provided
    const idempotencyKey = validatedData.idempotencyKey || 
      `payment-${validatedData.registrationId}-${Date.now()}`

    // Prepare payment request
    const paymentRequest: CreatePaymentRequest = {
      sourceId: validatedData.sourceId,
      idempotencyKey,
      amountMoney: {
        amount: BigInt(Math.round(validatedData.amount * 100)), // Convert to cents
        currency: validatedData.currency,
      },
      locationId: validatedData.locationId || process.env.SQUARE_LOCATION_ID,
      referenceId: validatedData.registrationId,
      note: `Founders Day registration payment - ${validatedData.registrationId}`,
    }

    // Add customer information if provided
    if (validatedData.customerInfo) {
      paymentRequest.buyerEmailAddress = validatedData.customerInfo.email || validatedData.customerEmail
    }

    // Create payment with Square
    const { result, statusCode } = await squareClient.paymentsApi.createPayment(paymentRequest)

    if (!result.payment) {
      throw new Error('No payment object returned from Square')
    }

    const payment = result.payment

    // Store payment in database using helper function
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_payment_id: payment.id,
        p_registration_id: validatedData.registrationId,
        p_amount_money_amount: Number(payment.amountMoney?.amount) || 0,
        p_amount_money_currency: payment.amountMoney?.currency || 'USD',
        p_total_money_amount: Number(payment.totalMoney?.amount) || 0,
        p_total_money_currency: payment.totalMoney?.currency || 'USD',
        p_status: payment.status || 'PENDING',
        p_source_type: payment.sourceType || 'CARD',
        p_card_brand: payment.cardDetails?.card?.cardBrand,
        p_card_last_4: payment.cardDetails?.card?.last4,
        p_receipt_number: payment.receiptNumber,
        p_receipt_url: payment.receiptUrl,
        p_reference_id: payment.referenceId,
        p_note: payment.note,
        p_buyer_email_address: payment.buyerEmailAddress,
        p_application_details_square_product: payment.applicationDetails?.squareProduct,
        p_application_details_application_id: payment.applicationDetails?.applicationId,
        p_idempotency_key: idempotencyKey,
        p_location_id: payment.locationId,
        p_created_at_square: payment.createdAt ? new Date(payment.createdAt) : new Date(),
        p_updated_at_square: payment.updatedAt ? new Date(payment.updatedAt) : new Date(),
      }),
    })

    if (!dbResult.ok) {
      logger.error('Failed to store payment in database', {
        paymentId: payment.id,
        error: await dbResult.text(),
      })
      // Continue - payment was successful with Square
    }

    // Log successful payment
    logger.info('Square payment created successfully', {
      paymentId: payment.id,
      registrationId: validatedData.registrationId,
      amount: validatedData.amount,
      status: payment.status,
      duration: Date.now() - startTime,
    })

    // Return success response
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: Number(payment.amountMoney?.amount) / 100,
        currency: payment.amountMoney?.currency,
        receiptUrl: payment.receiptUrl,
        receiptNumber: payment.receiptNumber,
        referenceId: payment.referenceId,
        createdAt: payment.createdAt,
      },
      idempotencyKey,
    })

  } catch (error) {
    // Log error
    logger.error('Square payment creation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestData,
      duration: Date.now() - startTime,
    })

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    // Handle Square API errors
    if (error && typeof error === 'object' && 'result' in error) {
      const squareError = error as any
      return NextResponse.json(
        {
          error: 'Payment processing failed',
          details: squareError.result?.errors || squareError.message,
        },
        { status: 400 }
      )
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update payment status
 */
export async function PUT(request: NextRequest) {
  const startTime = Date.now()
  let requestData: any = {}

  try {
    // Authentication required for updates
    const tokenPayload = await validateRequest(request)
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request
    requestData = await request.json()
    const validatedData = updatePaymentSchema.parse(requestData)

    // Log update attempt
    logger.info('Square payment update initiated', {
      paymentId: validatedData.paymentId,
      newStatus: validatedData.status,
      userId: tokenPayload.userId,
    })

    // Update payment in database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/update_square_payment_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_payment_id: validatedData.paymentId,
        p_status: validatedData.status.toUpperCase(),
        p_metadata: validatedData.metadata,
      }),
    })

    if (!dbResult.ok) {
      throw new Error(`Database update failed: ${await dbResult.text()}`)
    }

    logger.info('Square payment updated successfully', {
      paymentId: validatedData.paymentId,
      status: validatedData.status,
      duration: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      paymentId: validatedData.paymentId,
      status: validatedData.status,
    })

  } catch (error) {
    logger.error('Square payment update failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestData,
      duration: Date.now() - startTime,
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Refund payment
 */
export async function DELETE(request: NextRequest) {
  const startTime = Date.now()
  let requestData: any = {}

  try {
    // Authentication required for refunds
    const tokenPayload = await validateRequest(request)
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request
    requestData = await request.json()
    const validatedData = refundPaymentSchema.parse(requestData)

    // Log refund attempt
    logger.info('Square payment refund initiated', {
      paymentId: validatedData.paymentId,
      amount: validatedData.amount,
      reason: validatedData.reason,
      userId: tokenPayload.userId,
    })

    // Generate idempotency key if not provided
    const idempotencyKey = validatedData.idempotencyKey || 
      `refund-${validatedData.paymentId}-${Date.now()}`

    // Prepare refund request
    const refundRequest: RefundPaymentRequest = {
      idempotencyKey,
      paymentId: validatedData.paymentId,
      reason: validatedData.reason,
    }

    // Add amount if partial refund
    if (validatedData.amount) {
      refundRequest.amountMoney = {
        amount: BigInt(Math.round(validatedData.amount * 100)),
        currency: 'USD',
      }
    }

    // Create refund with Square
    const { result } = await squareClient.refundsApi.refundPayment(refundRequest)

    if (!result.refund) {
      throw new Error('No refund object returned from Square')
    }

    const refund = result.refund

    // Store refund in database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/create_square_refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_refund_id: refund.id,
        p_square_payment_id: validatedData.paymentId,
        p_amount_money_amount: Number(refund.amountMoney?.amount) || 0,
        p_amount_money_currency: refund.amountMoney?.currency || 'USD',
        p_status: refund.status || 'PENDING',
        p_reason: refund.reason,
        p_idempotency_key: idempotencyKey,
        p_location_id: refund.locationId,
        p_created_at_square: refund.createdAt ? new Date(refund.createdAt) : new Date(),
        p_updated_at_square: refund.updatedAt ? new Date(refund.updatedAt) : new Date(),
      }),
    })

    if (!dbResult.ok) {
      logger.error('Failed to store refund in database', {
        refundId: refund.id,
        error: await dbResult.text(),
      })
      // Continue - refund was successful with Square
    }

    logger.info('Square payment refunded successfully', {
      refundId: refund.id,
      paymentId: validatedData.paymentId,
      amount: validatedData.amount,
      status: refund.status,
      duration: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        paymentId: refund.paymentId,
        status: refund.status,
        amount: Number(refund.amountMoney?.amount) / 100,
        currency: refund.amountMoney?.currency,
        reason: refund.reason,
        createdAt: refund.createdAt,
      },
      idempotencyKey,
    })

  } catch (error) {
    logger.error('Square payment refund failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestData,
      duration: Date.now() - startTime,
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'result' in error) {
      const squareError = error as any
      return NextResponse.json(
        {
          error: 'Refund processing failed',
          details: squareError.result?.errors || squareError.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET - Query payments
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authentication required for queries
    const tokenPayload = await validateRequest(request)
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const registrationId = searchParams.get('registrationId')
    const paymentId = searchParams.get('paymentId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query parameters
    const queryParams: any = {
      p_limit: limit,
      p_offset: offset,
    }

    if (registrationId) queryParams.p_registration_id = registrationId
    if (paymentId) queryParams.p_square_payment_id = paymentId
    if (status) queryParams.p_status = status.toUpperCase()

    // Query payments from database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_square_payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(queryParams),
    })

    if (!dbResult.ok) {
      throw new Error(`Database query failed: ${await dbResult.text()}`)
    }

    const payments = await dbResult.json()

    logger.info('Square payments queried successfully', {
      count: payments.length,
      filters: { registrationId, paymentId, status },
      duration: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      payments,
      pagination: {
        limit,
        offset,
        count: payments.length,
      },
    })

  } catch (error) {
    logger.error('Square payments query failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
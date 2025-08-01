/**
 * Enhanced Payments API Route
 * 
 * Unified payment processing endpoint that integrates with the Square API
 * and the existing registration system. Provides backward compatibility
 * while leveraging the comprehensive Square infrastructure.
 * 
 * Route: POST /api/payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { squareAPIClient } from '@/lib/services/square-api-client'
import { rateLimitMiddleware } from '@/lib/auth/middleware'
import logger from '@/lib/monitoring/logger'

// Validation schema for unified payment requests
const paymentRequestSchema = z.object({
  // Payment details
  sourceId: z.string().min(1, 'Payment source ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  
  // Registration details
  registrationId: z.string().uuid('Valid registration ID required'),
  registrationData: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().optional(),
    homeGroup: z.string().optional(),
    sobrietyDate: z.string().optional(),
    specialNeeds: z.string().optional(),
    dietaryRestrictions: z.string().optional(),
    accessibilityNeeds: z.string().optional(),
    additionalAttendees: z.array(z.object({
      firstName: z.string(),
      lastName: z.string()
    })).optional(),
    tickets: z.object({
      eventTickets: z.number().min(0).max(10),
      banquetTickets: z.number().min(0).max(10),
    }),
  }),
  
  // Payment options
  createCustomer: z.boolean().default(true),
  savePaymentMethod: z.boolean().default(false),
  
  // Legacy compatibility
  paymentType: z.enum(['registration', 'donation', 'banquet', 'hotel']).default('registration'),
  metadata: z.record(z.string()).optional(),
  
  // Idempotency
  idempotencyKey: z.string().optional(),
})

/**
 * POST - Process unified payment and registration
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let requestData: any = {}

  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    const canProceed = await rateLimitMiddleware(
      request, 
      `unified-payment:${clientIp}`, 
      5, // 5 requests
      5 * 60 * 1000 // per 5 minutes
    )

    if (!canProceed) {
      logger.warn('Unified payment rate limit exceeded', { clientIp })
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request
    requestData = await request.json()
    const validatedData = paymentRequestSchema.parse(requestData)

    // Log payment attempt
    logger.info('Unified payment processing initiated', {
      registrationId: validatedData.registrationId,
      amount: validatedData.amount,
      paymentType: validatedData.paymentType,
      email: validatedData.registrationData.email,
      clientIp,
    })

    // Generate idempotency key if not provided
    const idempotencyKey = validatedData.idempotencyKey || 
      `unified-${validatedData.registrationId}-${Date.now()}`

    // Step 1: Create/update registration record
    const registrationResult = await createOrUpdateRegistration(
      validatedData.registrationId,
      validatedData.registrationData
    )

    if (!registrationResult.success) {
      throw new Error(`Registration processing failed: ${registrationResult.error}`)
    }

    // Step 2: Create Square customer if requested
    let customerResult = null
    if (validatedData.createCustomer) {
      customerResult = await squareAPIClient.createCustomer({
        givenName: validatedData.registrationData.firstName,
        familyName: validatedData.registrationData.lastName,
        emailAddress: validatedData.registrationData.email,
        phoneNumber: validatedData.registrationData.phone,
        registrationId: validatedData.registrationId,
        idempotencyKey: `customer-${idempotencyKey}`,
        metadata: {
          paymentType: validatedData.paymentType,
          ...(validatedData.metadata || {}),
        },
      })

      if (!customerResult.success) {
        logger.warn('Customer creation failed, continuing with payment', {
          error: customerResult.error,
          registrationId: validatedData.registrationId,
        })
      }
    }

    // Step 3: Process payment
    const paymentResult = await squareAPIClient.createPayment({
      sourceId: validatedData.sourceId,
      amount: validatedData.amount,
      currency: validatedData.currency,
      registrationId: validatedData.registrationId,
      customerEmail: validatedData.registrationData.email,
      customerInfo: {
        firstName: validatedData.registrationData.firstName,
        lastName: validatedData.registrationData.lastName,
        email: validatedData.registrationData.email,
        phone: validatedData.registrationData.phone,
      },
      metadata: {
        paymentType: validatedData.paymentType,
        ticketsTotal: (validatedData.registrationData.tickets.eventTickets + 
                      validatedData.registrationData.tickets.banquetTickets).toString(),
        ...(validatedData.metadata || {}),
      },
      idempotencyKey,
    })

    if (!paymentResult.success) {
      // If payment fails, we should not leave the registration in limbo
      await updateRegistrationStatus(validatedData.registrationId, 'payment_failed')
      throw new Error(`Payment processing failed: ${paymentResult.error}`)
    }

    // Step 4: Update registration with payment information
    await updateRegistrationWithPayment(
      validatedData.registrationId,
      paymentResult.payment!.id,
      paymentResult.payment!.status,
      customerResult?.customer?.id
    )

    // Step 5: Handle post-payment processes
    if (paymentResult.payment!.status === 'COMPLETED') {
      await handleSuccessfulPayment(
        validatedData.registrationId,
        paymentResult.payment!,
        validatedData.registrationData
      )
    }

    // Log successful processing
    logger.info('Unified payment processed successfully', {
      registrationId: validatedData.registrationId,
      paymentId: paymentResult.payment!.id,
      customerId: customerResult?.customer?.id,
      amount: validatedData.amount,
      status: paymentResult.payment!.status,
      duration: Date.now() - startTime,
    })

    // Return unified response
    return NextResponse.json({
      success: true,
      registration: {
        id: validatedData.registrationId,
        status: registrationResult.status,
      },
      payment: paymentResult.payment,
      customer: customerResult?.customer,
      metadata: {
        processingTime: Date.now() - startTime,
        idempotencyKey,
        paymentType: validatedData.paymentType,
      },
    })

  } catch (error) {
    // Log error
    logger.error('Unified payment processing failed', {
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

    // Generic error response
    return NextResponse.json(
      { 
        error: 'Payment processing failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

// Helper functions

async function createOrUpdateRegistration(
  registrationId: string,
  registrationData: any
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    // Use the existing registration proxy API
    const registrationResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/proxy/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: registrationId,
          ...registrationData,
          paymentStatus: 'processing',
        }),
      }
    )

    if (!registrationResponse.ok) {
      const errorText = await registrationResponse.text()
      throw new Error(`Registration API error: ${errorText}`)
    }

    const result = await registrationResponse.json()

    return {
      success: true,
      status: result.status || 'created',
    }

  } catch (error) {
    logger.error('Registration creation/update failed', {
      registrationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function updateRegistrationStatus(
  registrationId: string,
  status: string
): Promise<void> {
  try {
    // Update registration status in database
    const updateResult = await fetch(`${process.env.DATABASE_URL}/rpc/update_registration_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_registration_id: registrationId,
        p_status: status,
        p_updated_at: new Date(),
      }),
    })

    if (!updateResult.ok) {
      throw new Error(`Status update failed: ${await updateResult.text()}`)
    }

    logger.info('Registration status updated', {
      registrationId,
      status,
    })

  } catch (error) {
    logger.error('Registration status update failed', {
      registrationId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function updateRegistrationWithPayment(
  registrationId: string,
  paymentId: string,
  paymentStatus: string,
  customerId?: string
): Promise<void> {
  try {
    // Link payment to registration
    const linkResult = await fetch(`${process.env.DATABASE_URL}/rpc/link_payment_to_registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_registration_id: registrationId,
        p_square_payment_id: paymentId,
        p_payment_status: paymentStatus,
        p_square_customer_id: customerId,
        p_updated_at: new Date(),
      }),
    })

    if (!linkResult.ok) {
      throw new Error(`Payment linking failed: ${await linkResult.text()}`)
    }

    logger.info('Registration linked to payment', {
      registrationId,
      paymentId,
      paymentStatus,
      customerId,
    })

  } catch (error) {
    logger.error('Registration payment linking failed', {
      registrationId,
      paymentId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function handleSuccessfulPayment(
  registrationId: string,
  payment: any,
  registrationData: any
): Promise<void> {
  try {
    // Mark registration as confirmed
    await updateRegistrationStatus(registrationId, 'confirmed')

    // Send confirmation email (if email service is available)
    await sendConfirmationEmail(
      registrationData.email,
      registrationData.firstName,
      registrationId,
      payment
    )

    // Log successful completion
    logger.info('Post-payment processing completed', {
      registrationId,
      paymentId: payment.id,
      email: registrationData.email,
    })

  } catch (error) {
    logger.error('Post-payment processing failed', {
      registrationId,
      paymentId: payment.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function sendConfirmationEmail(
  email: string,
  firstName: string,
  registrationId: string,
  payment: any
): Promise<void> {
  try {
    // This would integrate with your email service
    // For now, just log the action
    logger.info('Confirmation email would be sent', {
      email,
      firstName,
      registrationId,
      paymentId: payment.id,
      amount: payment.amount,
      receiptUrl: payment.receiptUrl,
    })

    // TODO: Integrate with actual email service
    // Example:
    // await emailService.sendConfirmationEmail({
    //   to: email,
    //   firstName,
    //   registrationId,
    //   payment,
    // })

  } catch (error) {
    logger.error('Confirmation email sending failed', {
      email,
      registrationId,
      paymentId: payment.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET - Query payment status for registration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const registrationId = searchParams.get('registrationId')

    if (!registrationId) {
      return NextResponse.json(
        { error: 'Registration ID is required' },
        { status: 400 }
      )
    }

    // Query payments for this registration
    const paymentsResult = await squareAPIClient.getPaymentsForRegistration(registrationId)

    if (!paymentsResult.success) {
      throw new Error(`Payment query failed: ${paymentsResult.error}`)
    }

    // Get registration status
    const registrationStatus = await getRegistrationStatus(registrationId)

    return NextResponse.json({
      success: true,
      registrationId,
      registrationStatus: registrationStatus.status,
      payments: paymentsResult.payments || [],
      totalAmount: paymentsResult.payments?.reduce((sum, p) => sum + (p.amount_money_amount || 0), 0) || 0,
    })

  } catch (error) {
    logger.error('Payment status query failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getRegistrationStatus(registrationId: string): Promise<{
  status: string
  error?: string
}> {
  try {
    const statusResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_registration_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_registration_id: registrationId,
      }),
    })

    if (!statusResult.ok) {
      throw new Error(`Status query failed: ${await statusResult.text()}`)
    }

    const result = await statusResult.json()
    return { status: result.status || 'unknown' }

  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
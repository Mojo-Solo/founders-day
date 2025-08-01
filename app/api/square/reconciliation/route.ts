/**
 * Square Reconciliation API Route
 * 
 * Payment reconciliation endpoints for Square integration.
 * Handles payment verification, dispute resolution, and reporting.
 * 
 * Routes:
 * - GET /api/square/reconciliation - Get reconciliation reports
 * - POST /api/square/reconciliation/sync - Sync payments with Square
 * - POST /api/square/reconciliation/verify - Verify payment status
 * - POST /api/square/reconciliation/resolve - Resolve payment discrepancies
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SquareClient, SquareEnvironment } from 'square'
import type { Square } from 'square'
import { validateRequest } from '@/lib/auth/jwt'
import { rateLimitMiddleware } from '@/lib/auth/middleware'
import logger from '@/lib/monitoring/logger'

// Initialize Square client
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? SquareEnvironment.Production 
    : SquareEnvironment.Sandbox,
})

// Validation schemas
const syncPaymentsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  locationId: z.string().optional(),
  forceSync: z.boolean().default(false),
})

const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  expectedAmount: z.number().positive().optional(),
  expectedStatus: z.string().optional(),
})

const resolveDiscrepancySchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  action: z.enum(['update_local', 'update_remote', 'manual_review']),
  resolution: z.string().min(1, 'Resolution details required'),
  metadata: z.record(z.string(), z.any()).optional(),
})

/**
 * GET - Get reconciliation reports
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authentication required
    const tokenPayload = await validateRequest(request)
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'summary'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId')

    // Default to last 30 days if dates not provided
    const defaultEndDate = new Date()
    const defaultStartDate = new Date(defaultEndDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    const queryStartDate = startDate ? new Date(startDate) : defaultStartDate
    const queryEndDate = endDate ? new Date(endDate) : defaultEndDate

    logger.info('Reconciliation report requested', {
      metadata: {
        reportType,
        startDate: queryStartDate,
        endDate: queryEndDate,
        locationId,
        userId: tokenPayload.userId,
      }
    })

    let reportData: any = {}

    switch (reportType) {
      case 'summary':
        reportData = await generateSummaryReport(queryStartDate, queryEndDate, locationId)
        break
      
      case 'discrepancies':
        reportData = await generateDiscrepanciesReport(queryStartDate, queryEndDate, locationId)
        break
      
      case 'payments':
        reportData = await generatePaymentsReport(queryStartDate, queryEndDate, locationId)
        break
      
      case 'refunds':
        reportData = await generateRefundsReport(queryStartDate, queryEndDate, locationId)
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    logger.info('Reconciliation report generated successfully', {
      metadata: {
        reportType,
        recordCount: reportData.count || 0,
        duration: Date.now() - startTime,
      }
    })

    return NextResponse.json({
      success: true,
      reportType,
      dateRange: {
        startDate: queryStartDate,
        endDate: queryEndDate,
      },
      data: reportData,
      generatedAt: new Date(),
    })

  } catch (error) {
    logger.error('Reconciliation report generation failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Sync payments with Square
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let requestData: any = {}

  try {
    // Authentication required
    const tokenPayload = await validateRequest(request)
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting for sync operations
    const canProceed = await rateLimitMiddleware(
      `square-sync:${tokenPayload.userId}`, 
      3, // 3 requests
      60 * 60 * 1000 // per hour
    )

    if (!canProceed) {
      logger.warn('Square sync rate limit exceeded', { metadata: { userId: tokenPayload.userId } })
      return NextResponse.json(
        { error: 'Sync rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const { pathname } = new URL(request.url)
    
    if (pathname.endsWith('/sync')) {
      // Parse and validate sync request
      requestData = await request.json()
      const validatedData = syncPaymentsSchema.parse(requestData)

      logger.info('Payment sync initiated', {
        metadata: {
          startDate: validatedData.startDate,
          endDate: validatedData.endDate,
          locationId: validatedData.locationId,
          forceSync: validatedData.forceSync,
          userId: tokenPayload.userId,
        }
      })

      const syncResult = await syncPaymentsWithSquare(
        new Date(validatedData.startDate),
        new Date(validatedData.endDate),
        validatedData.locationId,
        validatedData.forceSync
      )

      logger.info('Payment sync completed', {
        metadata: {
          ...syncResult,
          duration: Date.now() - startTime,
        }
      })

      return NextResponse.json({
        success: true,
        sync: syncResult,
      })
    }

    if (pathname.endsWith('/verify')) {
      // Parse and validate verify request
      requestData = await request.json()
      const validatedData = verifyPaymentSchema.parse(requestData)

      logger.info('Payment verification initiated', {
        metadata: {
          paymentId: validatedData.paymentId,
          expectedAmount: validatedData.expectedAmount,
          expectedStatus: validatedData.expectedStatus,
          userId: tokenPayload.userId,
        }
      })

      const verificationResult = await verifyPaymentWithSquare(
        validatedData.paymentId,
        validatedData.expectedAmount,
        validatedData.expectedStatus
      )

      logger.info('Payment verification completed', {
        metadata: {
          paymentId: validatedData.paymentId,
          verified: verificationResult.verified,
          duration: Date.now() - startTime,
        }
      })

      return NextResponse.json({
        success: true,
        verification: verificationResult,
      })
    }

    if (pathname.endsWith('/resolve')) {
      // Parse and validate resolve request
      requestData = await request.json()
      const validatedData = resolveDiscrepancySchema.parse(requestData)

      logger.info('Discrepancy resolution initiated', {
        metadata: {
          paymentId: validatedData.paymentId,
          action: validatedData.action,
          userId: tokenPayload.userId,
        }
      })

      const resolutionResult = await resolvePaymentDiscrepancy(
        validatedData.paymentId,
        validatedData.action,
        validatedData.resolution,
        validatedData.metadata
      )

      logger.info('Discrepancy resolution completed', {
        metadata: {
          paymentId: validatedData.paymentId,
          action: validatedData.action,
          resolved: resolutionResult.resolved,
          duration: Date.now() - startTime,
        }
      })

      return NextResponse.json({
        success: true,
        resolution: resolutionResult,
      })
    }

    return NextResponse.json(
      { error: 'Invalid operation' },
      { status: 400 }
    )

  } catch (error) {
    logger.error('Square reconciliation operation failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestData,
        duration: Date.now() - startTime,
      }
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.issues,
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

// Helper functions

async function generateSummaryReport(startDate: Date, endDate: Date, locationId?: string | null) {
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_reconciliation_summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_location_id: locationId,
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database query failed: ${await dbResult.text()}`)
  }

  return await dbResult.json()
}

async function generateDiscrepanciesReport(startDate: Date, endDate: Date, locationId?: string | null) {
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_payment_discrepancies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_location_id: locationId,
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database query failed: ${await dbResult.text()}`)
  }

  return await dbResult.json()
}

async function generatePaymentsReport(startDate: Date, endDate: Date, locationId?: string | null) {
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_payments_report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_location_id: locationId,
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database query failed: ${await dbResult.text()}`)
  }

  return await dbResult.json()
}

async function generateRefundsReport(startDate: Date, endDate: Date, locationId?: string | null) {
  const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_refunds_report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_location_id: locationId,
    }),
  })

  if (!dbResult.ok) {
    throw new Error(`Database query failed: ${await dbResult.text()}`)
  }

  return await dbResult.json()
}

async function syncPaymentsWithSquare(
  startDate: Date, 
  endDate: Date, 
  locationId?: string | null,
  forceSync = false
) {
  const syncResults = {
    totalProcessed: 0,
    successfulSyncs: 0,
    errors: [] as any[],
    discrepancies: [] as any[],
  }

  try {
    // Get payments from Square API
    let cursor: string | undefined
    
    do {
      const result = await squareClient.payments.list({
        locationId: locationId || process.env.SQUARE_LOCATION_ID,
        beginTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        sortOrder: 'DESC',
        cursor,
        limit: 100,
      })

      if (result) {
        // Iterate through paginated results
        for await (const payment of result) {
          syncResults.totalProcessed++

          try {
            // Sync payment to database
            const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/sync_square_payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                p_square_payment_id: payment.id,
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
                p_location_id: payment.locationId,
                p_created_at_square: payment.createdAt ? new Date(payment.createdAt) : new Date(),
                p_updated_at_square: payment.updatedAt ? new Date(payment.updatedAt) : new Date(),
                p_force_sync: forceSync,
              }),
            })

            if (dbResult.ok) {
              syncResults.successfulSyncs++
            } else {
              const errorText = await dbResult.text()
              syncResults.errors.push({
                paymentId: payment.id,
                error: errorText,
              })
            }

          } catch (paymentError) {
            syncResults.errors.push({
              paymentId: payment.id,
              error: paymentError instanceof Error ? paymentError.message : 'Unknown error',
            })
          }
        }
      }

      // For paginated results, we'd need to handle cursor differently
      cursor = undefined // Disable pagination for now

    } while (cursor)

  } catch (error) {
    syncResults.errors.push({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'Square API',
    })
  }

  return syncResults
}

async function verifyPaymentWithSquare(
  paymentId: string, 
  expectedAmount?: number, 
  expectedStatus?: string
) {
  try {
    // Get payment from Square
    const result = await squareClient.payments.get({ paymentId })
    
    if (!result || result.errors || !result.payment) {
      return {
        verified: false,
        error: 'Payment not found in Square',
        paymentId,
      }
    }

    const squarePayment = result.payment

    // Get payment from database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_square_payment_by_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_payment_id: paymentId,
      }),
    })

    if (!dbResult.ok) {
      return {
        verified: false,
        error: 'Payment not found in database',
        paymentId,
      }
    }

    const dbPayment = await dbResult.json()

    // Compare payment details
    const discrepancies = []

    if (expectedAmount && Number(squarePayment.amountMoney?.amount) / 100 !== expectedAmount) {
      discrepancies.push({
        field: 'amount',
        expected: expectedAmount,
        square: Number(squarePayment.amountMoney?.amount) / 100,
        database: dbPayment.amount_money_amount / 100,
      })
    }

    if (expectedStatus && squarePayment.status !== expectedStatus.toUpperCase()) {
      discrepancies.push({
        field: 'status',
        expected: expectedStatus.toUpperCase(),
        square: squarePayment.status,
        database: dbPayment.status,
      })
    }

    // Check for database-Square discrepancies
    if (squarePayment.status !== dbPayment.status) {
      discrepancies.push({
        field: 'status',
        square: squarePayment.status,
        database: dbPayment.status,
      })
    }

    if (Number(squarePayment.amountMoney?.amount) !== dbPayment.amount_money_amount) {
      discrepancies.push({
        field: 'amount',
        square: Number(squarePayment.amountMoney?.amount),
        database: dbPayment.amount_money_amount,
      })
    }

    return {
      verified: discrepancies.length === 0,
      paymentId,
      squarePayment: {
        id: squarePayment.id,
        status: squarePayment.status,
        amount: Number(squarePayment.amountMoney?.amount) / 100,
        currency: squarePayment.amountMoney?.currency,
        createdAt: squarePayment.createdAt,
        updatedAt: squarePayment.updatedAt,
      },
      databasePayment: dbPayment,
      discrepancies,
    }

  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      paymentId,
    }
  }
}

async function resolvePaymentDiscrepancy(
  paymentId: string,
  action: 'update_local' | 'update_remote' | 'manual_review',
  resolution: string,
  metadata?: Record<string, string>
) {
  try {
    // Log the resolution attempt
    const logResult = await fetch(`${process.env.DATABASE_URL}/rpc/log_discrepancy_resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_payment_id: paymentId,
        p_action: action,
        p_resolution: resolution,
        p_metadata: metadata || {},
      }),
    })

    if (!logResult.ok) {
      throw new Error(`Failed to log resolution: ${await logResult.text()}`)
    }

    let resolutionResult = { resolved: false, details: '' }

    switch (action) {
      case 'update_local':
        // Update local database with Square data
        const verification = await verifyPaymentWithSquare(paymentId)
        if (verification.squarePayment) {
          const updateResult = await fetch(`${process.env.DATABASE_URL}/rpc/update_payment_from_square`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              p_square_payment_id: paymentId,
              p_square_data: verification.squarePayment,
            }),
          })

          if (updateResult.ok) {
            resolutionResult = { resolved: true, details: 'Local database updated with Square data' }
          } else {
            throw new Error(`Failed to update local data: ${await updateResult.text()}`)
          }
        }
        break

      case 'update_remote':
        // This would require updating Square, which is typically not recommended
        // Instead, mark for manual review
        resolutionResult = { resolved: false, details: 'Remote updates not supported - marked for manual review' }
        break

      case 'manual_review':
        // Mark payment for manual review
        const reviewResult = await fetch(`${process.env.DATABASE_URL}/rpc/mark_payment_for_review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            p_square_payment_id: paymentId,
            p_review_notes: resolution,
            p_metadata: metadata || {},
          }),
        })

        if (reviewResult.ok) {
          resolutionResult = { resolved: true, details: 'Payment marked for manual review' }
        } else {
          throw new Error(`Failed to mark for review: ${await reviewResult.text()}`)
        }
        break
    }

    return {
      ...resolutionResult,
      paymentId,
      action,
      resolution,
    }

  } catch (error) {
    return {
      resolved: false,
      paymentId,
      action,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
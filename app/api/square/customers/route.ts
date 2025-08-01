/**
 * Square Customers API Route
 * 
 * Comprehensive customer management endpoints for Square integration.
 * Handles customer creation, updates, and profile management.
 * 
 * Routes:
 * - POST /api/square/customers - Create new customer
 * - PUT /api/square/customers - Update customer profile
 * - GET /api/square/customers - Query customers
 * - DELETE /api/square/customers - Delete customer
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
const addressSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  locality: z.string().optional(),
  administrativeDistrictLevel1: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
})

const createCustomerSchema = z.object({
  givenName: z.string().min(1).max(100),
  familyName: z.string().min(1).max(100),
  emailAddress: z.string().email(),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  address: addressSchema.optional(),
  registrationId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  idempotencyKey: z.string().optional(),
})

const updateCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  givenName: z.string().min(1).max(100).optional(),
  familyName: z.string().min(1).max(100).optional(),
  emailAddress: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  address: addressSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

/**
 * POST - Create new customer
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let requestData: any = {}

  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    const canProceed = await rateLimitMiddleware(
      `square-customer:${clientIp}`, 
      20, // 20 requests
      10 * 60 * 1000 // per 10 minutes
    )

    if (!canProceed) {
      logger.warn('Square customer creation rate limit exceeded', { metadata: { clientIp } })
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request
    requestData = await request.json()
    const validatedData = createCustomerSchema.parse(requestData)

    // Log customer creation attempt
    logger.info('Square customer creation initiated', {
      metadata: {
        email: validatedData.emailAddress,
        registrationId: validatedData.registrationId,
        clientIp,
      }
    })

    // Generate idempotency key if not provided
    const idempotencyKey = validatedData.idempotencyKey || 
      `customer-${validatedData.emailAddress}-${Date.now()}`

    // Check if customer already exists by email
    try {
      const searchResult = await squareClient.customers.search({
        query: {
          filter: {
            emailAddress: {
              exact: validatedData.emailAddress,
            },
          },
        },
      })

      if (searchResult.customers && searchResult.customers.length > 0) {
        const existingCustomer = searchResult.customers[0]
        
        // Update database with existing customer
        const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_customer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            p_square_customer_id: existingCustomer.id,
            p_email: existingCustomer.emailAddress,
            p_given_name: existingCustomer.givenName,
            p_family_name: existingCustomer.familyName,
            p_phone_number: existingCustomer.phoneNumber,
            p_company_name: existingCustomer.companyName,
            p_address_line_1: existingCustomer.address?.addressLine1,
            p_address_line_2: existingCustomer.address?.addressLine2,
            p_locality: existingCustomer.address?.locality,
            p_administrative_district_level_1: existingCustomer.address?.administrativeDistrictLevel1,
            p_postal_code: existingCustomer.address?.postalCode,
            p_country: existingCustomer.address?.country || 'US',
            p_created_at_square: existingCustomer.createdAt ? new Date(existingCustomer.createdAt) : new Date(),
            p_updated_at_square: existingCustomer.updatedAt ? new Date(existingCustomer.updatedAt) : new Date(),
          }),
        })

        if (!dbResult.ok) {
          logger.error('Failed to upsert existing customer in database', {
            metadata: {
              customerId: existingCustomer.id,
              error: await dbResult.text(),
            }
          })
        }

        logger.info('Square customer already exists, returning existing', {
          metadata: {
            customerId: existingCustomer.id,
            email: validatedData.emailAddress,
          }
        })

        return NextResponse.json({
          success: true,
          customer: {
            id: existingCustomer.id,
            givenName: existingCustomer.givenName,
            familyName: existingCustomer.familyName,
            emailAddress: existingCustomer.emailAddress,
            phoneNumber: existingCustomer.phoneNumber,
            companyName: existingCustomer.companyName,
            address: existingCustomer.address,
            createdAt: existingCustomer.createdAt,
            updatedAt: existingCustomer.updatedAt,
          },
          existing: true,
        })
      }
    } catch (searchError) {
      logger.warn('Customer search failed, proceeding with creation', {
        metadata: {
          error: searchError instanceof Error ? searchError.message : 'Unknown error',
        }
      })
    }

    // Prepare customer creation request
    const customerRequest: Square.CreateCustomerRequest = {
      idempotencyKey,
      givenName: validatedData.givenName,
      familyName: validatedData.familyName,
      emailAddress: validatedData.emailAddress,
    }

    // Add optional fields
    if (validatedData.phoneNumber) customerRequest.phoneNumber = validatedData.phoneNumber
    if (validatedData.companyName) customerRequest.companyName = validatedData.companyName
    if (validatedData.address) customerRequest.address = {
      ...validatedData.address,
      country: validatedData.address.country as Square.Country
    }

    // Create customer with Square
    const result = await squareClient.customers.create(customerRequest)

    if (!result || result.errors || !result.customer) {
      throw new Error('No customer object returned from Square')
    }

    const customer = result.customer

    // Store customer in database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_customer_id: customer.id,
        p_email: customer.emailAddress,
        p_given_name: customer.givenName,
        p_family_name: customer.familyName,
        p_phone_number: customer.phoneNumber,
        p_company_name: customer.companyName,
        p_address_line_1: customer.address?.addressLine1,
        p_address_line_2: customer.address?.addressLine2,
        p_locality: customer.address?.locality,
        p_administrative_district_level_1: customer.address?.administrativeDistrictLevel1,
        p_postal_code: customer.address?.postalCode,
        p_country: customer.address?.country || 'US',
        p_created_at_square: customer.createdAt ? new Date(customer.createdAt) : new Date(),
        p_updated_at_square: customer.updatedAt ? new Date(customer.updatedAt) : new Date(),
      }),
    })

    if (!dbResult.ok) {
      logger.error('Failed to store customer in database', {
        metadata: {
          customerId: customer.id,
          error: await dbResult.text(),
        }
      })
      // Continue - customer was successful with Square
    }

    // Link customer to registration if provided
    if (validatedData.registrationId) {
      const linkResult = await fetch(`${process.env.DATABASE_URL}/rpc/link_customer_to_registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_registration_id: validatedData.registrationId,
          p_square_customer_id: customer.id,
        }),
      })

      if (!linkResult.ok) {
        logger.error('Failed to link customer to registration', {
          metadata: {
            customerId: customer.id,
            registrationId: validatedData.registrationId,
            error: await linkResult.text(),
          }
        })
      }
    }

    logger.info('Square customer created successfully', {
      metadata: {
        customerId: customer.id,
        email: validatedData.emailAddress,
        registrationId: validatedData.registrationId,
        duration: Date.now() - startTime,
      }
    })

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        givenName: customer.givenName,
        familyName: customer.familyName,
        emailAddress: customer.emailAddress,
        phoneNumber: customer.phoneNumber,
        companyName: customer.companyName,
        address: customer.address,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      existing: false,
    })

  } catch (error) {
    logger.error('Square customer creation failed', {
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

    if (error && typeof error === 'object' && 'result' in error) {
      const squareError = error as any
      return NextResponse.json(
        {
          error: 'Customer creation failed',
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
 * PUT - Update customer profile
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
    const validatedData = updateCustomerSchema.parse(requestData)

    logger.info('Square customer update initiated', {
      metadata: {
        customerId: validatedData.customerId,
        userId: tokenPayload.userId,
      }
    })

    // Prepare update request
    const updateRequest: Square.UpdateCustomerRequest = {
      customerId: validatedData.customerId,
    }

    if (validatedData.givenName) updateRequest.givenName = validatedData.givenName
    if (validatedData.familyName) updateRequest.familyName = validatedData.familyName
    if (validatedData.emailAddress) updateRequest.emailAddress = validatedData.emailAddress
    if (validatedData.phoneNumber) updateRequest.phoneNumber = validatedData.phoneNumber
    if (validatedData.companyName) updateRequest.companyName = validatedData.companyName
    if (validatedData.address) updateRequest.address = {
      ...validatedData.address,
      country: validatedData.address.country as Square.Country
    }

    // Update customer with Square
    const result = await squareClient.customers.update(updateRequest)

    if (!result || result.errors || !result.customer) {
      throw new Error('No customer object returned from Square')
    }

    const customer = result.customer

    // Update customer in database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/upsert_square_customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_customer_id: customer.id,
        p_email: customer.emailAddress,
        p_given_name: customer.givenName,
        p_family_name: customer.familyName,
        p_phone_number: customer.phoneNumber,
        p_company_name: customer.companyName,
        p_address_line_1: customer.address?.addressLine1,
        p_address_line_2: customer.address?.addressLine2,
        p_locality: customer.address?.locality,
        p_administrative_district_level_1: customer.address?.administrativeDistrictLevel1,
        p_postal_code: customer.address?.postalCode,
        p_country: customer.address?.country || 'US',
        p_created_at_square: customer.createdAt ? new Date(customer.createdAt) : new Date(),
        p_updated_at_square: customer.updatedAt ? new Date(customer.updatedAt) : new Date(),
      }),
    })

    if (!dbResult.ok) {
      logger.error('Failed to update customer in database', {
        metadata: {
          customerId: customer.id,
          error: await dbResult.text(),
        }
      })
    }

    logger.info('Square customer updated successfully', {
      metadata: {
        customerId: customer.id,
        duration: Date.now() - startTime,
      }
    })

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        givenName: customer.givenName,
        familyName: customer.familyName,
        emailAddress: customer.emailAddress,
        phoneNumber: customer.phoneNumber,
        companyName: customer.companyName,
        address: customer.address,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
    })

  } catch (error) {
    logger.error('Square customer update failed', {
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

    if (error && typeof error === 'object' && 'result' in error) {
      const squareError = error as any
      return NextResponse.json(
        {
          error: 'Customer update failed',
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
 * GET - Query customers
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
    const customerId = searchParams.get('customerId')
    const email = searchParams.get('email')
    const registrationId = searchParams.get('registrationId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query parameters
    const queryParams: any = {
      p_limit: limit,
      p_offset: offset,
    }

    if (customerId) queryParams.p_square_customer_id = customerId
    if (email) queryParams.p_email = email
    if (registrationId) queryParams.p_registration_id = registrationId

    // Query customers from database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/get_square_customers`, {
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

    const customers = await dbResult.json()

    logger.info('Square customers queried successfully', {
      metadata: {
        count: customers.length,
        filters: { customerId, email, registrationId },
        duration: Date.now() - startTime,
      }
    })

    return NextResponse.json({
      success: true,
      customers,
      pagination: {
        limit,
        offset,
        count: customers.length,
      },
    })

  } catch (error) {
    logger.error('Square customers query failed', {
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
 * DELETE - Delete customer
 */
export async function DELETE(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authentication required for deletions
    const tokenPayload = await validateRequest(request)
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    logger.info('Square customer deletion initiated', {
      metadata: {
        customerId,
        userId: tokenPayload.userId,
      }
    })

    // Delete customer from Square
    await squareClient.customers.delete({ customerId })

    // Delete customer from database
    const dbResult = await fetch(`${process.env.DATABASE_URL}/rpc/delete_square_customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_square_customer_id: customerId,
      }),
    })

    if (!dbResult.ok) {
      logger.error('Failed to delete customer from database', {
        metadata: {
          customerId,
          error: await dbResult.text(),
        }
      })
    }

    logger.info('Square customer deleted successfully', {
      metadata: {
        customerId,
        duration: Date.now() - startTime,
      }
    })

    return NextResponse.json({
      success: true,
      customerId,
    })

  } catch (error) {
    logger.error('Square customer deletion failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }
    })

    if (error && typeof error === 'object' && 'result' in error) {
      const squareError = error as any
      return NextResponse.json(
        {
          error: 'Customer deletion failed',
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
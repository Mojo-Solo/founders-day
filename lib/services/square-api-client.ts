/**
 * Square API Client Service
 * 
 * Comprehensive client for interacting with Square API endpoints.
 * Provides type-safe methods for payments, customers, and reconciliation.
 */

import logger from '../monitoring/logger'

// Types
export interface CreatePaymentRequest {
  sourceId: string
  amount: number
  currency?: string
  registrationId: string
  customerEmail?: string
  customerInfo?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  metadata?: Record<string, string>
  locationId?: string
  idempotencyKey?: string
}

export interface PaymentResponse {
  success: boolean
  payment?: {
    id: string
    status: string
    amount: number
    currency: string
    receiptUrl?: string
    receiptNumber?: string
    referenceId?: string
    createdAt?: string
  }
  error?: string
  details?: any
}

export interface CreateCustomerRequest {
  givenName: string
  familyName: string
  emailAddress: string
  phoneNumber?: string
  companyName?: string
  address?: {
    addressLine1?: string
    addressLine2?: string
    locality?: string
    administrativeDistrictLevel1?: string
    postalCode?: string
    country?: string
  }
  registrationId?: string
  metadata?: Record<string, string>
  idempotencyKey?: string
}

export interface CustomerResponse {
  success: boolean
  customer?: {
    id: string
    givenName?: string
    familyName?: string
    emailAddress?: string
    phoneNumber?: string
    companyName?: string
    address?: any
    createdAt?: string
    updatedAt?: string
  }
  existing?: boolean
  error?: string
  details?: any
}

export interface RefundRequest {
  paymentId: string
  amount?: number
  reason: string
  idempotencyKey?: string
}

export interface RefundResponse {
  success: boolean
  refund?: {
    id: string
    paymentId: string
    status: string
    amount: number
    currency: string
    reason: string
    createdAt?: string
  }
  error?: string
  details?: any
}

export interface PaymentQuery {
  registrationId?: string
  paymentId?: string
  status?: string
  limit?: number
  offset?: number
}

export interface PaymentQueryResponse {
  success: boolean
  payments?: any[]
  pagination?: {
    limit: number
    offset: number
    count: number
  }
  error?: string
}

export interface ReconciliationReport {
  success: boolean
  reportType?: string
  dateRange?: {
    startDate: Date
    endDate: Date
  }
  data?: any
  generatedAt?: Date
  error?: string
}

export interface SyncRequest {
  startDate: string
  endDate: string
  locationId?: string
  forceSync?: boolean
}

export interface SyncResponse {
  success: boolean
  sync?: {
    totalProcessed: number
    successfulSyncs: number
    errors: any[]
    discrepancies: any[]
  }
  error?: string
}

/**
 * Square API Client Class
 */
export class SquareAPIClient {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    this.apiKey = apiKey
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    this.apiKey = token
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const config: RequestInit = {
      ...options,
      headers,
    }

    try {
      logger.info('Making Square API request', {
        method: config.method || 'GET',
        endpoint,
        hasAuth: !!this.apiKey,
      })

      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        logger.error('Square API request failed', {
          endpoint,
          status: response.status,
          error: data,
        })
      }

      return data as T
    } catch (error) {
      logger.error('Square API request error', {
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  // Payment Methods

  /**
   * Create a new payment
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    return this.makeRequest<PaymentResponse>('/api/square/payments', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Update payment status
   */
  async updatePayment(
    paymentId: string,
    status: string,
    metadata?: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    return this.makeRequest('/api/square/payments', {
      method: 'PUT',
      body: JSON.stringify({
        paymentId,
        status,
        metadata,
      }),
    })
  }

  /**
   * Refund a payment
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    return this.makeRequest<RefundResponse>('/api/square/payments', {
      method: 'DELETE',
      body: JSON.stringify(request),
    })
  }

  /**
   * Query payments
   */
  async queryPayments(query: PaymentQuery = {}): Promise<PaymentQueryResponse> {
    const params = new URLSearchParams()
    
    if (query.registrationId) params.append('registrationId', query.registrationId)
    if (query.paymentId) params.append('paymentId', query.paymentId)
    if (query.status) params.append('status', query.status)
    if (query.limit) params.append('limit', query.limit.toString())
    if (query.offset) params.append('offset', query.offset.toString())

    const queryString = params.toString()
    const endpoint = `/api/square/payments${queryString ? `?${queryString}` : ''}`

    return this.makeRequest<PaymentQueryResponse>(endpoint, {
      method: 'GET',
    })
  }

  // Customer Methods

  /**
   * Create a new customer
   */
  async createCustomer(request: CreateCustomerRequest): Promise<CustomerResponse> {
    return this.makeRequest<CustomerResponse>('/api/square/customers', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Update customer profile
   */
  async updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerRequest>
  ): Promise<CustomerResponse> {
    return this.makeRequest<CustomerResponse>('/api/square/customers', {
      method: 'PUT',
      body: JSON.stringify({
        customerId,
        ...updates,
      }),
    })
  }

  /**
   * Query customers
   */
  async queryCustomers(query: {
    customerId?: string
    email?: string
    registrationId?: string
    limit?: number
    offset?: number
  } = {}): Promise<{
    success: boolean
    customers?: any[]
    pagination?: any
    error?: string
  }> {
    const params = new URLSearchParams()
    
    if (query.customerId) params.append('customerId', query.customerId)
    if (query.email) params.append('email', query.email)
    if (query.registrationId) params.append('registrationId', query.registrationId)
    if (query.limit) params.append('limit', query.limit.toString())
    if (query.offset) params.append('offset', query.offset.toString())

    const queryString = params.toString()
    const endpoint = `/api/square/customers${queryString ? `?${queryString}` : ''}`

    return this.makeRequest(endpoint, {
      method: 'GET',
    })
  }

  /**
   * Delete customer
   */
  async deleteCustomer(customerId: string): Promise<{
    success: boolean
    customerId?: string
    error?: string
  }> {
    const params = new URLSearchParams()
    params.append('customerId', customerId)

    return this.makeRequest(`/api/square/customers?${params.toString()}`, {
      method: 'DELETE',
    })
  }

  // Reconciliation Methods

  /**
   * Get reconciliation report
   */
  async getReconciliationReport(
    type: 'summary' | 'discrepancies' | 'payments' | 'refunds',
    startDate?: string,
    endDate?: string,
    locationId?: string
  ): Promise<ReconciliationReport> {
    const params = new URLSearchParams()
    params.append('type', type)
    
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (locationId) params.append('locationId', locationId)

    return this.makeRequest<ReconciliationReport>(
      `/api/square/reconciliation?${params.toString()}`,
      {
        method: 'GET',
      }
    )
  }

  /**
   * Sync payments with Square
   */
  async syncPayments(request: SyncRequest): Promise<SyncResponse> {
    return this.makeRequest<SyncResponse>('/api/square/reconciliation/sync', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Verify payment status
   */
  async verifyPayment(
    paymentId: string,
    expectedAmount?: number,
    expectedStatus?: string
  ): Promise<{
    success: boolean
    verification?: any
    error?: string
  }> {
    return this.makeRequest('/api/square/reconciliation/verify', {
      method: 'POST',
      body: JSON.stringify({
        paymentId,
        expectedAmount,
        expectedStatus,
      }),
    })
  }

  /**
   * Resolve payment discrepancy
   */
  async resolveDiscrepancy(
    paymentId: string,
    action: 'update_local' | 'update_remote' | 'manual_review',
    resolution: string,
    metadata?: Record<string, string>
  ): Promise<{
    success: boolean
    resolution?: any
    error?: string
  }> {
    return this.makeRequest('/api/square/reconciliation/resolve', {
      method: 'POST',
      body: JSON.stringify({
        paymentId,
        action,
        resolution,
        metadata,
      }),
    })
  }

  // Utility Methods

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<PaymentQueryResponse> {
    return this.queryPayments({ paymentId })
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string) {
    return this.queryCustomers({ customerId })
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string) {
    return this.queryCustomers({ email })
  }

  /**
   * Get payments for registration
   */
  async getPaymentsForRegistration(registrationId: string): Promise<PaymentQueryResponse> {
    return this.queryPayments({ registrationId })
  }

  /**
   * Process registration payment flow
   */
  async processRegistrationPayment(
    registrationId: string,
    paymentRequest: CreatePaymentRequest,
    customerRequest?: CreateCustomerRequest
  ): Promise<{
    success: boolean
    payment?: any
    customer?: any
    errors?: string[]
  }> {
    const errors: string[] = []
    let customer: any = null
    let payment: any = null

    try {
      // Create customer if provided
      if (customerRequest) {
        const customerResponse = await this.createCustomer(customerRequest)
        if (customerResponse.success) {
          customer = customerResponse.customer
        } else {
          errors.push(`Customer creation failed: ${customerResponse.error}`)
        }
      }

      // Create payment
      const paymentResponse = await this.createPayment({
        ...paymentRequest,
        registrationId,
      })

      if (paymentResponse.success) {
        payment = paymentResponse.payment
      } else {
        errors.push(`Payment creation failed: ${paymentResponse.error}`)
      }

      return {
        success: errors.length === 0,
        payment,
        customer,
        errors: errors.length > 0 ? errors : undefined,
      }

    } catch (error) {
      logger.error('Registration payment flow failed', {
        registrationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        success: false,
        errors: [`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }
    }
  }

  /**
   * Batch process multiple operations
   */
  async batchProcess<T>(
    operations: Array<() => Promise<T>>,
    concurrency = 3
  ): Promise<Array<T | Error>> {
    const results: Array<T | Error> = []
    
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency)
      
      const batchResults = await Promise.allSettled(
        batch.map(operation => operation())
      )

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push(result.reason)
        }
      })
    }

    return results
  }

  /**
   * Health check for Square API endpoints
   */
  async healthCheck(): Promise<{
    success: boolean
    endpoints: Record<string, boolean>
    timestamp: Date
  }> {
    const endpoints = {
      payments: false,
      customers: false,
      reconciliation: false,
    }

    try {
      // Test payments endpoint
      const paymentsResponse = await this.queryPayments({ limit: 1 })
      endpoints.payments = paymentsResponse.success

      // Test customers endpoint
      const customersResponse = await this.queryCustomers({ limit: 1 })
      endpoints.customers = customersResponse.success

      // Test reconciliation endpoint
      const reconciliationResponse = await this.getReconciliationReport('summary')
      endpoints.reconciliation = reconciliationResponse.success

    } catch (error) {
      logger.error('Square API health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    const allHealthy = Object.values(endpoints).every(status => status)

    return {
      success: allHealthy,
      endpoints,
      timestamp: new Date(),
    }
  }
}

// Create singleton instance
export const squareAPIClient = new SquareAPIClient()

// Export convenience functions
export const createPayment = (request: CreatePaymentRequest) => 
  squareAPIClient.createPayment(request)

export const createCustomer = (request: CreateCustomerRequest) => 
  squareAPIClient.createCustomer(request)

export const refundPayment = (request: RefundRequest) => 
  squareAPIClient.refundPayment(request)

export const queryPayments = (query?: PaymentQuery) => 
  squareAPIClient.queryPayments(query)

export const getReconciliationReport = (
  type: 'summary' | 'discrepancies' | 'payments' | 'refunds',
  startDate?: string,
  endDate?: string,
  locationId?: string
) => squareAPIClient.getReconciliationReport(type, startDate, endDate, locationId)

export const processRegistrationPayment = (
  registrationId: string,
  paymentRequest: CreatePaymentRequest,
  customerRequest?: CreateCustomerRequest
) => squareAPIClient.processRegistrationPayment(registrationId, paymentRequest, customerRequest)
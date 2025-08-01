/**
 * Square Payments Hook Tests
 * 
 * Comprehensive test suite for the useSquarePayments hook covering:
 * - Payment processing states and flows
 * - Error handling and recovery
 * - Integration with Square Web SDK
 * - Loading states and user feedback
 * - Performance optimizations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { faker } from '@faker-js/faker'

// Mock Square Web SDK
const mockCard = {
  attach: vi.fn(),
  detach: vi.fn(),
  tokenize: vi.fn(),
  destroy: vi.fn(),
}

const mockPayments = {
  card: vi.fn(() => Promise.resolve(mockCard)),
}

const mockSquareWebSDK = {
  payments: vi.fn(() => Promise.resolve(mockPayments)),
}

// Set up global Square object
Object.defineProperty(window, 'Square', {
  value: mockSquareWebSDK,
  writable: true,
})

// Mock Square API client
const mockSquareAPI = {
  createPayment: vi.fn(),
  createCustomer: vi.fn(),
  processRegistrationPayment: vi.fn(),
}

vi.mock('@/lib/services/square-api-client', () => ({
  squareAPIClient: mockSquareAPI,
}))

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

vi.mock('@/lib/monitoring/logger', () => ({ default: mockLogger }))

// Import the hook to test
import { useSquarePayments } from '@/hooks/useSquarePayments'

describe('useSquarePayments Hook', () => {
  const defaultConfig = {
    applicationId: 'test-app-id',
    locationId: 'test-location-id',
    environment: 'sandbox' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default successful mocks
    mockSquareWebSDK.payments.mockResolvedValue(mockPayments)
    mockCard.attach.mockResolvedValue(undefined)
    mockCard.tokenize.mockResolvedValue({
      status: 'OK',
      token: 'test-card-token',
      details: {
        card: {
          brand: 'VISA',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
        },
      },
    })

    mockSquareAPI.createPayment.mockResolvedValue({
      success: true,
      payment: {
        id: 'test-payment-id',
        status: 'COMPLETED',
        amount: 25.00,
        receiptUrl: 'https://example.com/receipt',
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isInitialized).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.payment).toBeNull()
      expect(typeof result.current.processPayment).toBe('function')
      expect(typeof result.current.reset).toBe('function')
      expect(typeof result.current.initializeCard).toBe('function')
    })

    it('should initialize Square SDK successfully', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
      })

      expect(mockSquareWebSDK.payments).toHaveBeenCalledWith(
        'test-app-id',
        'test-location-id'
      )
      expect(mockPayments.card).toHaveBeenCalled()
      expect(mockCard.attach).toHaveBeenCalledWith('#card-container')
    })

    it('should handle Square SDK initialization failure', async () => {
      const initError = new Error('Square SDK failed to initialize')
      mockSquareWebSDK.payments.mockRejectedValue(initError)

      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(false)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toEqual({
          code: 'SDK_INIT_FAILED',
          message: 'Square SDK failed to initialize',
          recoverable: false,
        })
      })

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Square SDK initialization failed',
        expect.objectContaining({
          error: 'Square SDK failed to initialize',
        })
      )
    })

    it('should handle card attachment failure', async () => {
      const attachError = new Error('Card attachment failed')
      mockCard.attach.mockRejectedValue(attachError)

      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.error).toEqual({
          code: 'CARD_ATTACH_FAILED',
          message: 'Card attachment failed',
          recoverable: true,
        })
      })
    })

    it('should prevent multiple simultaneous initializations', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      // Start multiple initializations
      act(() => {
        result.current.initializeCard('card-container-1')
        result.current.initializeCard('card-container-2')
        result.current.initializeCard('card-container-3')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Should only initialize once
      expect(mockSquareWebSDK.payments).toHaveBeenCalledTimes(1)
      expect(mockPayments.card).toHaveBeenCalledTimes(1)
    })
  })

  describe('Payment Processing', () => {
    beforeEach(async () => {
      // Helper to initialize hook
      const { result } = renderHook(() => useSquarePayments(defaultConfig))
      
      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      return { result }
    })

    it('should process payment successfully', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      // Initialize first
      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      const paymentRequest = {
        amount: 2500,
        currency: 'USD',
        registrationId: faker.string.uuid(),
        customerEmail: 'test@example.com',
      }

      let paymentResult: any

      await act(async () => {
        paymentResult = await result.current.processPayment(paymentRequest)
      })

      expect(paymentResult.success).toBe(true)
      expect(paymentResult.payment.id).toBe('test-payment-id')
      expect(result.current.payment).toEqual(paymentResult.payment)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()

      // Verify SDK calls
      expect(mockCard.tokenize).toHaveBeenCalled()
      expect(mockSquareAPI.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: 'test-card-token',
          amount: 2500,
          currency: 'USD',
          registrationId: paymentRequest.registrationId,
          customerEmail: 'test@example.com',
        })
      )
    })

    it('should handle tokenization failure', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      mockCard.tokenize.mockResolvedValue({
        status: 'INVALID',
        errors: [{
          type: 'VALIDATION_ERROR',
          field: 'cardNumber',
          message: 'Card number is invalid',
        }],
      })

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      let paymentResult: any

      await act(async () => {
        paymentResult = await result.current.processPayment(paymentRequest)
      })

      expect(paymentResult.success).toBe(false)
      expect(result.current.error).toEqual({
        code: 'TOKENIZATION_FAILED',
        message: 'Card number is invalid',
        recoverable: true,
        details: expect.any(Array),
      })

      // Payment API should not be called
      expect(mockSquareAPI.createPayment).not.toHaveBeenCalled()
    })

    it('should handle payment API failure', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      mockSquareAPI.createPayment.mockRejectedValue({
        errors: [{
          code: 'CARD_DECLINED',
          detail: 'The card was declined',
          category: 'PAYMENT_METHOD_ERROR',
        }],
      })

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      let paymentResult: any

      await act(async () => {
        paymentResult = await result.current.processPayment(paymentRequest)
      })

      expect(paymentResult.success).toBe(false)
      expect(result.current.error).toEqual({
        code: 'CARD_DECLINED',
        message: 'The card was declined',
        recoverable: true,
      })
    })

    it('should prevent multiple simultaneous payments', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Mock slow payment processing
      mockSquareAPI.createPayment.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          payment: { id: 'slow-payment', status: 'COMPLETED', amount: 10 }
        }), 100))
      )

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      // Start multiple payments
      const payment1Promise = act(async () => 
        result.current.processPayment(paymentRequest)
      )
      
      const payment2Promise = act(async () => 
        result.current.processPayment(paymentRequest)
      )

      await Promise.all([payment1Promise, payment2Promise])

      // Should only process one payment
      expect(mockCard.tokenize).toHaveBeenCalledTimes(1)
      expect(mockSquareAPI.createPayment).toHaveBeenCalledTimes(1)
    })

    it('should handle network errors with retry capability', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      const networkError = new Error('Network request failed')
      mockSquareAPI.createPayment.mockRejectedValue(networkError)

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      let paymentResult: any

      await act(async () => {
        paymentResult = await result.current.processPayment(paymentRequest)
      })

      expect(paymentResult.success).toBe(false)
      expect(result.current.error).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
        recoverable: true,
      })

      // Test retry
      mockSquareAPI.createPayment.mockResolvedValue({
        success: true,
        payment: { id: 'retry-payment', status: 'COMPLETED', amount: 10 }
      })

      await act(async () => {
        paymentResult = await result.current.processPayment(paymentRequest)
      })

      expect(paymentResult.success).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should validate payment request parameters', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      const invalidRequests = [
        { amount: 0, currency: 'USD', registrationId: 'test' }, // Zero amount
        { amount: -100, currency: 'USD', registrationId: 'test' }, // Negative amount
        { amount: 1000, currency: '', registrationId: 'test' }, // Empty currency
        { amount: 1000, currency: 'USD', registrationId: '' }, // Empty registration ID
      ]

      for (const invalidRequest of invalidRequests) {
        let paymentResult: any

        await act(async () => {
          paymentResult = await result.current.processPayment(invalidRequest)
        })

        expect(paymentResult.success).toBe(false)
        expect(result.current.error?.code).toBe('VALIDATION_ERROR')

        // Reset error state for next test
        act(() => {
          result.current.reset()
        })
      }
    })

    it('should generate unique idempotency keys', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      // Process multiple payments
      await act(async () => {
        await result.current.processPayment(paymentRequest)
      })

      // Reset and process another
      act(() => {
        result.current.reset()
      })

      await act(async () => {
        await result.current.processPayment(paymentRequest)
      })

      // Verify different idempotency keys were used
      const calls = mockSquareAPI.createPayment.mock.calls
      expect(calls).toHaveLength(2)
      expect(calls[0][0].idempotencyKey).not.toBe(calls[1][0].idempotencyKey)
    })
  })

  describe('Customer Integration', () => {
    it('should create customer and process payment', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      mockSquareAPI.createCustomer.mockResolvedValue({
        success: true,
        customer: {
          id: 'test-customer-id',
          email: 'customer@example.com',
        },
      })

      const paymentRequest = {
        amount: 2500,
        currency: 'USD',
        registrationId: faker.string.uuid(),
        customerInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'customer@example.com',
          phone: '+1234567890',
        },
        createCustomer: true,
      }

      let paymentResult: any

      await act(async () => {
        paymentResult = await result.current.processPayment(paymentRequest)
      })

      expect(paymentResult.success).toBe(true)
      expect(mockSquareAPI.createCustomer).toHaveBeenCalledWith({
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'customer@example.com',
        phoneNumber: '+1234567890',
      })
      expect(mockSquareAPI.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customerInfo: expect.objectContaining({
            email: 'customer@example.com',
          }),
        })
      )
    })

    it('should handle customer creation failure gracefully', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      mockSquareAPI.createCustomer.mockRejectedValue(new Error('Customer creation failed'))

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
        customerInfo: {
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
        },
        createCustomer: true,
      }

      let paymentResult: any

      await act(async () => {
        paymentResult = await result.current.processPayment(paymentRequest)
      })

      // Payment should still succeed even if customer creation fails
      expect(paymentResult.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Customer creation failed, proceeding with payment',
        expect.any(Object)
      )
    })
  })

  describe('Error Recovery and Reset', () => {
    it('should reset hook state correctly', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Cause an error
      mockCard.tokenize.mockRejectedValue(new Error('Tokenization failed'))

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      await act(async () => {
        await result.current.processPayment(paymentRequest)
      })

      expect(result.current.error).not.toBeNull()

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.payment).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isInitialized).toBe(true) // Should remain initialized
    })

    it('should handle cleanup on unmount', () => {
      const { result, unmount } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      unmount()

      expect(mockCard.detach).toHaveBeenCalled()
      expect(mockCard.destroy).toHaveBeenCalled()
    })

    it('should handle reinitialization after cleanup', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      // Initialize
      act(() => {
        result.current.initializeCard('card-container-1')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Reset and reinitialize
      act(() => {
        result.current.reset()
        result.current.initializeCard('card-container-2')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Should have detached from first container and attached to second
      expect(mockCard.detach).toHaveBeenCalled()
      expect(mockCard.attach).toHaveBeenCalledWith('#card-container-2')
    })
  })

  describe('Loading States and User Feedback', () => {
    it('should manage loading states correctly during payment', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Mock slow payment processing
      let resolvePayment: (value: any) => void
      const paymentPromise = new Promise(resolve => {
        resolvePayment = resolve
      })
      mockSquareAPI.createPayment.mockReturnValue(paymentPromise)

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      // Start payment
      act(() => {
        result.current.processPayment(paymentRequest)
      })

      // Should be loading
      expect(result.current.isLoading).toBe(true)

      // Complete payment
      act(() => {
        resolvePayment!({
          success: true,
          payment: { id: 'slow-payment', status: 'COMPLETED', amount: 10 }
        })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should provide progress information during long operations', async () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Mock slow tokenization
      mockCard.tokenize.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          status: 'OK',
          token: 'slow-token'
        }), 100))
      )

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      act(() => {
        result.current.processPayment(paymentRequest)
      })

      // Should show tokenization progress
      expect(result.current.progress).toBe('tokenizing')

      await waitFor(() => {
        expect(result.current.progress).toBe('processing')
      })

      await waitFor(() => {
        expect(result.current.progress).toBeNull()
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Configuration and Environment', () => {
    it('should handle different environment configurations', () => {
      const productionConfig = {
        ...defaultConfig,
        environment: 'production' as const,
      }

      const { result } = renderHook(() => useSquarePayments(productionConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      expect(mockSquareWebSDK.payments).toHaveBeenCalledWith(
        'test-app-id',
        'test-location-id'
      )
    })

    it('should validate required configuration parameters', () => {
      const invalidConfigs = [
        { ...defaultConfig, applicationId: '' },
        { ...defaultConfig, locationId: '' },
        { applicationId: '', locationId: '', environment: 'sandbox' as const },
      ]

      invalidConfigs.forEach(config => {
        const { result } = renderHook(() => useSquarePayments(config))

        act(() => {
          result.current.initializeCard('card-container')
        })

        expect(result.current.error?.code).toBe('CONFIG_ERROR')
      })
    })

    it('should handle dynamic configuration updates', async () => {
      const { result, rerender } = renderHook(
        ({ config }) => useSquarePayments(config),
        { initialProps: { config: defaultConfig } }
      )

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Update configuration
      const newConfig = {
        ...defaultConfig,
        locationId: 'new-location-id',
      }

      rerender({ config: newConfig })

      // Should reinitialize with new config
      await waitFor(() => {
        expect(mockCard.detach).toHaveBeenCalled()
      })
    })
  })

  describe('Performance Optimizations', () => {
    it('should debounce rapid initialization attempts', () => {
      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      // Rapid initialization attempts
      act(() => {
        result.current.initializeCard('card-container')
        result.current.initializeCard('card-container')
        result.current.initializeCard('card-container')
      })

      // Should only initialize once
      expect(mockSquareWebSDK.payments).toHaveBeenCalledTimes(1)
    })

    it('should cache Square SDK instance', async () => {
      const { unmount } = renderHook(() => useSquarePayments(defaultConfig))

      const { result } = renderHook(() => useSquarePayments(defaultConfig))

      act(() => {
        result.current.initializeCard('card-container')
      })

      // Should reuse cached SDK instance
      expect(mockSquareWebSDK.payments).toHaveBeenCalledTimes(1)

      unmount()
    })

    it('should minimize re-renders during payment processing', async () => {
      let renderCount = 0
      
      const { result } = renderHook(() => {
        renderCount++
        return useSquarePayments(defaultConfig)
      })

      act(() => {
        result.current.initializeCard('card-container')
      })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      const initialRenderCount = renderCount

      const paymentRequest = {
        amount: 1000,
        currency: 'USD',
        registrationId: faker.string.uuid(),
      }

      await act(async () => {
        await result.current.processPayment(paymentRequest)
      })

      // Should not cause excessive re-renders
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(3)
    })
  })
})
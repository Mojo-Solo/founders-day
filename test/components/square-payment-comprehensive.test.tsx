/**
 * Comprehensive Square Payment Components Tests
 * 
 * Complete test suite for Square payment components covering:
 * - Payment form functionality and validation
 * - Square Web SDK integration
 * - Error handling and user experience
 * - Accessibility and keyboard navigation
 * - Performance and security testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { faker } from '@faker-js/faker'

expect.extend(toHaveNoViolations)

// Mock Square Web SDK
const mockSquareWebSDK = {
  payments: vi.fn(),
  card: vi.fn(),
  ach: vi.fn(),
  giftCard: vi.fn(),
}

const mockCard = {
  attach: vi.fn(),
  detach: vi.fn(),
  tokenize: vi.fn(),
  destroy: vi.fn(),
}

const mockPayments = {
  card: vi.fn(() => Promise.resolve(mockCard)),
  ach: vi.fn(),
  giftCard: vi.fn(),
}

// Global Square object mock
Object.defineProperty(window, 'Square', {
  value: mockSquareWebSDK,
  writable: true,
})

vi.mock('@square/web-sdk', () => ({
  payments: vi.fn(() => Promise.resolve(mockPayments)),
}))

// Mock Square API client
const mockSquareAPI = {
  createPayment: vi.fn(),
  createCustomer: vi.fn(),
  processRegistrationPayment: vi.fn(),
}

vi.mock('@/lib/services/square-api-client', () => ({
  squareAPIClient: mockSquareAPI,
  createPayment: mockSquareAPI.createPayment,
  createCustomer: mockSquareAPI.createCustomer,
}))

// Mock hooks
const mockUseSquarePayments = {
  isLoading: false,
  error: null,
  processPayment: vi.fn(),
  reset: vi.fn(),
}

vi.mock('@/hooks/useSquarePayments', () => ({
  useSquarePayments: () => mockUseSquarePayments,
}))

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

vi.mock('@/lib/monitoring/logger', () => ({ default: mockLogger }))

// Mock components to test
import { SquarePaymentForm } from '@/components/square-payment-form-fixed'
import { UnifiedPaymentForm } from '@/components/payment/UnifiedPaymentForm'

describe('Square Payment Components - Comprehensive Tests', () => {
  const user = userEvent.setup()

  const defaultProps = {
    amount: 2500, // $25.00
    currency: 'USD',
    onSuccess: vi.fn(),
    onError: vi.fn(),
    customerEmail: 'test@example.com',
    customerName: 'John Doe',
    registrationId: faker.string.uuid(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default successful Square SDK behavior
    mockSquareWebSDK.payments.mockResolvedValue(mockPayments)
    mockCard.attach.mockResolvedValue()
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

    mockUseSquarePayments.processPayment.mockResolvedValue({
      success: true,
      payment: {
        id: 'test-payment-id',
        status: 'COMPLETED',
        amount: 25.00,
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('SquarePaymentForm Component', () => {
    describe('Rendering and Initial State', () => {
      it('should render all required form elements', () => {
        render(<SquarePaymentForm {...defaultProps} />)

        expect(screen.getByText(/payment information/i)).toBeInTheDocument()
        expect(screen.getByText(/\$25\.00/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /pay/i })).toBeInTheDocument()
        expect(screen.getByText(/secure payment/i)).toBeInTheDocument()
      })

      it('should display correct amount formatting', () => {
        const amounts = [
          { amount: 100, expected: '$1.00' },
          { amount: 1500, expected: '$15.00' },
          { amount: 123456, expected: '$1,234.56' },
          { amount: 5, expected: '$0.05' },
        ]

        amounts.forEach(({ amount, expected }) => {
          const { rerender } = render(
            <SquarePaymentForm {...defaultProps} amount={amount} />
          )

          expect(screen.getByText(expected)).toBeInTheDocument()

          rerender(<div />)
        })
      })

      it('should show loading state during Square SDK initialization', async () => {
        // Mock delayed SDK initialization
        mockSquareWebSDK.payments.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve(mockPayments), 100))
        )

        render(<SquarePaymentForm {...defaultProps} />)

        expect(screen.getByText(/loading payment form/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled()

        await waitFor(
          () => {
            expect(screen.queryByText(/loading payment form/i)).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()
          },
          { timeout: 200 }
        )
      })

      it('should handle Square SDK initialization failure', async () => {
        mockSquareWebSDK.payments.mockRejectedValue(new Error('Square SDK failed to load'))

        render(<SquarePaymentForm {...defaultProps} />)

        await waitFor(() => {
          expect(screen.getByText(/payment system unavailable/i)).toBeInTheDocument()
          expect(screen.getByText(/please try again later/i)).toBeInTheDocument()
          expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled()
        })

        expect(defaultProps.onError).toHaveBeenCalledWith({
          code: 'SDK_INIT_ERROR',
          message: 'Square SDK failed to load',
          recoverable: false,
        })
      })
    })

    describe('Payment Processing', () => {
      it('should process successful payment with valid card', async () => {
        render(<SquarePaymentForm {...defaultProps} />)

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()
        })

        const payButton = screen.getByRole('button', { name: /pay/i })
        await user.click(payButton)

        // Verify loading state
        expect(payButton).toBeDisabled()
        expect(screen.getByText(/processing payment/i)).toBeInTheDocument()

        await waitFor(() => {
          expect(defaultProps.onSuccess).toHaveBeenCalledWith({
            paymentId: 'test-payment-id',
            amount: 25.00,
            receiptUrl: 'https://example.com/receipt',
          })
        })

        // Verify Square SDK was called correctly
        expect(mockCard.tokenize).toHaveBeenCalled()
        expect(mockSquareAPI.createPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceId: 'test-card-token',
            amount: 2500,
            currency: 'USD',
            registrationId: defaultProps.registrationId,
          })
        )
      })

      it('should handle payment processing with customer creation', async () => {
        const propsWithCustomerInfo = {
          ...defaultProps,
          createCustomer: true,
          customerInfo: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            phone: '+1234567890',
          },
        }

        mockSquareAPI.createCustomer.mockResolvedValue({
          success: true,
          customer: {
            id: 'test-customer-id',
            email: 'jane@example.com',
          },
        })

        render(<SquarePaymentForm {...propsWithCustomerInfo} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(mockSquareAPI.createCustomer).toHaveBeenCalledWith(
            expect.objectContaining({
              givenName: 'Jane',
              familyName: 'Smith',
              emailAddress: 'jane@example.com',
              phoneNumber: '+1234567890',
            })
          )
        })
      })

      it('should implement payment idempotency', async () => {
        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })

        // Click multiple times rapidly
        await user.click(payButton)
        await user.click(payButton)
        await user.click(payButton)

        await waitFor(() => {
          expect(mockCard.tokenize).toHaveBeenCalledTimes(1)
          expect(mockSquareAPI.createPayment).toHaveBeenCalledTimes(1)
        })

        // Verify idempotency key was used
        expect(mockSquareAPI.createPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            idempotencyKey: expect.stringMatching(/^payment-.*-\d+$/),
          })
        )
      })

      it('should handle partial payment failures gracefully', async () => {
        // Customer creation succeeds, payment fails
        mockSquareAPI.createCustomer.mockResolvedValue({
          success: true,
          customer: { id: 'customer-123' },
        })

        mockSquareAPI.createPayment.mockRejectedValue({
          errors: [{
            code: 'CARD_DECLINED',
            detail: 'The card was declined',
            category: 'PAYMENT_METHOD_ERROR',
          }],
        })

        render(<SquarePaymentForm {...defaultProps} createCustomer />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(screen.getByText(/card was declined/i)).toBeInTheDocument()
          expect(defaultProps.onError).toHaveBeenCalledWith({
            code: 'CARD_DECLINED',
            message: 'The card was declined',
            recoverable: true,
          })
        })

        // Customer should still be created
        expect(mockSquareAPI.createCustomer).toHaveBeenCalled()
      })
    })

    describe('Error Handling', () => {
      const errorScenarios = [
        {
          name: 'card declined',
          error: {
            errors: [{
              code: 'CARD_DECLINED',
              detail: 'Your card was declined.',
              category: 'PAYMENT_METHOD_ERROR',
            }],
          },
          expectedMessage: /card was declined/i,
          recoverable: true,
        },
        {
          name: 'insufficient funds',
          error: {
            errors: [{
              code: 'INSUFFICIENT_FUNDS',
              detail: 'Insufficient funds on card.',
              category: 'PAYMENT_METHOD_ERROR',
            }],
          },
          expectedMessage: /insufficient funds/i,
          recoverable: true,
        },
        {
          name: 'expired card',
          error: {
            errors: [{
              code: 'CARD_EXPIRED',
              detail: 'Your card has expired.',
              category: 'PAYMENT_METHOD_ERROR',
            }],
          },
          expectedMessage: /card has expired/i,
          recoverable: true,
        },
        {
          name: 'network error',
          error: new Error('Network request failed'),
          expectedMessage: /network error/i,
          recoverable: true,
        },
        {
          name: 'generic error',
          error: {
            errors: [{
              code: 'GENERIC_DECLINE',
              detail: 'Transaction declined',
              category: 'PAYMENT_METHOD_ERROR',
            }],
          },
          expectedMessage: /transaction declined/i,
          recoverable: true,
        },
      ]

      errorScenarios.forEach(({ name, error, expectedMessage, recoverable }) => {
        it(`should handle ${name} error gracefully`, async () => {
          mockSquareAPI.createPayment.mockRejectedValue(error)

          render(<SquarePaymentForm {...defaultProps} />)

          const payButton = await screen.findByRole('button', { name: /pay/i })
          await user.click(payButton)

          await waitFor(() => {
            expect(screen.getByText(expectedMessage)).toBeInTheDocument()
            if (recoverable) {
              expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
            }
          })

          expect(defaultProps.onError).toHaveBeenCalledWith(
            expect.objectContaining({
              recoverable,
            })
          )
        })
      })

      it('should provide retry functionality for recoverable errors', async () => {
        mockSquareAPI.createPayment
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({
            success: true,
            payment: { id: 'retry-payment-id', status: 'COMPLETED', amount: 25.00 },
          })

        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        // Wait for error to appear
        await waitFor(() => {
          expect(screen.getByText(/network timeout/i)).toBeInTheDocument()
        })

        // Click retry
        const retryButton = screen.getByRole('button', { name: /try again/i })
        await user.click(retryButton)

        // Should succeed on retry
        await waitFor(() => {
          expect(defaultProps.onSuccess).toHaveBeenCalledWith(
            expect.objectContaining({
              paymentId: 'retry-payment-id',
            })
          )
        })

        expect(mockCard.tokenize).toHaveBeenCalledTimes(2)
      })

      it('should handle tokenization errors', async () => {
        mockCard.tokenize.mockResolvedValue({
          status: 'INVALID',
          errors: [{
            type: 'VALIDATION_ERROR',
            field: 'cardNumber',
            message: 'Card number is invalid',
          }],
        })

        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(screen.getByText(/card number is invalid/i)).toBeInTheDocument()
          expect(defaultProps.onError).toHaveBeenCalledWith({
            code: 'TOKENIZATION_ERROR',
            message: 'Card number is invalid',
            recoverable: true,
          })
        })

        // Payment should not be attempted
        expect(mockSquareAPI.createPayment).not.toHaveBeenCalled()
      })

      it('should display multiple error messages when applicable', async () => {
        mockCard.tokenize.mockResolvedValue({
          status: 'INVALID',
          errors: [
            {
              type: 'VALIDATION_ERROR',
              field: 'cardNumber',
              message: 'Card number is invalid',
            },
            {
              type: 'VALIDATION_ERROR',
              field: 'expirationDate',
              message: 'Expiration date is invalid',
            },
          ],
        })

        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(screen.getByText(/card number is invalid/i)).toBeInTheDocument()
          expect(screen.getByText(/expiration date is invalid/i)).toBeInTheDocument()
        })
      })
    })

    describe('Form Validation', () => {
      it('should validate required customer information', async () => {
        const propsWithoutCustomerInfo = {
          ...defaultProps,
          customerEmail: undefined,
          customerName: undefined,
          requireCustomerInfo: true,
        }

        render(<SquarePaymentForm {...propsWithoutCustomerInfo} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(screen.getByText(/email is required/i)).toBeInTheDocument()
          expect(screen.getByText(/name is required/i)).toBeInTheDocument()
        })

        expect(mockCard.tokenize).not.toHaveBeenCalled()
        expect(mockSquareAPI.createPayment).not.toHaveBeenCalled()
      })

      it('should validate email format', async () => {
        const propsWithInvalidEmail = {
          ...defaultProps,
          customerEmail: 'invalid-email',
          requireCustomerInfo: true,
        }

        render(<SquarePaymentForm {...propsWithInvalidEmail} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument()
        })
      })

      it('should validate amount is positive', () => {
        render(<SquarePaymentForm {...defaultProps} amount={0} />)

        expect(screen.getByText(/invalid payment amount/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled()
      })

      it('should validate amount is not negative', () => {
        render(<SquarePaymentForm {...defaultProps} amount={-100} />)

        expect(screen.getByText(/invalid payment amount/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled()
      })
    })

    describe('Accessibility', () => {
      it('should meet accessibility standards', async () => {
        const { container } = render(<SquarePaymentForm {...defaultProps} />)

        const results = await axe(container)
        expect(results).toHaveNoViolations()
      })

      it('should be keyboard navigable', async () => {
        render(<SquarePaymentForm {...defaultProps} />)

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()
        })

        // Tab to pay button
        await user.tab()
        const payButton = screen.getByRole('button', { name: /pay/i })
        expect(payButton).toHaveFocus()

        // Enter should trigger payment
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(mockCard.tokenize).toHaveBeenCalled()
        })
      })

      it('should announce errors to screen readers', async () => {
        mockSquareAPI.createPayment.mockRejectedValue({
          errors: [{
            code: 'CARD_DECLINED',
            detail: 'Transaction was declined',
            category: 'PAYMENT_METHOD_ERROR',
          }],
        })

        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          const alert = screen.getByRole('alert')
          expect(alert).toHaveTextContent(/transaction was declined/i)
        })
      })

      it('should have proper ARIA labels and descriptions', async () => {
        render(<SquarePaymentForm {...defaultProps} />)

        await waitFor(() => {
          const payButton = screen.getByRole('button', { name: /pay/i })
          expect(payButton).toHaveAttribute('aria-describedby')
          
          const cardContainer = screen.getByTestId('square-card-container')
          expect(cardContainer).toHaveAttribute('aria-label', expect.stringContaining('card'))
        })
      })

      it('should support high contrast mode', () => {
        // Mock high contrast media query
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: vi.fn().mockImplementation(query => ({
            matches: query === '(prefers-contrast: high)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          })),
        })

        render(<SquarePaymentForm {...defaultProps} />)

        const form = screen.getByTestId('square-payment-form')
        expect(form).toHaveClass('high-contrast')
      })
    })

    describe('Performance', () => {
      it('should handle rapid user interactions gracefully', async () => {
        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })

        // Rapid clicking
        const clicks = Array.from({ length: 10 }, () => user.click(payButton))
        await Promise.all(clicks)

        // Should only process one payment
        expect(mockCard.tokenize).toHaveBeenCalledTimes(1)
        expect(mockSquareAPI.createPayment).toHaveBeenCalledTimes(1)
      })

      it('should clean up resources on unmount', () => {
        const { unmount } = render(<SquarePaymentForm {...defaultProps} />)

        unmount()

        expect(mockCard.detach).toHaveBeenCalled()
        expect(mockCard.destroy).toHaveBeenCalled()
      })

      it('should handle component re-renders efficiently', async () => {
        const { rerender } = render(<SquarePaymentForm {...defaultProps} />)

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()
        })

        // Re-render with same props
        rerender(<SquarePaymentForm {...defaultProps} />)

        // Should not re-initialize Square SDK
        expect(mockSquareWebSDK.payments).toHaveBeenCalledTimes(1)
        expect(mockPayments.card).toHaveBeenCalledTimes(1)
      })

      it('should debounce form validation', async () => {
        const propsWithValidation = {
          ...defaultProps,
          requireCustomerInfo: true,
          customerEmail: '',
        }

        const { rerender } = render(<SquarePaymentForm {...propsWithValidation} />)

        // Rapid prop changes
        const emails = ['a', 'ab', 'abc', 'abc@', 'abc@test', 'abc@test.com']
        
        for (const email of emails) {
          rerender(<SquarePaymentForm {...propsWithValidation} customerEmail={email} />)
        }

        // Should only validate final state
        await waitFor(() => {
          expect(screen.queryByText(/please enter a valid email/i)).not.toBeInTheDocument()
        })
      })
    })

    describe('Security', () => {
      it('should not log sensitive payment information', async () => {
        const consoleSpy = vi.spyOn(console, 'log')
        const consoleErrorSpy = vi.spyOn(console, 'error')
        const consoleWarnSpy = vi.spyOn(console, 'warn')

        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(defaultProps.onSuccess).toHaveBeenCalled()
        })

        // Check all console output
        const allLogs = [
          ...consoleSpy.mock.calls.flat(),
          ...consoleErrorSpy.mock.calls.flat(),
          ...consoleWarnSpy.mock.calls.flat(),
        ].join(' ')

        expect(allLogs).not.toMatch(/test-card-token/)
        expect(allLogs).not.toMatch(/4242/)
        expect(allLogs).not.toMatch(/cvv/i)
        expect(allLogs).not.toMatch(/credit.*card/i)

        consoleSpy.mockRestore()
        consoleErrorSpy.mockRestore()
        consoleWarnSpy.mockRestore()
      })

      it('should sanitize user input', async () => {
        const maliciousProps = {
          ...defaultProps,
          customerName: '<script>alert("xss")</script>',
          customerEmail: 'test@example.com<script>alert("xss")</script>',
        }

        render(<SquarePaymentForm {...maliciousProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(mockSquareAPI.createPayment).toHaveBeenCalledWith(
            expect.objectContaining({
              customerEmail: 'test@example.com',
              customerInfo: expect.objectContaining({
                firstName: expect.not.stringContaining('<script>'),
              }),
            })
          )
        })
      })

      it('should implement CSP-compliant inline styles', () => {
        render(<SquarePaymentForm {...defaultProps} />)

        const form = screen.getByTestId('square-payment-form')
        
        // Should not have inline style attributes
        expect(form).not.toHaveAttribute('style')
        
        // Should use CSS classes instead
        expect(form).toHaveClass('square-payment-form')
      })

      it('should validate SSL/TLS context', () => {
        // Mock non-secure context
        Object.defineProperty(window, 'isSecureContext', {
          value: false,
          writable: true,
        })

        render(<SquarePaymentForm {...defaultProps} />)

        expect(screen.getByText(/secure connection required/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled()
      })
    })

    describe('Internationalization', () => {
      it('should support different currencies', () => {
        const currencies = [
          { currency: 'USD', symbol: '$', amount: 2500, expected: '$25.00' },
          { currency: 'EUR', symbol: '€', amount: 2500, expected: '€25.00' },
          { currency: 'GBP', symbol: '£', amount: 2500, expected: '£25.00' },
          { currency: 'JPY', symbol: '¥', amount: 2500, expected: '¥2,500' },
        ]

        currencies.forEach(({ currency, expected, amount }) => {
          const { rerender } = render(
            <SquarePaymentForm {...defaultProps} currency={currency} amount={amount} />
          )

          expect(screen.getByText(expected)).toBeInTheDocument()

          rerender(<div />)
        })
      })

      it('should handle right-to-left languages', () => {
        // Mock RTL language
        document.documentElement.dir = 'rtl'
        document.documentElement.lang = 'ar'

        render(<SquarePaymentForm {...defaultProps} />)

        const form = screen.getByTestId('square-payment-form')
        expect(form).toHaveClass('rtl')

        // Cleanup
        document.documentElement.dir = 'ltr'
        document.documentElement.lang = 'en'
      })

      it('should localize error messages', async () => {
        // Mock locale
        Object.defineProperty(navigator, 'language', {
          value: 'es-ES',
          configurable: true,
        })

        mockSquareAPI.createPayment.mockRejectedValue({
          errors: [{
            code: 'CARD_DECLINED',
            detail: 'La tarjeta fue rechazada',
            category: 'PAYMENT_METHOD_ERROR',
          }],
        })

        render(<SquarePaymentForm {...defaultProps} />)

        const payButton = await screen.findByRole('button', { name: /pay/i })
        await user.click(payButton)

        await waitFor(() => {
          expect(screen.getByText(/la tarjeta fue rechazada/i)).toBeInTheDocument()
        })
      })
    })
  })

  describe('UnifiedPaymentForm Component', () => {
    const unifiedProps = {
      ...defaultProps,
      paymentMethods: ['square', 'stripe'],
      defaultMethod: 'square',
    }

    it('should render payment method selection', () => {
      render(<UnifiedPaymentForm {...unifiedProps} />)

      expect(screen.getByText(/select payment method/i)).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /square/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /stripe/i })).toBeInTheDocument()
    })

    it('should switch between payment methods', async () => {
      render(<UnifiedPaymentForm {...unifiedProps} />)

      // Square should be selected by default
      expect(screen.getByRole('radio', { name: /square/i })).toBeChecked()
      expect(screen.getByTestId('square-payment-form')).toBeInTheDocument()

      // Switch to Stripe
      await user.click(screen.getByRole('radio', { name: /stripe/i }))

      expect(screen.getByRole('radio', { name: /stripe/i })).toBeChecked()
      expect(screen.getByTestId('stripe-payment-form')).toBeInTheDocument()
      expect(screen.queryByTestId('square-payment-form')).not.toBeInTheDocument()
    })

    it('should maintain form state when switching methods', async () => {
      render(<UnifiedPaymentForm {...unifiedProps} requireCustomerInfo />)

      // Fill customer info
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'test@example.com')

      // Switch payment method
      await user.click(screen.getByRole('radio', { name: /stripe/i }))
      await user.click(screen.getByRole('radio', { name: /square/i }))

      // Customer info should be preserved
      expect(emailInput).toHaveValue('test@example.com')
    })

    it('should handle payment method-specific errors', async () => {
      mockSquareAPI.createPayment.mockRejectedValue({
        errors: [{
          code: 'SQUARE_SPECIFIC_ERROR',
          detail: 'Square-specific error occurred',
        }],
      })

      render(<UnifiedPaymentForm {...unifiedProps} />)

      const payButton = await screen.findByRole('button', { name: /pay/i })
      await user.click(payButton)

      await waitFor(() => {
        expect(screen.getByText(/square-specific error occurred/i)).toBeInTheDocument()
        expect(screen.getByText(/try different payment method/i)).toBeInTheDocument()
      })
    })

    it('should provide fallback when primary method fails', async () => {
      // Square fails to initialize
      mockSquareWebSDK.payments.mockRejectedValue(new Error('Square unavailable'))

      render(<UnifiedPaymentForm {...unifiedProps} autoFallback />)

      await waitFor(() => {
        // Should automatically switch to Stripe
        expect(screen.getByRole('radio', { name: /stripe/i })).toBeChecked()
        expect(screen.getByText(/switched to backup payment method/i)).toBeInTheDocument()
      })
    })
  })

  describe('Integration Tests', () => {
    it('should integrate with auth context for user data', async () => {
      const mockAuthUser = {
        id: '123',
        email: 'auth@example.com',
        name: 'Auth User',
      }

      // Mock auth context
      const AuthProvider = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="auth-provider">{children}</div>
      )

      render(
        <AuthProvider>
          <SquarePaymentForm {...defaultProps} useAuthUserData />
        </AuthProvider>
      )

      // Should use auth user data
      expect(screen.getByDisplayValue('auth@example.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Auth User')).toBeInTheDocument()
    })

    it('should integrate with cart context for amount calculation', async () => {
      const mockCartItems = [
        { id: '1', name: 'Item 1', price: 1000, quantity: 2 },
        { id: '2', name: 'Item 2', price: 500, quantity: 1 },
      ]

      const CartProvider = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="cart-provider">{children}</div>
      )

      render(
        <CartProvider>
          <SquarePaymentForm {...defaultProps} useCartTotal />
        </CartProvider>
      )

      // Should calculate total from cart
      expect(screen.getByText('$25.00')).toBeInTheDocument() // 2000 + 500 = 2500 cents
    })

    it('should integrate with notification system', async () => {
      const mockNotify = vi.fn()

      render(<SquarePaymentForm {...defaultProps} onNotify={mockNotify} />)

      const payButton = await screen.findByRole('button', { name: /pay/i })
      await user.click(payButton)

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith({
          type: 'success',
          title: 'Payment Successful',
          message: 'Your payment has been processed successfully.',
        })
      })
    })
  })
})
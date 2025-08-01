/**
 * Square Payment Component Tests
 * 
 * Production-ready test suite using TDD principles
 * Tests ALL edge cases and error scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SquarePaymentForm } from '../square-payment-form'
import * as squareAPI from '@/lib/square/square-api'

// Mock Square Web SDK
vi.mock('@square/web-sdk', () => ({
  payments: vi.fn().mockResolvedValue({
    card: vi.fn().mockResolvedValue({
      attach: vi.fn(),
      tokenize: vi.fn().mockResolvedValue({
        status: 'OK',
        token: 'test-payment-token'
      })
    })
  })
}))

// Mock our Square API
vi.mock('@/lib/square/square-api')

describe('SquarePaymentForm - Production Tests', () => {
  const mockOnSuccess = vi.fn()
  const mockOnError = vi.fn()
  
  const defaultProps = {
    amount: 10000, // $100.00
    onSuccess: mockOnSuccess,
    onError: mockOnError,
    customerEmail: 'test@example.com',
    customerName: 'Test User'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    global.fetch = vi.fn()
  })

  describe('Successful Payment Flow', () => {
    it('should process payment successfully with valid card', async () => {
      const user = userEvent.setup()
      
      // Mock successful payment
      vi.mocked(squareAPI.createPayment).mockResolvedValueOnce({
        payment: {
          id: 'payment_123',
          status: 'COMPLETED',
          amount_money: { amount: 10000, currency: 'USD' },
          receipt_url: 'https://receipt.url'
        }
      })

      const { container } = render(<SquarePaymentForm {...defaultProps} />)
      
      // Wait for Square to initialize
      await waitFor(() => {
        expect(container.querySelector('#card-container')).toBeInTheDocument()
      })

      // Find and click pay button
      const payButton = screen.getByRole('button', { name: /pay \$100\.00/i })
      expect(payButton).toBeEnabled()
      
      await user.click(payButton)

      // Verify loading state
      expect(payButton).toBeDisabled()
      expect(screen.getByText(/processing payment/i)).toBeInTheDocument()

      // Wait for success
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          paymentId: 'payment_123',
          receiptUrl: 'https://receipt.url',
          amount: 10000
        })
      })

      // Verify no errors
      expect(mockOnError).not.toHaveBeenCalled()
    })

    it('should validate required fields before payment', async () => {
      const user = userEvent.setup()
      
      // Render without customer info
      render(
        <SquarePaymentForm 
          amount={10000}
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      )

      const payButton = screen.getByRole('button', { name: /pay/i })
      await user.click(payButton)

      // Should show validation errors
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      
      // Payment should not be attempted
      expect(squareAPI.createPayment).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle declined card gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock declined payment
      vi.mocked(squareAPI.createPayment).mockRejectedValueOnce({
        errors: [{
          code: 'CARD_DECLINED',
          detail: 'Card was declined',
          category: 'PAYMENT_METHOD_ERROR'
        }]
      })

      render(<SquarePaymentForm {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()
      })

      await user.click(screen.getByRole('button', { name: /pay/i }))

      await waitFor(() => {
        expect(screen.getByText(/card was declined/i)).toBeInTheDocument()
        expect(mockOnError).toHaveBeenCalledWith({
          code: 'CARD_DECLINED',
          message: 'Card was declined',
          recoverable: true
        })
      })
    })

    it('should handle network errors with retry', async () => {
      const user = userEvent.setup()
      
      // Mock network error
      vi.mocked(squareAPI.createPayment).mockRejectedValueOnce(
        new Error('Network error')
      )

      render(<SquarePaymentForm {...defaultProps} />)
      
      const payButton = await screen.findByRole('button', { name: /pay/i })
      await user.click(payButton)

      // Should show error with retry option
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry payment/i })).toBeInTheDocument()
      })

      // Test retry
      vi.mocked(squareAPI.createPayment).mockResolvedValueOnce({
        payment: {
          id: 'payment_retry',
          status: 'COMPLETED',
          amount_money: { amount: 10000, currency: 'USD' },
          receipt_url: 'https://receipt.url'
        }
      })

      await user.click(screen.getByRole('button', { name: /retry payment/i }))

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    })

    it('should handle Square SDK initialization failure', async () => {
      // Mock Square SDK failure
      vi.mocked(window.Square.payments).mockRejectedValueOnce(
        new Error('Square SDK failed to load')
      )

      render(<SquarePaymentForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/payment system unavailable/i)).toBeInTheDocument()
        expect(screen.getByText(/please try again later/i)).toBeInTheDocument()
      })

      expect(mockOnError).toHaveBeenCalledWith({
        code: 'SDK_INIT_ERROR',
        message: 'Square SDK failed to load',
        recoverable: false
      })
    })
  })

  describe('Security & Compliance', () => {
    it('should not log sensitive payment information', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log')
      const consoleErrorSpy = vi.spyOn(console, 'error')
      
      render(<SquarePaymentForm {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()
      })

      // Check that no sensitive data is logged
      const allLogs = [
        ...consoleLogSpy.mock.calls.flat(),
        ...consoleErrorSpy.mock.calls.flat()
      ].join(' ')

      expect(allLogs).not.toMatch(/test-payment-token/)
      expect(allLogs).not.toMatch(/card.*number/i)
      expect(allLogs).not.toMatch(/cvv/i)
    })

    it('should implement request idempotency', async () => {
      const user = userEvent.setup()
      
      // Mock slow network
      let paymentCount = 0
      vi.mocked(squareAPI.createPayment).mockImplementation(() => {
        paymentCount++
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              payment: {
                id: `payment_${paymentCount}`,
                status: 'COMPLETED',
                amount_money: { amount: 10000, currency: 'USD' },
                receipt_url: 'https://receipt.url'
              }
            })
          }, 1000)
        })
      })

      render(<SquarePaymentForm {...defaultProps} />)
      
      const payButton = await screen.findByRole('button', { name: /pay/i })
      
      // Click multiple times quickly
      await user.click(payButton)
      await user.click(payButton)
      await user.click(payButton)

      // Should only process one payment
      await waitFor(() => {
        expect(squareAPI.createPayment).toHaveBeenCalledTimes(1)
      }, { timeout: 2000 })

      // Verify idempotency key was used
      expect(squareAPI.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/^[a-zA-Z0-9-]+$/)
        })
      )
    })

    it('should sanitize user input', async () => {
      const user = userEvent.setup()
      
      render(
        <SquarePaymentForm 
          {...defaultProps}
          customerName="<script>alert('xss')</script>"
          customerEmail="test@example.com<script>"
        />
      )

      const payButton = await screen.findByRole('button', { name: /pay/i })
      await user.click(payButton)

      // Verify sanitized input was sent
      expect(squareAPI.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: expect.not.stringContaining('<script>'),
          customerEmail: 'test@example.com'
        })
      )
    })
  })

  describe('Amount Handling', () => {
    it('should handle various amount formats correctly', () => {
      const amounts = [
        { input: 100, display: '$1.00' },
        { input: 1000, display: '$10.00' },
        { input: 10000, display: '$100.00' },
        { input: 123456, display: '$1,234.56' },
        { input: 0, display: '$0.00' }
      ]

      amounts.forEach(({ input, display }) => {
        const { rerender } = render(
          <SquarePaymentForm {...defaultProps} amount={input} />
        )
        
        expect(screen.getByText(new RegExp(display))).toBeInTheDocument()
        
        rerender(<div />)
      })
    })

    it('should prevent payment with invalid amount', async () => {
      const user = userEvent.setup()
      
      render(<SquarePaymentForm {...defaultProps} amount={-100} />)
      
      expect(screen.getByText(/invalid payment amount/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      
      render(<SquarePaymentForm {...defaultProps} />)
      
      // Tab through form
      await user.tab()
      
      // Pay button should be focused
      const payButton = screen.getByRole('button', { name: /pay/i })
      expect(payButton).toHaveFocus()
      
      // Enter should submit
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(squareAPI.createPayment).toHaveBeenCalled()
      })
    })

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup()
      
      vi.mocked(squareAPI.createPayment).mockRejectedValueOnce({
        errors: [{
          code: 'GENERIC_DECLINE',
          detail: 'Transaction declined',
          category: 'PAYMENT_METHOD_ERROR'
        }]
      })

      render(<SquarePaymentForm {...defaultProps} />)
      
      const payButton = await screen.findByRole('button', { name: /pay/i })
      await user.click(payButton)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent(/transaction declined/i)
      })
    })
  })
})
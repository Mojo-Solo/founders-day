export interface Payment {
  id: string;
  registrationId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  method: 'card' | 'cash' | 'check' | 'other';
  processor: 'square' | 'manual';
  processorId?: string;
  processorResponse?: Record<string, unknown>;
  refundAmount?: number;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Enhanced Square-specific payment interface
export interface SquarePayment extends Payment {
  processor: 'square';
  squarePaymentId: string;
  squareCustomerId?: string;
  squareOrderId?: string;
  cardBrand?: string;
  cardLast4?: string;
  receiptUrl?: string;
  squareRefundId?: string;
}

export interface PaymentIntent {
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason: string;
}

// Square-specific types to align with existing admin implementation
export interface SquarePaymentRequest {
  amount: number; // Amount in cents
  sourceId: string; // Payment source (card nonce or customer card ID)
  customerId?: string;
  orderId: string;
  description?: string;
  buyerEmail?: string;
}

export interface SquarePaymentResult {
  success: boolean;
  paymentId?: string;
  receiptUrl?: string;
  error?: string;
  details?: unknown;
}

// Type guards for runtime type checking
export function isSquarePayment(payment: Payment): payment is SquarePayment {
  return payment.processor === 'square' && 'squarePaymentId' in payment;
}

// Customer management types
export interface SquareCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  squareCustomerId: string;
  createdAt: string;
  updatedAt: string;
}

// Webhook event types
export interface SquareWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  signature: string;
  processed: boolean;
  createdAt: string;
}
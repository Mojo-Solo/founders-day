export interface Payment {
  id: string;
  registrationId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  method: 'card' | 'cash' | 'check' | 'other';
  processor: 'square' | 'manual';
  processorId?: string;
  processorResponse?: Record<string, unknown>;
  refundAmount?: number;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
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
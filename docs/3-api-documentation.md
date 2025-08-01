# API Documentation
## Founders Day Square Payment Integration

### Table of Contents
1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Customer Management APIs](#customer-management-apis)
4. [Product Catalog APIs](#product-catalog-apis)
5. [Cart Management APIs](#cart-management-apis)
6. [Order Processing APIs](#order-processing-apis)
7. [Payment Processing APIs](#payment-processing-apis)
8. [Admin Management APIs](#admin-management-apis)
9. [Webhook Endpoints](#webhook-endpoints)
10. [Error Handling](#error-handling)

---

## API Overview

### Base Configuration
```typescript
// API Configuration
const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  version: 'v1',
  timeout: 30000,
  
  // Rate limiting
  rateLimit: {
    requests: 100,
    window: '15m'
  },
  
  // Authentication
  auth: {
    tokenHeader: 'Authorization',
    tokenPrefix: 'Bearer ',
    refreshEndpoint: '/auth/refresh'
  }
};
```

### API Response Format
```typescript
// Success Response
interface APIResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  timestamp: string;
}

// Error Response
interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### Common Headers
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-API-Version: v1
X-Request-ID: <unique_request_id>
```

---

## Authentication

### POST /api/auth/login
Login with email and password.

**Request:**
```typescript
interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}
```

**Example:**
```bash
curl -X POST /api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "secure_password",
    "remember_me": true
  }'
```

**Response:**
```typescript
interface LoginResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'customer' | 'admin';
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
```

### POST /api/auth/register
Register a new customer account.

**Request:**
```typescript
interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}
```

**Response:**
```typescript
interface RegisterResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  message: string;
  email_verification_sent: boolean;
}
```

### POST /api/auth/refresh
Refresh authentication tokens.

**Request:**
```typescript
interface RefreshRequest {
  refresh_token: string;
}
```

**Response:**
```typescript
interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
```

---

## Customer Management APIs

### GET /api/customers/profile
Get authenticated customer's profile.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:**
```typescript
interface CustomerProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email_verified: boolean;
  addresses: CustomerAddress[];
  payment_methods: PaymentMethod[];
  created_at: string;
  updated_at: string;
}

interface CustomerAddress {
  id: string;
  type: 'shipping' | 'billing';
  first_name: string;
  last_name: string;
  company?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}
```

### PUT /api/customers/profile
Update customer profile.

**Request:**
```typescript
interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
}
```

**Example:**
```bash
curl -X PUT /api/customers/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890"
  }'
```

### POST /api/customers/addresses
Add a new customer address.

**Request:**
```typescript
interface AddAddressRequest {
  type: 'shipping' | 'billing';
  first_name: string;
  last_name: string;
  company?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default?: boolean;
}
```

### GET /api/customers/orders
Get customer's order history.

**Query Parameters:**
```typescript
interface OrderHistoryQuery {
  page?: number;
  limit?: number;
  status?: string;
  from_date?: string;
  to_date?: string;
}
```

**Response:**
```typescript
interface OrderHistoryResponse {
  orders: Order[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

## Product Catalog APIs

### GET /api/products
Get product catalog with filtering and pagination.

**Query Parameters:**
```typescript
interface ProductQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort_by?: 'name' | 'price' | 'created_at';
  sort_order?: 'asc' | 'desc';
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  featured?: boolean;
}
```

**Example:**
```bash
curl "api/products?page=1&limit=20&category=electronics&sort_by=price&sort_order=asc&in_stock=true"
```

**Response:**
```typescript
interface ProductListResponse {
  products: Product[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    filters: {
      categories: Category[];
      price_range: {
        min: number;
        max: number;
      };
    };
  };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description?: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  sku: string;
  stock_quantity: number;
  is_in_stock: boolean;
  images: ProductImage[];
  category: Category;
  is_featured: boolean;
  rating: number;
  review_count: number;
  created_at: string;
}
```

### GET /api/products/[slug]
Get product details by slug.

**Response:**
```typescript
interface ProductDetailResponse {
  product: Product & {
    dimensions?: {
      length: number;
      width: number;
      height: number;
      weight: number;
      unit: string;
    };
    variants?: ProductVariant[];
    related_products: Product[];
    reviews: ProductReview[];
    seo: {
      title: string;
      description: string;
      keywords: string[];
    };
  };
}
```

### GET /api/products/search
Advanced product search with full-text search capabilities.

**Query Parameters:**
```typescript
interface SearchQuery {
  q: string;           // Search query
  page?: number;
  limit?: number;
  filters?: {
    categories?: string[];
    price_range?: {
      min: number;
      max: number;
    };
    attributes?: Record<string, string[]>;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}
```

**Response:**
```typescript
interface SearchResponse {
  products: Product[];
  suggestions: string[];
  facets: {
    categories: Array<{
      id: string;
      name: string;
      count: number;
    }>;
    price_ranges: Array<{
      range: string;
      min: number;
      max: number;
      count: number;
    }>;
  };
  meta: PaginationMeta;
}
```

### GET /api/categories
Get product categories hierarchy.

**Response:**
```typescript
interface CategoriesResponse {
  categories: Category[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  children?: Category[];
  product_count: number;
  is_active: boolean;
}
```

---

## Cart Management APIs

### GET /api/cart
Get current cart contents.

**Response:**
```typescript
interface CartResponse {
  cart: {
    id: string;
    items: CartItem[];
    subtotal: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total: number;
    currency: string;
    item_count: number;
    expires_at: string;
  };
}

interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image_url: string;
    sku: string;
    stock_quantity: number;
  };
  quantity: number;
  unit_price: number;
  total_price: number;
}
```

### POST /api/cart/add
Add item to cart.

**Request:**
```typescript
interface AddToCartRequest {
  product_id: string;
  quantity: number;
}
```

**Example:**
```bash
curl -X POST /api/cart/add \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "quantity": 2
  }'
```

### PUT /api/cart/update
Update cart item quantity.

**Request:**
```typescript
interface UpdateCartRequest {
  item_id: string;
  quantity: number;
}
```

### DELETE /api/cart/remove
Remove item from cart.

**Request:**
```typescript
interface RemoveFromCartRequest {
  item_id: string;
}
```

### POST /api/cart/clear
Clear all items from cart.

### POST /api/cart/apply-coupon
Apply discount coupon to cart.

**Request:**
```typescript
interface ApplyCouponRequest {
  coupon_code: string;
}
```

**Response:**
```typescript
interface CouponResponse {
  coupon: {
    code: string;
    type: 'percentage' | 'fixed_amount';
    value: number;
    discount_amount: number;
  };
  cart: CartResponse['cart'];
}
```

---

## Order Processing APIs

### POST /api/checkout/initialize
Initialize checkout process.

**Request:**
```typescript
interface InitializeCheckoutRequest {
  shipping_address: Address;
  billing_address: Address;
  shipping_method?: string;
  payment_method: 'credit_card' | 'square_card';
}
```

**Response:**
```typescript
interface CheckoutResponse {
  checkout: {
    id: string;
    cart: CartResponse['cart'];
    shipping_address: Address;
    billing_address: Address;
    shipping_methods: ShippingMethod[];
    tax_calculation: {
      tax_rate: number;
      tax_amount: number;
      taxable_amount: number;
    };
    total_breakdown: {
      subtotal: number;
      tax: number;
      shipping: number;
      discount: number;
      total: number;
    };
  };
}
```

### POST /api/orders
Create new order.

**Request:**
```typescript
interface CreateOrderRequest {
  checkout_id: string;
  payment_method_id?: string;
  customer_notes?: string;
}
```

**Response:**
```typescript
interface CreateOrderResponse {
  order: {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    currency: string;
    created_at: string;
  };
  next_step: {
    action: 'payment' | 'confirmation';
    payment_intent_id?: string;
    redirect_url?: string;
  };
}
```

### GET /api/orders/[id]
Get order details.

**Response:**
```typescript
interface OrderDetailResponse {
  order: {
    id: string;
    order_number: string;
    status: string;
    financial_status: string;
    fulfillment_status: string;
    items: OrderItem[];
    customer: {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
    };
    shipping_address: Address;
    billing_address: Address;
    subtotal_amount: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total_amount: number;
    currency: string;
    payments: Payment[];
    created_at: string;
    updated_at: string;
    tracking_info?: {
      carrier: string;
      tracking_number: string;
      tracking_url: string;
    };
  };
}
```

### PUT /api/orders/[id]/cancel
Cancel an order.

**Request:**
```typescript
interface CancelOrderRequest {
  reason: string;
}
```

---

## Payment Processing APIs

### POST /api/payments/create-intent
Create payment intent for Square.

**Request:**
```typescript
interface CreatePaymentIntentRequest {
  order_id: string;
  amount: number;
  currency: string;
  payment_method: 'card';
}
```

**Response:**
```typescript
interface PaymentIntentResponse {
  payment_intent: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    client_secret: string;
  };
  square_application_id: string;
  square_location_id: string;
}
```

### POST /api/payments/process
Process payment with Square.

**Request:**
```typescript
interface ProcessPaymentRequest {
  order_id: string;
  payment_token: string;
  billing_contact?: {
    given_name: string;
    family_name: string;
    email: string;
    phone: string;
    address_lines: string[];
    city: string;
    state: string;
    country_code: string;
    postal_code: string;
  };
}
```

**Response:**
```typescript
interface ProcessPaymentResponse {
  payment: {
    id: string;
    status: 'completed' | 'failed' | 'pending';
    amount: number;
    currency: string;
    receipt_url?: string;
    square_payment_id: string;
  };
  order: {
    id: string;
    status: string;
    financial_status: string;
  };
}
```

### POST /api/payments/[id]/refund
Process payment refund.

**Request:**
```typescript
interface RefundRequest {
  amount: number;
  reason: string;
}
```

**Response:**
```typescript
interface RefundResponse {
  refund: {
    id: string;
    amount: number;
    status: string;
    square_refund_id: string;
    processed_at: string;
  };
}
```

### GET /api/payments/[id]/status
Get payment status.

**Response:**
```typescript
interface PaymentStatusResponse {
  payment: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    failure_reason?: string;
    created_at: string;
    processed_at?: string;
  };
}
```

---

## Admin Management APIs

### GET /api/admin/dashboard
Get admin dashboard statistics.

**Headers:**
```http
Authorization: Bearer <admin_token>
```

**Response:**
```typescript
interface DashboardResponse {
  stats: {
    orders: {
      today: number;
      this_week: number;
      this_month: number;
      total: number;
    };
    revenue: {
      today: number;
      this_week: number;
      this_month: number;
      total: number;
    };
    customers: {
      new_today: number;
      new_this_week: number;
      new_this_month: number;
      total: number;
    };
    products: {
      total: number;
      active: number;
      low_stock: number;
      out_of_stock: number;
    };
  };
  recent_orders: Order[];
  top_products: Array<{
    product: Product;
    sales_count: number;
    revenue: number;
  }>;
  charts: {
    revenue_trend: Array<{
      date: string;
      revenue: number;
      orders: number;
    }>;
    product_performance: Array<{
      category: string;
      sales: number;
    }>;
  };
}
```

### GET /api/admin/orders
Get all orders with admin filters.

**Query Parameters:**
```typescript
interface AdminOrderQuery {
  page?: number;
  limit?: number;
  status?: string;
  financial_status?: string;
  fulfillment_status?: string;
  customer_email?: string;
  order_number?: string;
  from_date?: string;
  to_date?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
```

### PUT /api/admin/orders/[id]/status
Update order status.

**Request:**
```typescript
interface UpdateOrderStatusRequest {
  status?: string;
  fulfillment_status?: string;
  tracking_info?: {
    carrier: string;
    tracking_number: string;
  };
  notes?: string;
}
```

### GET /api/admin/customers
Get all customers with admin filters.

**Query Parameters:**
```typescript
interface AdminCustomerQuery {
  page?: number;
  limit?: number;
  search?: string;
  registration_date_from?: string;
  registration_date_to?: string;
  has_orders?: boolean;
  sort_by?: 'name' | 'email' | 'created_at' | 'total_spent';
  sort_order?: 'asc' | 'desc';
}
```

### POST /api/admin/products
Create new product.

**Request:**
```typescript
interface CreateProductRequest {
  name: string;
  slug?: string;
  description: string;
  price: number;
  compare_at_price?: number;
  sku: string;
  stock_quantity: number;
  category_id: string;
  images: Array<{
    url: string;
    alt_text: string;
    is_primary: boolean;
  }>;
  is_active?: boolean;
  is_featured?: boolean;
  metadata?: Record<string, any>;
}
```

### PUT /api/admin/products/[id]
Update product.

### DELETE /api/admin/products/[id]
Delete product.

### GET /api/admin/analytics/sales
Get sales analytics.

**Query Parameters:**
```typescript
interface SalesAnalyticsQuery {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  from_date?: string;
  to_date?: string;
  group_by?: 'day' | 'week' | 'month';
}
```

**Response:**
```typescript
interface SalesAnalyticsResponse {
  summary: {
    total_revenue: number;
    total_orders: number;
    avg_order_value: number;
    conversion_rate: number;
  };
  trends: Array<{
    period: string;
    revenue: number;
    orders: number;
    customers: number;
  }>;
  top_products: Array<{
    product: Product;
    quantity_sold: number;
    revenue: number;
  }>;
  geographic_breakdown: Array<{
    state: string;
    orders: number;
    revenue: number;
  }>;
}
```

---

## Webhook Endpoints

### POST /api/webhooks/square
Handle Square webhook events.

**Headers:**
```http
X-Square-Signature: <signature>
Content-Type: application/json
```

**Request Body:**
```typescript
interface SquareWebhookEvent {
  type: string;
  data: {
    type: string;
    id: string;
    object: any;
  };
  event_id: string;
  created_at: string;
}
```

**Supported Events:**
- `payment.updated`
- `order.updated`
- `order.fulfilled`
- `customer.created`
- `customer.updated`

**Processing Flow:**
```typescript
export default async function squareWebhookHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify signature
  const signature = req.headers['x-square-signature'] as string;
  const isValid = verifySquareSignature(JSON.stringify(req.body), signature);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { type, data } = req.body as SquareWebhookEvent;

  try {
    switch (type) {
      case 'payment.updated':
        await handlePaymentUpdate(data);
        break;
      
      case 'order.updated':
        await handleOrderUpdate(data);
        break;
      
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
```

---

## Error Handling

### Standard Error Codes

```typescript
enum APIErrorCodes {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Business Logic
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_NOT_ALLOWED = 'REFUND_NOT_ALLOWED',
  
  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Square Integration
  SQUARE_API_ERROR = 'SQUARE_API_ERROR',
  SQUARE_PAYMENT_DECLINED = 'SQUARE_PAYMENT_DECLINED',
  SQUARE_INVALID_CARD = 'SQUARE_INVALID_CARD'
}
```

### Error Response Examples

**Validation Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Email is required"],
      "password": ["Password must be at least 8 characters"]
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Payment Error:**
```json
{
  "success": false,
  "error": {
    "code": "SQUARE_PAYMENT_DECLINED",
    "message": "Payment was declined",
    "details": {
      "decline_reason": "INSUFFICIENT_FUNDS",
      "square_error_code": "GENERIC_DECLINE"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Rate Limit Error:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "window": "15m",
      "retry_after": 900
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Client Error Handling

```typescript
// API Client with Error Handling
class APIClient {
  private baseURL: string;
  private authToken?: string;

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authToken ? `Bearer ${this.authToken}` : '',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new APIError(errorData.error.code, errorData.error.message, errorData.error.details);
    }

    const data = await response.json();
    return data.data;
  }
}

class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Usage with error handling
try {
  const product = await apiClient.request<Product>('/products/123');
} catch (error) {
  if (error instanceof APIError) {
    switch (error.code) {
      case 'PRODUCT_NOT_FOUND':
        showNotFound();
        break;
      case 'UNAUTHORIZED':
        redirectToLogin();
        break;
      default:
        showGenericError(error.message);
    }
  }
}
```

---

This API documentation provides comprehensive coverage of all endpoints in the Square payment integration system. Each endpoint includes detailed request/response schemas, authentication requirements, and error handling patterns.
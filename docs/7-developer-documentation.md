# Developer Documentation
## Founders Day Square Payment Integration

### Table of Contents
1. [Development Environment](#development-environment)
2. [Code Structure & Organization](#code-structure--organization)
3. [Coding Standards & Guidelines](#coding-standards--guidelines)
4. [Component Development](#component-development)
5. [API Development](#api-development)
6. [State Management](#state-management)
7. [Testing Guidelines](#testing-guidelines)
8. [Performance Optimization](#performance-optimization)
9. [Contributing Guidelines](#contributing-guidelines)
10. [Development Workflows](#development-workflows)

---

## Development Environment

### Required Tools and Setup

```bash
# Required versions
Node.js >= 18.0.0
npm >= 9.0.0
TypeScript >= 5.0.0
Git >= 2.30.0

# Recommended VS Code extensions
ext install bradlc.vscode-tailwindcss
ext install esbenp.prettier-vscode
ext install ms-vscode.vscode-typescript-next
ext install prisma.prisma
ext install ms-playwright.playwright
ext install storybook.vscode-storybook
```

### Development Configuration

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "typescript",
    "typescriptreact": "typescriptreact"
  },
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### Environment Variables

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  
  // Square
  SQUARE_APPLICATION_ID: z.string(),
  SQUARE_ACCESS_TOKEN: z.string(),
  SQUARE_LOCATION_ID: z.string(),
  SQUARE_WEBHOOK_SECRET: z.string(),
  SQUARE_ENVIRONMENT: z.enum(['sandbox', 'production']),
  
  // Auth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string(),
  JWT_SECRET: z.string(),
  
  // External services
  REDIS_URL: z.string().url().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);

// Type-safe environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
```

---

## Code Structure & Organization

### Project Structure

```
src/
├── components/          # React components
│   ├── common/         # Reusable components
│   ├── layout/         # Layout components
│   ├── forms/          # Form components
│   ├── payment/        # Payment-specific components
│   ├── product/        # Product components
│   ├── cart/           # Cart components
│   ├── customer/       # Customer components
│   └── admin/          # Admin components
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── api/           # API client functions
│   ├── auth/          # Authentication utilities
│   ├── db/            # Database utilities
│   └── validations/   # Validation schemas
├── pages/              # Next.js pages
│   ├── api/           # API routes
│   ├── auth/          # Authentication pages
│   ├── products/      # Product pages
│   ├── cart/          # Cart pages
│   ├── checkout/      # Checkout pages
│   └── admin/         # Admin pages
├── styles/             # CSS and styling
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── __tests__/          # Test files
```

### File Naming Conventions

```typescript
// Component files: PascalCase
components/PaymentForm.tsx
components/ProductCard.tsx

// Hook files: camelCase with 'use' prefix
hooks/useAuth.ts
hooks/useCart.ts

// Utility files: camelCase
utils/formatCurrency.ts
utils/validateEmail.ts

// Type files: camelCase
types/api.ts
types/payment.ts

// Page files: kebab-case
pages/checkout/success.tsx
pages/admin/dashboard.tsx

// API routes: kebab-case
pages/api/payments/process.ts
pages/api/orders/[id].ts
```

### Import Organization

```typescript
// Import order (enforced by ESLint)
// 1. React and framework imports
import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import Link from 'next/link';

// 2. External library imports
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import clsx from 'clsx';

// 3. Internal imports (absolute paths)
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/currency';

// 4. Relative imports
import './ComponentName.module.css';

// 5. Type imports (with 'type' keyword)
import type { User } from '@/types/user';
import type { ComponentProps } from 'react';
```

---

## Coding Standards & Guidelines

### TypeScript Standards

```typescript
// Use strict TypeScript configuration
// Prefer interfaces over types for object definitions
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

// Use types for unions, intersections, and computed types
type UserRole = 'customer' | 'admin' | 'superadmin';
type UserWithRole = User & { role: UserRole };

// Always define return types for functions
function calculateTotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

// Use generic types for reusable components
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// Prefer const assertions for immutable data
const PAYMENT_STATUSES = ['pending', 'completed', 'failed'] as const;
type PaymentStatus = typeof PAYMENT_STATUSES[number];

// Use branded types for type safety
type UserId = string & { readonly brand: unique symbol };
type ProductId = string & { readonly brand: unique symbol };

// Utility types for better type safety
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type CreateUserRequest = Optional<User, 'id' | 'createdAt'>;
```

### React Component Standards

```typescript
// Functional components with explicit typing
interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  className,
}) => {
  // Use custom hooks for state management
  const { addToCart, isLoading } = useCart();
  
  // Event handlers with proper typing
  const handleAddToCart = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onAddToCart(product.id);
    },
    [product.id, onAddToCart]
  );
  
  // Early returns for loading/error states
  if (!product) {
    return <ProductCardSkeleton />;
  }
  
  return (
    <div className={clsx('product-card', className)}>
      {/* Component content */}
    </div>
  );
};

// Always include displayName for debugging
ProductCard.displayName = 'ProductCard';

// Export component and props type
export type { ProductCardProps };
```

### Error Handling Standards

```typescript
// Custom error classes
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Error handling utilities
export const handleApiError = (error: unknown): APIError => {
  if (error instanceof APIError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new APIError(error.message, 500, 'INTERNAL_ERROR');
  }
  
  return new APIError('Unknown error occurred', 500, 'UNKNOWN_ERROR');
};

// Async error boundaries
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Function error:', error);
      throw handleApiError(error);
    }
  };
};
```

### Validation Standards

```typescript
// Use Zod for runtime validation
import { z } from 'zod';

// Define schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateUserSchema = createUserSchema.partial();

// Infer types from schemas
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

// Validation helpers
export const validateData = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T => {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error.issues[0].path.join('.'),
      data
    );
  }
  
  return result.data;
};
```

---

## Component Development

### Component Architecture

```typescript
// Base component structure
import React, { useState, useCallback, memo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

// Component variants using CVA
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Component props interface
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// Component implementation
export const Button = memo<ButtonProps>(({
  className,
  variant,
  size,
  isLoading,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      className={clsx(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="mr-2 h-4 w-4" />}
      {leftIcon && !isLoading && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
});

Button.displayName = 'Button';
```

### Custom Hooks Development

```typescript
// Custom hook for form management
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validationSchema?: z.ZodSchema<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const validate = useCallback(() => {
    if (!validationSchema) return true;

    try {
      validationSchema.parse(values);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof T, string>> = {};
        error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof T;
          fieldErrors[field] = issue.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  }, [values, validationSchema]);

  const handleSubmit = useCallback(
    async (onSubmit: (values: T) => Promise<void> | void) => {
      if (!validate()) return;

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    isSubmitting,
    setValue,
    validate,
    handleSubmit,
    reset,
  };
}

// Usage example
const ContactForm: React.FC = () => {
  const { values, errors, isSubmitting, setValue, handleSubmit } = useForm(
    { name: '', email: '', message: '' },
    contactFormSchema
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(async (data) => {
        await submitContactForm(data);
      });
    }}>
      {/* Form fields */}
    </form>
  );
};
```

### Component Testing

```typescript
// Component test example
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentForm } from './PaymentForm';

// Mock dependencies
jest.mock('@/hooks/useSquarePayment', () => ({
  useSquarePayment: () => ({
    isReady: true,
    processPayment: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('PaymentForm', () => {
  const defaultProps = {
    amount: 10000,
    currency: 'USD',
    onSuccess: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders payment form correctly', () => {
    render(<PaymentForm {...defaultProps} />);
    
    expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/card number/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<PaymentForm {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /pay/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Cardholder name is required')).toBeInTheDocument();
    });
  });

  it('processes payment successfully', async () => {
    const onSuccess = jest.fn();
    render(<PaymentForm {...defaultProps} onSuccess={onSuccess} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/cardholder name/i), {
      target: { value: 'John Doe' },
    });
    
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
```

---

## API Development

### API Route Structure

```typescript
// pages/api/orders/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { withErrorHandling } from '@/lib/error-handling';
import { OrderService } from '@/lib/services/OrderService';

// Request/response schemas
const getOrderParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateOrderBodySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
  trackingNumber: z.string().optional(),
});

// API handler
async function orderHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { id } = getOrderParamsSchema.parse(req.query);

  switch (method) {
    case 'GET':
      return await getOrder(req, res, id);
    case 'PUT':
      return await updateOrder(req, res, id);
    case 'DELETE':
      return await deleteOrder(req, res, id);
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getOrder(
  req: NextApiRequest,
  res: NextApiResponse,
  orderId: string
) {
  const order = await OrderService.getById(orderId, req.user.id);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  return res.status(200).json({ data: order });
}

async function updateOrder(
  req: NextApiRequest,
  res: NextApiResponse,
  orderId: string
) {
  const updateData = updateOrderBodySchema.parse(req.body);
  
  const updatedOrder = await OrderService.update(orderId, updateData);
  
  return res.status(200).json({ data: updatedOrder });
}

// Export with middleware
export default withAuth(withErrorHandling(orderHandler));
```

### Service Layer Pattern

```typescript
// lib/services/OrderService.ts
import { prisma } from '@/lib/db';
import { squareClient } from '@/lib/square';
import { OrderNotFoundError, InsufficientPermissionsError } from '@/lib/errors';

export class OrderService {
  static async getById(orderId: string, userId?: string): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        payments: true,
      },
    });

    if (!order) {
      return null;
    }

    // Check permissions
    if (userId && order.customerId !== userId) {
      throw new InsufficientPermissionsError('Cannot access this order');
    }

    return order;
  }

  static async create(orderData: CreateOrderData): Promise<Order> {
    // Validate inventory
    await this.validateInventory(orderData.items);

    // Create order in database
    const order = await prisma.order.create({
      data: {
        ...orderData,
        orderNumber: await this.generateOrderNumber(),
        status: 'pending',
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Create corresponding Square order
    const squareOrder = await this.createSquareOrder(order);
    
    // Update order with Square ID
    await prisma.order.update({
      where: { id: order.id },
      data: { squareOrderId: squareOrder.id },
    });

    // Send confirmation email
    await this.sendOrderConfirmation(order);

    return order;
  }

  static async update(
    orderId: string,
    updateData: UpdateOrderData
  ): Promise<Order> {
    const order = await this.getById(orderId);
    
    if (!order) {
      throw new OrderNotFoundError(`Order ${orderId} not found`);
    }

    // Update in database
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Update Square order if needed
    if (updateData.status && order.squareOrderId) {
      await this.updateSquareOrder(order.squareOrderId, updateData);
    }

    // Send status update notification
    if (updateData.status) {
      await this.sendStatusUpdate(updatedOrder);
    }

    return updatedOrder;
  }

  private static async validateInventory(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || product.stockQuantity < item.quantity) {
        throw new InsufficientStockError(
          `Insufficient stock for product ${item.productId}`
        );
      }
    }
  }

  private static async generateOrderNumber(): Promise<string> {
    const count = await prisma.order.count();
    return `FD-${(count + 1).toString().padStart(6, '0')}`;
  }

  private static async createSquareOrder(order: Order): Promise<SquareOrder> {
    const squareOrderRequest = {
      locationId: process.env.SQUARE_LOCATION_ID,
      order: {
        lineItems: order.items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity.toString(),
          basePriceMoney: {
            amount: Math.round(item.unitPrice * 100), // Convert to cents
            currency: 'USD',
          },
        })),
      },
    };

    const response = await squareClient.ordersApi.createOrder(squareOrderRequest);
    
    if (response.result.errors) {
      throw new SquareAPIError('Failed to create Square order', response.result.errors);
    }

    return response.result.order!;
  }
}
```

### API Client

```typescript
// lib/api/client.ts
class APIClient {
  private baseURL: string;
  private authToken?: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.message || 'Request failed',
        response.status,
        errorData.code || 'REQUEST_FAILED'
      );
    }

    return response.json();
  }

  // Convenience methods
  async get<T>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, { method: 'GET' });
    return response.data;
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, { method: 'DELETE' });
    return response.data;
  }
}

// Export configured client
export const apiClient = new APIClient(process.env.NEXT_PUBLIC_API_URL!);

// React Query integration
export const useApiQuery = <T>(
  key: string[],
  endpoint: string,
  options?: UseQueryOptions<T>
) => {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => apiClient.get<T>(endpoint),
    ...options,
  });
};

export const useApiMutation = <T, V = void>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST'
) => {
  const queryClient = useQueryClient();

  return useMutation<T, APIError, V>({
    mutationFn: (data: V) => {
      switch (method) {
        case 'POST':
          return apiClient.post<T>(endpoint, data);
        case 'PUT':
          return apiClient.put<T>(endpoint, data);
        case 'DELETE':
          return apiClient.delete<T>(endpoint);
      }
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries();
    },
  });
};
```

---

## State Management

### Zustand Store Pattern

```typescript
// stores/useCartStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  
  // Computed values
  itemCount: number;
  subtotal: number;
  
  // Actions
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  
  // Async actions
  syncWithServer: () => Promise<void>;
}

export const useCartStore = create<CartState>()(
  persist(
    immer((set, get) => ({
      items: [],
      isOpen: false,
      
      // Computed values
      get itemCount() {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
      
      get subtotal() {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },
      
      // Actions
      addItem: (product, quantity = 1) => {
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.productId === product.id
          );
          
          if (existingItem) {
            existingItem.quantity += quantity;
          } else {
            state.items.push({
              id: crypto.randomUUID(),
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity,
              imageUrl: product.images[0]?.url || '',
            });
          }
        });
      },
      
      removeItem: (itemId) => {
        set((state) => {
          state.items = state.items.filter((item) => item.id !== itemId);
        });
      },
      
      updateQuantity: (itemId, quantity) => {
        set((state) => {
          const item = state.items.find((item) => item.id === itemId);
          if (item) {
            if (quantity <= 0) {
              state.items = state.items.filter((item) => item.id !== itemId);
            } else {
              item.quantity = quantity;
            }
          }
        });
      },
      
      clearCart: () => {
        set((state) => {
          state.items = [];
          state.isOpen = false;
        });
      },
      
      toggleCart: () => {
        set((state) => {
          state.isOpen = !state.isOpen;
        });
      },
      
      syncWithServer: async () => {
        const { items } = get();
        try {
          await apiClient.post('/cart/sync', { items });
        } catch (error) {
          console.error('Failed to sync cart:', error);
        }
      },
    })),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Selector hooks for performance
export const useCartItems = () => useCartStore((state) => state.items);
export const useCartCount = () => useCartStore((state) => state.itemCount);
export const useCartTotal = () => useCartStore((state) => state.subtotal);
```

### React Query Integration

```typescript
// hooks/useOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useOrders = (params?: OrderQueryParams) => {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => apiClient.get<Order[]>('/orders', { params }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useOrder = (orderId: string) => {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => apiClient.get<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderData: CreateOrderRequest) =>
      apiClient.post<Order>('/orders', orderData),
    
    onSuccess: (newOrder) => {
      // Add to orders list
      queryClient.setQueryData<Order[]>(['orders'], (old) => 
        old ? [newOrder, ...old] : [newOrder]
      );
      
      // Set individual order cache
      queryClient.setQueryData(['orders', newOrder.id], newOrder);
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOrderRequest & { id: string }) =>
      apiClient.put<Order>(`/orders/${id}`, data),
    
    onSuccess: (updatedOrder) => {
      // Update individual order cache
      queryClient.setQueryData(['orders', updatedOrder.id], updatedOrder);
      
      // Update orders list
      queryClient.setQueryData<Order[]>(['orders'], (old) =>
        old?.map((order) =>
          order.id === updatedOrder.id ? updatedOrder : order
        )
      );
    },
  });
};
```

---

## Testing Guidelines

### Unit Testing

```typescript
// __tests__/utils/currency.test.ts
import { formatCurrency, parseCurrency } from '@/utils/currency';

describe('Currency Utils', () => {
  describe('formatCurrency', () => {
    it('formats USD currency correctly', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
      expect(formatCurrency(999.99, 'USD')).toBe('$999.99');
    });

    it('handles different currencies', () => {
      expect(formatCurrency(100, 'EUR')).toBe('€100.00');
      expect(formatCurrency(100, 'GBP')).toBe('£100.00');
    });

    it('handles edge cases', () => {
      expect(formatCurrency(-100, 'USD')).toBe('-$100.00');
      expect(formatCurrency(Infinity, 'USD')).toBe('$∞');
      expect(formatCurrency(NaN, 'USD')).toBe('$0.00');
    });
  });

  describe('parseCurrency', () => {
    it('parses formatted currency strings', () => {
      expect(parseCurrency('$1,234.56')).toBe(1234.56);
      expect(parseCurrency('$0.00')).toBe(0);
      expect(parseCurrency('€100.00')).toBe(100);
    });

    it('handles invalid input', () => {
      expect(parseCurrency('invalid')).toBe(0);
      expect(parseCurrency('')).toBe(0);
      expect(parseCurrency(null as any)).toBe(0);
    });
  });
});
```

### Integration Testing

```typescript
// __tests__/api/orders.integration.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/orders';
import { prisma } from '@/lib/db';
import { createTestUser, createTestProduct } from '@/lib/test-utils';

describe('/api/orders', () => {
  let testUser: User;
  let testProduct: Product;

  beforeAll(async () => {
    testUser = await createTestUser();
    testProduct = await createTestProduct();
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.product.delete({ where: { id: testProduct.id } });
  });

  describe('POST /api/orders', () => {
    it('creates order successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${await generateTestToken(testUser)}`,
        },
        body: {
          items: [
            {
              productId: testProduct.id,
              quantity: 1,
            },
          ],
          shippingAddress: {
            firstName: 'John',
            lastName: 'Doe',
            addressLine1: '123 Main St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
          },
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(201);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.data).toHaveProperty('id');
      expect(responseData.data).toHaveProperty('orderNumber');
      expect(responseData.data.items).toHaveLength(1);
    });

    it('validates required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${await generateTestToken(testUser)}`,
        },
        body: {
          items: [], // Empty items should fail
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toHaveProperty('error');
    });
  });
});
```

### E2E Testing

```typescript
// e2e/checkout-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test data
    await page.goto('/');
    
    // Login as test user
    await page.click('[data-testid="login-button"]');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('[type="submit"]');
  });

  test('complete purchase flow', async ({ page }) => {
    // Add product to cart
    await page.goto('/products/test-product');
    await page.click('[data-testid="add-to-cart"]');
    
    // Verify cart updated
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
    
    // Go to checkout
    await page.click('[data-testid="cart-button"]');
    await page.click('[data-testid="checkout-button"]');
    
    // Fill shipping information
    await page.fill('[name="shippingAddress.firstName"]', 'John');
    await page.fill('[name="shippingAddress.lastName"]', 'Doe');
    await page.fill('[name="shippingAddress.addressLine1"]', '123 Main St');
    await page.fill('[name="shippingAddress.city"]', 'New York');
    await page.fill('[name="shippingAddress.state"]', 'NY');
    await page.fill('[name="shippingAddress.postalCode"]', '10001');
    
    await page.click('[data-testid="continue-to-payment"]');
    
    // Fill payment information (test card)
    await page.fill('[name="cardNumber"]', '4532015112830366');
    await page.fill('[name="expiryDate"]', '12/25');
    await page.fill('[name="cvv"]', '123');
    await page.fill('[name="cardholderName"]', 'John Doe');
    
    // Submit payment
    await page.click('[data-testid="submit-payment"]');
    
    // Verify success
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
    await expect(page.locator('text=Order Confirmed')).toBeVisible();
    
    // Verify order appears in order history
    await page.goto('/account/orders');
    await expect(page.locator('[data-testid="order-item"]').first()).toBeVisible();
  });

  test('handles payment errors gracefully', async ({ page }) => {
    // Add product and go to checkout
    await page.goto('/products/test-product');
    await page.click('[data-testid="add-to-cart"]');
    await page.click('[data-testid="cart-button"]');
    await page.click('[data-testid="checkout-button"]');
    
    // Fill shipping
    await page.fill('[name="shippingAddress.firstName"]', 'John');
    // ... fill other fields
    await page.click('[data-testid="continue-to-payment"]');
    
    // Use invalid card
    await page.fill('[name="cardNumber"]', '4000000000000002'); // Declined card
    await page.fill('[name="expiryDate"]', '12/25');
    await page.fill('[name="cvv"]', '123');
    await page.fill('[name="cardholderName"]', 'John Doe');
    
    await page.click('[data-testid="submit-payment"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
    await expect(page.locator('text=Your card was declined')).toBeVisible();
  });
});
```

---

## Performance Optimization

### React Performance

```typescript
// Performance optimization techniques

// 1. React.memo for component memoization
export const ProductCard = memo<ProductCardProps>(({ product }) => {
  return (
    <div className="product-card">
      {/* Component content */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.product.id === nextProps.product.id &&
         prevProps.product.updatedAt === nextProps.product.updatedAt;
});

// 2. useMemo for expensive calculations
export const OrderSummary: React.FC<{ items: CartItem[] }> = ({ items }) => {
  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    
    return { subtotal, tax, total };
  }, [items]);

  return (
    <div>
      <div>Subtotal: {formatCurrency(summary.subtotal)}</div>
      <div>Tax: {formatCurrency(summary.tax)}</div>
      <div>Total: {formatCurrency(summary.total)}</div>
    </div>
  );
};

// 3. useCallback for event handlers
export const ProductList: React.FC<{ products: Product[] }> = ({ products }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleAddToCart = useCallback((product: Product) => {
    setCart(prev => [...prev, { ...product, quantity: 1 }]);
  }, []);

  return (
    <div>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={handleAddToCart}
        />
      ))}
    </div>
  );
};

// 4. Virtualization for large lists
import { FixedSizeList as List } from 'react-window';

export const VirtualizedProductList: React.FC<{ products: Product[] }> = ({ products }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={products.length}
      itemSize={200}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### Code Splitting

```typescript
// Dynamic imports for code splitting
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load heavy components
const AdminDashboard = dynamic(() => import('@/components/admin/Dashboard'), {
  loading: () => <DashboardSkeleton />,
  ssr: false,
});

const PaymentForm = dynamic(() => import('@/components/payment/PaymentForm'), {
  loading: () => <PaymentFormSkeleton />,
});

// Route-level code splitting
export default function CheckoutPage() {
  return (
    <div>
      <Suspense fallback={<PageSkeleton />}>
        <PaymentForm />
      </Suspense>
    </div>
  );
}

// Bundle analysis
// Add to next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // Next.js config
});
```

### Database Performance

```typescript
// Optimized database queries
export class OrderService {
  // Use select to limit fields
  static async getOrderSummary(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  // Use cursor-based pagination for large datasets
  static async getOrdersPaginated(cursor?: string, limit = 20) {
    return prisma.order.findMany({
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  }

  // Use transactions for consistency
  static async createOrderWithItems(orderData: CreateOrderData) {
    return prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          customerId: orderData.customerId,
          totalAmount: orderData.totalAmount,
          status: 'pending',
        },
      });

      // Create order items and update inventory
      for (const item of orderData.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          },
        });

        // Update product inventory
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return order;
    });
  }
}
```

---

## Contributing Guidelines

### Git Workflow

```bash
# Branch naming conventions
feature/payment-integration    # New features
bugfix/cart-quantity-issue    # Bug fixes
hotfix/critical-security      # Critical fixes
refactor/api-endpoints        # Code refactoring
docs/api-documentation        # Documentation updates

# Commit message format
# <type>(<scope>): <description>
#
# <body>
#
# <footer>

# Examples:
feat(payment): add Square payment integration
fix(cart): resolve quantity update issue
docs(api): update endpoint documentation
refactor(auth): simplify authentication logic
```

### Pull Request Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows the project's coding standards
- [ ] Self-review of code completed
- [ ] Code is properly commented
- [ ] Corresponding documentation updated
- [ ] No new TypeScript errors
- [ ] No security vulnerabilities introduced

## Screenshots (if applicable)
Add screenshots here.

## Additional Notes
Any additional information or context.
```

### Code Review Guidelines

```typescript
// Code review checklist

// ✅ Good practices
// 1. Proper TypeScript usage
interface UserProps {
  user: User;
  onUpdate: (user: User) => void;
}

// 2. Error handling
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('API call failed:', error);
  throw new APIError('Failed to fetch data');
}

// 3. Accessibility
<button
  aria-label="Add to cart"
  onClick={handleClick}
  disabled={isLoading}
>
  {isLoading ? 'Adding...' : 'Add to Cart'}
</button>

// 4. Performance considerations
const MemoizedComponent = memo(Component);
const optimizedValue = useMemo(() => expenseiveCalculation(), [deps]);

// ❌ Anti-patterns to avoid
// 1. Any types
const data: any = response.data; // Should be properly typed

// 2. Direct DOM manipulation
document.getElementById('element').style.display = 'none'; // Use React state

// 3. Unhandled promises
apiCall(); // Should have .catch() or be awaited in try/catch

// 4. Props drilling
// Passing props through multiple levels - use context or state management
```

---

This comprehensive developer documentation provides the foundation for maintaining high code quality and consistency across the Square payment integration project. It covers all aspects from development environment setup to advanced performance optimization techniques.